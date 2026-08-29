require("dotenv").config();

const OpenAI = require("openai");

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
  const base64 =
    buffer.toString("base64");

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
- 特に年・月・日の対応関係を重点的に検証してください
- 表形式では、各項目がどの列・領域・見出しに属するか確認してから日付を確定してください
- 同じ1日〜31日が複数の月に繰り返されている場合、日だけを見て月を推測してはいけません
- 月の判定に十分な根拠がない場合はdateをnullにし、warningsへ理由を書いてください
`
      : "";

  const extractionPrompt = `
あなたはNotiaの資料解析エンジンです。

現在日付:
${today}

ユーザー補足:
${userMessage || "なし"}

添付された資料から、
タスクと予定をすべて抽出してください。

${recheckInstruction}

日付を読む前に、必ず資料全体の構造を確認してください。

日付解析の順序:

1. 資料全体から年度・年・資料作成日などの基準情報を確認する

2. 表や複数列の場合、各列・領域・見出しが何月に対応するか確認する

3. 各予定がどの列・領域・見出しに属しているか特定する

4. その領域の月を確定する

5. その後で日を読み取る

6. 曜日が記載されている場合は、その曜日も読み取る

7. 年・月・日・曜日の組み合わせに矛盾がないか確認する

8. 根拠が弱い場合は推測せずdateをnullにする

特に重要:

- 日だけを見て月を推測しない

- 例: 「10月の列に属する → 28日 → 10月28日」の順で判断する

- 複数月が横並び・縦並びの場合、月見出しと予定の位置関係を重視する

- 列境界やレイアウトが不明確なら、無理に月を確定しない

重要:
- 1つの資料に複数の日程があれば、すべて別々に抽出する
- 勝手にDB登録しない
- 資料に書いていない内容を創作しない

分類ルール:
- 会議、行事、旅行、予約、授業、イベントなど日時に参加するもの → event
- 提出、申込、支払い、準備、期限までに行うもの → task

event:
- title
- date
- startTime
- endTime
- location
- description

task:
- title
- date
- dueTime
- description

descriptionには、その項目に関係する以下の情報をまとめてください:
- 持ち物
- 服装
- 集合情報
- 提出先
- 提出方法
- 注意事項
- その他の補足

日付について:
- YYYY-MM-DD形式
- 年が明記されていない場合、資料全体と現在日付から合理的に特定できる場合のみ補完
- 特定できない場合はdateをnullにしてwarningsへ理由を書く
- 「8月下旬」「後日」など曖昧な日付を勝手に具体化しない

時間について:
- HH:MM形式
- 不明ならnull
- 集合時間と開始時間を混同しない
- 集合時間しかない場合はdescriptionへ入れる

location:
- 場所が明記されている場合のみ設定
- なければnull

confidence:

- 0〜1

- 項目全体を資料から明確に読み取れるほど高くする

sourceWeekday:

- 資料に曜日が明記されている場合は "月" "火" "水" "木" "金" "土" "日" のいずれかを返す

- 曜日の記載がない場合はnull

dateConfidence:

- 0〜1

- 年・月・日が正しいという確信度

- 特に月の所属列・見出しが明確かを重視する

- 月を確定できない場合は低くし、dateはnullにする

dateEvidence:

- 日付を判断した資料上の根拠を簡潔に書く

- 例: "中央列の見出しが10月で、その列の28日（水）に記載"

- 日付を確定できない場合は、何が不明確なのかを書く

日付に不確実性がある場合:

- 自信のない年月日を推測で確定しない

- dateをnullにする

- warningsにユーザー確認が必要な理由を書く

必ず指定されたJSON形式だけを返してください。
`;

  let content;

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
          `data:${mimeType};base64,${base64}`,
      },
    ];
  } else if (
    mimeType === "application/pdf"
  ) {
    content = [
      {
        type: "input_text",
        text: extractionPrompt,
      },
      {
        type: "input_file",
        filename: fileName,
        file_data:
          `data:application/pdf;base64,${base64}`,
      },
    ];
  } else {
    throw new Error(
      "Unsupported document type"
    );
  }

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
            "notia_document_schedule",

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

                    date: {
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

                    sourceWeekday: {

                      type: [
                        "string",
                        "null",
                      ],

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
                    "date",
                    "startTime",
                    "endTime",
                    "dueTime",
                    "location",
                    "description",
                    "confidence",

                    "sourceWeekday",

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

  const result = JSON.parse(
    response.output_text
  );

  const weekdayMap = {
    日: 0,
    月: 1,
    火: 2,
    水: 3,
    木: 4,
    金: 5,
    土: 6,
  };

  if (
    result &&
    Array.isArray(result.items)
  ) {
    for (const item of result.items) {
      if (
        !item ||
        !item.date ||
        !item.sourceWeekday
      ) {
        continue;
      }

      const match = String(item.date).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

      if (!match) {
        continue;
      }

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const parsedDate = new Date(
        Date.UTC(year, month - 1, day)
      );

      const isValidDate =
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day;

      if (!isValidDate) {
        continue;
      }

      const sourceWeekday =
        String(item.sourceWeekday)
          .replace("曜日", "")
          .trim();

      const expectedWeekday =
        weekdayMap[sourceWeekday];

      if (expectedWeekday === undefined) {
        continue;
      }

      const actualWeekday =
        parsedDate.getUTCDay();

      if (actualWeekday !== expectedWeekday) {
        if (mode !== "recheck") {
          return extractDocumentSchedule({
            buffer,
            mimeType,
            fileName,
            userMessage,
            mode: "recheck",
          });
        }

        const originalDate = item.date;

        item.date = null;
        item.dateConfidence = Math.min(
          Number(item.dateConfidence) || 0,
          0.4
        );

        if (!Array.isArray(result.warnings)) {
          result.warnings = [];
        }

        result.warnings.push(
          `${item.title || "予定"}の日付 ${originalDate} は、` +
          `資料記載の曜日（${sourceWeekday}）と一致しないため、` +
          "日付を未確定にしました。"
        );
      }
    }
  }

  return result;
}

module.exports = {
  chatWithNotia,
  extractDocumentSchedule,
};
