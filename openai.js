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

  const extractionPrompt = `
あなたはNotiaの資料解析エンジンです。

現在日付:
${today}

ユーザー補足:
${userMessage || "なし"}

添付された資料から、
タスクと予定をすべて抽出してください。

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
- 資料から明確に読み取れるほど高くする

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

  return JSON.parse(
    response.output_text
  );
}

module.exports = {
  chatWithNotia,
  extractDocumentSchedule,
};