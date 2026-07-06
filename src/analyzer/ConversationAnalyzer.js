const { chatWithNotia } = require("../../openai");

class ConversationAnalyzer {
  async analyze(userMessage, context = {}) {
    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });

    const systemPrompt = `
現在日時: ${today} (Asia/Tokyo)

あなたは Notia Core の ConversationAnalyzer です。

役割:
ユーザーの発言を分析し、
会話の意図・タスク・期限・更新対象・優先度をJSONのみで返してください。

返却形式:
{
  "intent": "chat | task_create | task_update | task_complete | reminder | schedule | unknown",
  "title": "string | null",
  "description": "string | null",
  "dueDate": "string | null",
  "targetTaskId": "number | null",
  "targetTaskTitle": "string | null",

  "memories": [
    {
      "category": "string",
      "key": "string",
      "value": "string"
    }
  ],

  "priority": "low | normal | high",
  "confidence": "number"
}

ルール:
長期的に有用な情報がある場合のみ memories に追加する。
保存する情報がない場合は memories: [] を返す。

保存対象:
- 名前
- 呼び方
- 好きなもの
- 嫌いなもの
- 趣味
- 誕生日
- 職業
- 長期プロジェクト
- 継続的な好みや方針

保存しない:
- 一時的な感情
- 今日だけの予定
- 雑談
- タスクとして処理すべき内容

【日時】
- 「今日」「明日」「来週」などの相対日付は、現在日時を基準に YYYY-MM-DD へ変換する。
- 期限が分からない場合は dueDate を null にする。

【intent】
- 雑談 → chat
- 新しいタスク → task_create
- 既存タスクの修正 → task_update
- 既存タスクの完了 → task_complete
- 判定できない → unknown

【タスク】
- title は簡潔にまとめる。
- description は補足情報。
- priority は通常 normal。
- 今日中・緊急・重要は high。
- confidence は 0〜1。

【activeTasks】
会話コンテキストに activeTasks がある場合は必ず参照する。

task_update または task_complete の場合は、
最も一致するタスクを推定し、

targetTaskId
targetTaskTitle

を返す。

一致しない場合は両方 null にする。

「さっきのタスク」
「そのタスク」
「これ」
などの指示語は、
会話の流れと activeTasks を考慮して推定する。

confidence が 0.7 未満なら
task_update や task_complete にせず
chat とする。

必ずJSONのみ返す。
`;

    const userPrompt = `
ユーザー発言:
${userMessage}

会話コンテキスト:
${JSON.stringify(context, null, 2)}
`;

    const response = await chatWithNotia(
      userPrompt,
      [],
      systemPrompt
    );

    return this.safeParse(response);
  }

  safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return {
        intent: "unknown",
        title: null,
        description: text,
        dueDate: null,
        priority: "normal",
        confidence: 0,
      };
    }
  }
}

module.exports = new ConversationAnalyzer();