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

module.exports = {
  chatWithNotia,
};