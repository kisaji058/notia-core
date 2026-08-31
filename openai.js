require("dotenv").config();

const OpenAI = require("openai");
const sharp = require("sharp");

const {
  extractPdfLayoutText,
  buildMonthStructuredText,
  buildMonthDayBlocks,
} = require("./src/services/PdfLayoutTextService");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chatWithNotia(userMessage, recentMessages = [], systemHint = "") {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `
あなたは「Notia（ノティア）」という対話型AI秘書です。

基本設定:
- 一人称は「私」
- 相手の呼び方は、指定がない限り「あなた」
- 落ち着いていて有能
- 少しだけおちゃめ
- 返答は簡潔
- 必要以上に自発的な提案をしない
- 基本的に受け身
- タスク管理に必要な情報だけ確認する
- 締切が近づいた時だけ、補助が必要か伺う

追加指示:
${systemHint || "自然に会話してください。"}
        `,
      },
      ...recentMessages.map((m) => ({
        role: m.role,
        content: m.message,
      })),
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  return response.choices[0].message.content;
}

async function extractDocumentSchedule({
  buffer,
  mimeType,
  fileName,
  userMessage = "",
  mode = "normal",
}) {
  let normalizedBuffer =
    buffer;

  let normalizedMimeType =
    mimeType;

  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg"
  ) {
    normalizedBuffer =
      await sharp(buffer)
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 82,
          mozjpeg: true,
        })
        .toBuffer();

    normalizedMimeType =
      "image/jpeg";
  }

  const base64 =
    normalizedBuffer.toString(
      "base64"
    );

  const today =
    new Date().toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  const recheckInstruction =
    mode === "recheck"
      ? `
再調査モード:

- 前回の解析結果に誤りがある可能性があります
- 元資料を最初から独立して再確認してください
- 前回結果を正しい前提として扱わないでください
- 特に月見出しと各項目の位置関係を重点的に確認してください
- 同じ1日〜31日が複数月に繰り返される表では、必ず所属する月列を先に確定してください
`
      : "";

  const extractionPrompt = `
あなたはNotiaの資料解析エンジンです。

現在日付:
${today}

ユーザー補足:
${userMessage || "なし"}

添付資料からタスクと予定をすべて抽出してください。

${recheckInstruction}

最重要ルール:

完成した日付文字列を推測して作ってはいけません。

各項目について、資料上の構造をそのまま読み取り、

- sourceYear
- sourceMonth
- sourceDay
- sourceWeekday

を別々に返してください。

Notia側のプログラムが、
sourceYear / sourceMonth / sourceDay
から最終的なYYYY-MM-DDを作ります。

表形式の読み方:

1. 最初に資料全体の年度・年を確認する
2. 次に各列・領域の月見出しを確認する
3. 各予定がどの列・領域に属するか確認する
4. その列の月をsourceMonthに入れる
5. その後でsourceDayを読む
6. 曜日はその項目と同じ列・セルに書かれた曜日だけを読む

特に横方向に複数月が並ぶ資料では、
左右の別列の日付・曜日を混ぜてはいけません。

例:

資料が

9月列 | 10月列 | 11月列

となっていて、
「体育大会」が10月列の2日（金）にある場合、

sourceMonth: 10
sourceDay: 2
sourceWeekday: "金"

としてください。

9月2日（水）として扱ってはいけません。

sourceMonthは、
予定本文が所属している列・領域の月見出しから決めてください。

日番号だけから月を推測してはいけません。

月の所属が判断できない場合:
- sourceMonthをnull
- dateConfidenceを低くする
- warningsに理由を書く

年について:
- 西暦を整数で返す
- 和暦が資料にある場合は西暦へ変換する
- 資料全体から合理的に年を確定できない場合はnull

分類ルール:

- 会議、行事、旅行、予約、授業、イベントなど日時に参加するもの → event
- 提出、申込、支払い、準備、期限までに行うもの → task

event:
- title
- sourceYear
- sourceMonth
- sourceDay
- sourceWeekday
- startTime
- endTime
- location
- description

task:
- title
- sourceYear
- sourceMonth
- sourceDay
- sourceWeekday
- dueTime
- description

時間:
- HH:MM形式
- 不明ならnull
- AMやPMだけの場合はstartTime/dueTimeへ入れずdescriptionへ残す
- 集合時間と開始時間を混同しない

description:
- 持ち物
- 服装
- 集合情報
- 提出先
- 提出方法
- 注意事項
- その他補足

confidence:
- 項目全体の読み取り確信度
- 0〜1

dateConfidence:
- sourceYear / sourceMonth / sourceDayの所属関係が正しい確信度
- 特に月見出しと予定本文の位置関係を重視
- 月の所属が曖昧なら0.5未満にする

dateEvidence:
- 日付を判断した資料上の根拠
- 例:
  "中央の10月列の28日（水）の行に記載"
- 左・中央・右など、可能なら位置関係も書く

重要:
- 資料に書いていない項目を創作しない
- 勝手にDB登録しない
- 同じ予定を重複して抽出しない
- 月・日・曜日を別々の列から組み合わせない
- 不確かな日付を無理に確定しない

必ず指定されたJSON形式だけを返してください。
`;

  let content;
  let useStructuredPdf = false;
  let structuredPdfDayBlocks = [];
  let structuredPdfYear = null;
  let structuredPdfFiscalYear = null;

  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg"
  ) {
    content = [
      {
        type: "input_text",
        text: extractionPrompt,
      },
      {
        type: "input_image",
        image_url:
          `data:${normalizedMimeType};base64,${base64}`,
      },
    ];
  } else if (
    mimeType === "application/pdf"
  ) {
    let structuredPdfText =
      null;

    try {
      const layout =
        await extractPdfLayoutText(
          buffer
        );

      structuredPdfText =
        buildMonthStructuredText(
          layout
        );

      structuredPdfDayBlocks =
        buildMonthDayBlocks(
          layout
        ).filter(
          (block) =>
            Array.isArray(block.lines) &&
            block.lines.length > 0
        );

      const normalizedHeader =
        String(
          structuredPdfText || ""
        ).replace(
          /[０-９]/g,
          (char) =>
            String.fromCharCode(
              char.charCodeAt(0) -
                0xfee0
            )
        );

      const reiwaFiscalMatch =
        normalizedHeader.match(
          /令和\s*(\d{1,2})\s*年度/
        );

      const westernFiscalMatch =
        normalizedHeader.match(
          /\b(19\d{2}|20\d{2}|21\d{2})\s*年度/
        );

      if (reiwaFiscalMatch) {
        structuredPdfFiscalYear =
          2018 +
          Number(
            reiwaFiscalMatch[1]
          );

        structuredPdfYear =
          structuredPdfFiscalYear;
      } else if (
        westernFiscalMatch
      ) {
        structuredPdfFiscalYear =
          Number(
            westernFiscalMatch[1]
          );

        structuredPdfYear =
          structuredPdfFiscalYear;
      } else {
        const westernYearMatch =
          normalizedHeader.match(
            /\b(19\d{2}|20\d{2}|21\d{2})[.\/-]/
          );

        if (westernYearMatch) {
          structuredPdfYear =
            Number(
              westernYearMatch[1]
            );
        } else {
          const reiwaYearMatch =
            normalizedHeader.match(
              /令和\s*(\d{1,2})\s*年/
            );

          if (reiwaYearMatch) {
            structuredPdfYear =
              2018 +
              Number(
                reiwaYearMatch[1]
              );
          }
        }
      }
    } catch (
      layoutError
    ) {
      console.warn(
        "PDF layout preprocessing failed; falling back to direct PDF analysis:",
        layoutError.message
      );
    }

    const structuredBlockText =
      structuredPdfDayBlocks.length > 0
        ? structuredPdfDayBlocks
            .map(
              (block, index) => [
                `BLOCK ${index + 1}`,
                `${block.month}/${block.day} ${block.weekday || ""}`.trim(),
                ...block.lines,
              ].join("\n")
            )
            .join("\n\n")
        : "";

    const structuredInstruction =
      structuredPdfText
        ? `

以下は、NotiaがPDF内部の文字座標を使って、
日付ごとに分離した構造化BLOCKです。

日付判定では、このBLOCK情報を最優先してください。

重要:
- BLOCKごとに月・日・曜日が確定しています
- 元PDFの見た目から別の日付を推測してはいけません
- 各BLOCK内の本文は、そのBLOCKの日付に属します
- 複数行の本文は同じ日の予定です
- 元PDFは内容補助として使わず、このBLOCK情報を基準にしてください
- 出力では、各予定を必ず元のBLOCK番号に紐づけてください
- blockIdは入力に書かれているBLOCK番号をそのまま返してください
- 存在しないBLOCK番号を作らないでください
- 予定がないBLOCKは出力しなくて構いません
- 日付・月・曜日は出力に書かず、blockIdだけで対応付けてください

--- Notia構造化BLOCK ---

${structuredBlockText}

--- BLOCK終了 ---

`
        : "";

    const canUseStructuredPdf =
      Boolean(
        structuredPdfText
      ) &&
      structuredPdfDayBlocks.length > 0 &&
      Number.isInteger(
        structuredPdfYear
      ) &&
      structuredPdfYear >= 1900 &&
      structuredPdfYear <= 2200;

    if (canUseStructuredPdf) {
      useStructuredPdf = true;

      content = [
        {
          type: "input_text",
          text:
            extractionPrompt +
            structuredInstruction,
        },
      ];
    } else {
      content = [
        {
          type: "input_text",
          text:
            extractionPrompt,
        },
        {
          type: "input_file",
          filename:
            fileName,
          file_data:
            `data:application/pdf;base64,${base64}`,
        },
      ];
    }
  } else {
    throw new Error(
      "Unsupported document type"
    );
  }

  const buildStructuredPdfChunkContent = (
    blocks,
    startIndex,
    explicitBlockIds = null
  ) => {
    const chunkText =
      blocks
        .map(
          (block, offset) => {
            const blockId =
              Array.isArray(
                explicitBlockIds
              ) &&
              Number.isInteger(
                explicitBlockIds[
                  offset
                ]
              )
                ? explicitBlockIds[
                    offset
                  ]
                : startIndex +
                  offset +
                  1;

            return [
              `BLOCK ${blockId}`,
              `${block.month}/${block.day} ${block.weekday || ""}`.trim(),
              ...block.lines,
            ].join("\n");
          }
        )
        .join("\n\n");

    const chunkInstruction = `

以下は、NotiaがPDF内部の文字座標を使って、
日付ごとに分離した構造化BLOCKです。

重要:
- BLOCKごとに月・日・曜日は確定済みです
- 各BLOCK内の本文は、そのBLOCKの日付に属します
- 複数行の本文は同じ日の予定です
- 各予定を必ず元のBLOCK番号に紐づけてください
- blockIdは入力のBLOCK番号をそのまま返してください
- 存在しないBLOCK番号を作らないでください
- 入力されたすべてのBLOCKを必ず1回ずつ出力してください
- BLOCKを省略しないでください
- 判断できる予定がない場合でも、そのBLOCKをentries: []で出力してください
- 同じBLOCK番号を重複して出力しないでください
- 日付・月・曜日は出力せず、blockIdだけで対応付けてください

--- Notia構造化BLOCK ---

${chunkText}

--- BLOCK終了 ---
`;

    return [
      {
        type: "input_text",
        text:
          extractionPrompt +
          chunkInstruction,
      },
    ];
  };

  const structuredPdfFormat = {
    type: "json_schema",
    name:
      "notia_document_schedule_blocks",
    strict: true,
    schema: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              blockId: {
                type: "integer",
              },
              entries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: [
                        "task",
                        "event",
                      ],
                    },
                    title: {
                      type: "string",
                    },
                    startTime: {
                      type: [
                        "string",
                        "null",
                      ],
                    },
                    endTime: {
                      type: [
                        "string",
                        "null",
                      ],
                    },
                    dueTime: {
                      type: [
                        "string",
                        "null",
                      ],
                    },
                    location: {
                      type: [
                        "string",
                        "null",
                      ],
                    },
                    description: {
                      type: "string",
                    },
                  },
                  required: [
                    "type",
                    "title",
                    "startTime",
                    "endTime",
                    "dueTime",
                    "location",
                    "description",
                  ],
                  additionalProperties:
                    false,
                },
              },
            },
            required: [
              "blockId",
              "entries",
            ],
            additionalProperties:
              false,
          },
        },
        warnings: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: [
        "blocks",
        "warnings",
      ],
      additionalProperties:
        false,
    },
  };

  let rawResult;

  if (useStructuredPdf) {
    const chunkSize = 10;

    const chunks = [];

    for (
      let startIndex = 0;
      startIndex <
        structuredPdfDayBlocks.length;
      startIndex += chunkSize
    ) {
      const blocks =
        structuredPdfDayBlocks.slice(
          startIndex,
          startIndex + chunkSize
        );

      chunks.push({
        startIndex,
        blocks,
      });
    }

    const responses = [];
    const maxConcurrentChunks = 3;

    for (
      let chunkIndex = 0;
      chunkIndex < chunks.length;
      chunkIndex +=
        maxConcurrentChunks
    ) {
      const batch =
        chunks.slice(
          chunkIndex,
          chunkIndex +
            maxConcurrentChunks
        );

      const batchResponses =
        await Promise.all(
          batch.map(
            async ({
              startIndex,
              blocks,
            }) => {
              const response =
                await client.responses.create({
                  model: "gpt-4.1-mini",
                  input: [
                    {
                      role: "user",
                      content:
                        buildStructuredPdfChunkContent(
                          blocks,
                          startIndex
                        ),
                    },
                  ],
                  text: {
                    format:
                      structuredPdfFormat,
                  },
                });

              return JSON.parse(
                response.output_text
              );
            }
          )
        );

      responses.push(
        ...batchResponses
      );
    }

    const getReturnedBlockIds = (
      responseResults
    ) => {
      const ids = new Set();

      for (
        const result of
        responseResults
      ) {
        const resultBlocks =
          Array.isArray(
            result.blocks
          )
            ? result.blocks
            : [];

        for (
          const block of
          resultBlocks
        ) {
          const blockId =
            Number(
              block.blockId
            );

          if (
            Number.isInteger(
              blockId
            ) &&
            blockId >= 1 &&
            blockId <=
              structuredPdfDayBlocks.length
          ) {
            ids.add(
              blockId
            );
          }
        }
      }

      return ids;
    };

    const findMissingBlockIds = (
      responseResults
    ) => {
      const returnedIds =
        getReturnedBlockIds(
          responseResults
        );

      const missingIds = [];

      for (
        let blockId = 1;
        blockId <=
          structuredPdfDayBlocks.length;
        blockId++
      ) {
        if (
          !returnedIds.has(
            blockId
          )
        ) {
          missingIds.push(
            blockId
          );
        }
      }

      return missingIds;
    };

    let missingBlockIds =
      findMissingBlockIds(
        responses
      );

    if (
      missingBlockIds.length >
      0
    ) {
      console.warn(
        "[document] structured PDF missing BLOCKs; retrying:",
        missingBlockIds.join(",")
      );

      const retryChunks = [];

      const retryChunkSize = 5;

      for (
        let index = 0;
        index <
          missingBlockIds.length;
        index += retryChunkSize
      ) {
        const blockIds =
          missingBlockIds.slice(
            index,
            index +
              retryChunkSize
          );

        retryChunks.push({
          blockIds,
          blocks:
            blockIds.map(
              (blockId) =>
                structuredPdfDayBlocks[
                  blockId - 1
                ]
            ),
        });
      }

      for (
        let retryIndex = 0;
        retryIndex <
          retryChunks.length;
        retryIndex +=
          maxConcurrentChunks
      ) {
        const batch =
          retryChunks.slice(
            retryIndex,
            retryIndex +
              maxConcurrentChunks
          );

        const retryResponses =
          await Promise.all(
            batch.map(
              async ({
                blockIds,
                blocks,
              }) => {
                const response =
                  await client.responses.create({
                    model:
                      "gpt-4.1-mini",
                    input: [
                      {
                        role: "user",
                        content:
                          buildStructuredPdfChunkContent(
                            blocks,
                            0,
                            blockIds
                          ),
                      },
                    ],
                    text: {
                      format:
                        structuredPdfFormat,
                    },
                  });

                return JSON.parse(
                  response.output_text
                );
              }
            )
          );

        responses.push(
          ...retryResponses
        );
      }

      missingBlockIds =
        findMissingBlockIds(
          responses
        );

      if (
        missingBlockIds.length >
        0
      ) {
        throw new Error(
          `Structured PDF BLOCK extraction incomplete: ${missingBlockIds.join(",")}`
        );
      }
    }

    rawResult = {
      blocks:
        responses.flatMap(
          (result) =>
            Array.isArray(
              result.blocks
            )
              ? result.blocks
              : []
        ),
      warnings:
        responses.flatMap(
          (result) =>
            Array.isArray(
              result.warnings
            )
              ? result.warnings
              : []
        ),
    };
  } else {
    const response =
      await client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name:
              "notia_document_schedule_source_parts",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "task",
                          "event",
                        ],
                      },
                      title: {
                        type: "string",
                      },
                      sourceYear: {
                        type: [
                          "integer",
                          "null",
                        ],
                      },
                      sourceMonth: {
                        type: [
                          "integer",
                          "null",
                        ],
                      },
                      sourceDay: {
                        type: [
                          "integer",
                          "null",
                        ],
                      },
                      sourceWeekday: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                      startTime: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                      endTime: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                      dueTime: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                      location: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                      description: {
                        type: "string",
                      },
                      confidence: {
                        type: "number",
                      },
                      dateConfidence: {
                        type: "number",
                      },
                      dateEvidence: {
                        type: [
                          "string",
                          "null",
                        ],
                      },
                    },
                    required: [
                      "type",
                      "title",
                      "sourceYear",
                      "sourceMonth",
                      "sourceDay",
                      "sourceWeekday",
                      "startTime",
                      "endTime",
                      "dueTime",
                      "location",
                      "description",
                      "confidence",
                      "dateConfidence",
                      "dateEvidence",
                    ],
                    additionalProperties:
                      false,
                  },
                },
                warnings: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              },
              required: [
                "items",
                "warnings",
              ],
              additionalProperties:
                false,
            },
          },
        },
      });

    rawResult =
      JSON.parse(
        response.output_text
      );
  }

  let result;

  if (useStructuredPdf) {
    const warnings =
      Array.isArray(rawResult.warnings)
        ? [...rawResult.warnings]
        : [];

    const items = [];

    const blocks =
      Array.isArray(rawResult.blocks)
        ? rawResult.blocks
        : [];

    for (const blockResult of blocks) {
      const blockId =
        Number(blockResult.blockId);

      if (
        !Number.isInteger(blockId) ||
        blockId < 1 ||
        blockId >
          structuredPdfDayBlocks.length
      ) {
        warnings.push(
          `不正なBLOCK ID ${blockResult.blockId} を無視しました。`
        );
        continue;
      }

      const sourceBlock =
        structuredPdfDayBlocks[
          blockId - 1
        ];

      const entries =
        Array.isArray(blockResult.entries)
          ? blockResult.entries
          : [];

      for (const entry of entries) {
        items.push({
          ...entry,
          sourceYear:
            structuredPdfFiscalYear !== null &&
            sourceBlock.month >= 1 &&
            sourceBlock.month <= 3
              ? structuredPdfFiscalYear + 1
              : structuredPdfYear,
          sourceMonth:
            sourceBlock.month,
          sourceDay:
            sourceBlock.day,
          sourceWeekday:
            sourceBlock.weekday,
          confidence:
            0.9,
          dateConfidence:
            1,
          dateEvidence:
            `BLOCK ${blockId}`,
        });
      }
    }

    result = {
      items,
      warnings,
    };
  } else {
    result = rawResult;

    if (!Array.isArray(result.items)) {
      result.items = [];
    }

    if (!Array.isArray(result.warnings)) {
      result.warnings = [];
    }
  }

  const normalizeExtractedTime = (
    value
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const normalized =
      String(value).trim();

    const match =
      normalized.match(
        /^([01]?\d|2[0-3]):([0-5]\d)$/
      );

    if (!match) {
      return null;
    }

    return `${match[1].padStart(2, "0")}:${match[2]}`;
  };

  for (const item of result.items) {
    item.startTime =
      normalizeExtractedTime(
        item.startTime
      );

    item.endTime =
      normalizeExtractedTime(
        item.endTime
      );

    item.dueTime =
      normalizeExtractedTime(
        item.dueTime
      );
  }

  const weekdayMap = {
    日: 0,
    月: 1,
    火: 2,
    水: 3,
    木: 4,
    金: 5,
    土: 6,
  };

  let shouldRecheck = false;

  for (const item of result.items) {
    item.date = null;

    const year =
      Number(item.sourceYear);
    const month =
      Number(item.sourceMonth);
    const day =
      Number(item.sourceDay);

    const hasDateParts =
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      year >= 1900 &&
      year <= 2200 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31;

    if (!hasDateParts) {
      item.dateConfidence = Math.min(
        Number(item.dateConfidence) || 0,
        0.4
      );

      result.warnings.push(
        `${item.title || "予定"}は年月日の所属を十分に確認できないため、日付を未確定にしました。`
      );

      continue;
    }

    const parsedDate = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    const isValidDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() ===
        month - 1 &&
      parsedDate.getUTCDate() === day;

    if (!isValidDate) {
      item.dateConfidence = Math.min(
        Number(item.dateConfidence) || 0,
        0.4
      );

      result.warnings.push(
        `${item.title || "予定"}の日付候補 ${year}-${month}-${day} は存在しない日付のため、未確定にしました。`
      );

      continue;
    }

    const sourceWeekday =
      item.sourceWeekday
        ? String(item.sourceWeekday)
            .replace("曜日", "")
            .trim()
        : null;

    if (
      sourceWeekday &&
      weekdayMap[sourceWeekday] !== undefined
    ) {
      const actualWeekday =
        parsedDate.getUTCDay();

      if (
        actualWeekday !==
        weekdayMap[sourceWeekday]
      ) {
        if (mode !== "recheck") {
          shouldRecheck = true;
          break;
        }

        item.dateConfidence = Math.min(
          Number(item.dateConfidence) || 0,
          0.4
        );

        result.warnings.push(
          `${item.title || "予定"}の候補日 ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} は、` +
          `資料記載の曜日（${sourceWeekday}）と一致しないため、日付を未確定にしました。`
        );

        continue;
      }
    }

    if (
      Number(item.dateConfidence) < 0.5
    ) {
      result.warnings.push(
        `${item.title || "予定"}は月または日の所属根拠が弱いため、日付を未確定にしました。`
      );

      continue;
    }

    item.date =
      `${String(year).padStart(4, "0")}-` +
      `${String(month).padStart(2, "0")}-` +
      `${String(day).padStart(2, "0")}`;
  }

  if (
    shouldRecheck &&
    mode !== "recheck"
  ) {
    return extractDocumentSchedule({
      buffer,
      mimeType,
      fileName,
      userMessage,
      mode: "recheck",
    });
  }

  for (const item of result.items) {
    delete item.sourceYear;
    delete item.sourceMonth;
    delete item.sourceDay;
  }

  return result;
}

module.exports = {
  chatWithNotia,
  extractDocumentSchedule,
};
