const { chatWithNotia } = require("../../openai");

class ConversationAnalyzer {
async analyze(userMessage, options = {}) {
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

const conversationContext = options.context || {};
const activeTasks =
  options.activeTasks || conversationContext.activeTasks || [];
const resolvedReference = options.resolvedReference || null;

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
  "needsDateConfirmation": "boolean",
"dateExpression": "string | null",

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
- dueDate は必ず YYYY-MM-DD または null を返す。
- 空文字 "" は絶対に返さない。

- 日付が一意に決まる場合のみ、dueDate に YYYY-MM-DD を返す。
- この場合、needsDateConfirmation は false、dateExpression は null にする。

- 日付が曖昧な場合は、dueDate を null にし、needsDateConfirmation を true にする。
- dateExpression には、ユーザーが実際に発言した曖昧な期日表現をそのまま入れる。

- タスク作成で期日表現がない場合も、dueDate は null、needsDateConfirmation は true にする。
- この場合、dateExpression は "期限未指定" とする。

- ユーザーが言っていない曖昧な期日表現を補完してはいけない。
- 「買わないと」「やらないと」「しなきゃ」はタスクとして扱ってよい。



自動変換してよい表現:
- 今日
- 明日
- 明後日
- 1週間後 / 一週間後
- 3日後などの「○日後」
- 7月15日などの日付指定
- 来週月曜日、来週金曜日など曜日まで指定された表現

確認が必要な表現:
- 今週中
- 来週
- 来週中
- 今月中
- 来月中
- 月末まで
- 週末まで
- 近いうち
- そのうち
- できれば
- 時間があるとき

確認が必要な場合の例:
ユーザー: 今週中に資料を作る
{
  "intent": "task_create",
  "title": "資料を作る",
  "description": null,
  "dueDate": null,
  "needsDateConfirmation": true,
  "dateExpression": "今週中",
  "targetTaskId": null,
  "targetTaskTitle": null,
  "memories": [],
  "priority": "normal",
  "confidence": 0.9
}

【intent】
- 雑談 → chat
- 新しいタスク → task_create
- 既存タスクの修正 → task_update
- 既存タスクの完了 → task_complete
- 判定できない → unknown

【参照解決結果】
resolvedReference が存在する場合は、その内容を最優先で参照する。

resolvedReference に targetTaskId と targetTaskTitle が含まれている場合は、
task_update または task_complete の対象として使用する。

resolvedReference が存在する場合、別のタスクを勝手に推定してはいけない。

ただし、ユーザー発言がタスクの完了や更新を意味しない場合は、
resolvedReference があっても intent を無理に変更しない。

【会話コンテキスト】
最近の会話履歴がある場合は必ず参考にする。

「あれ」
「それ」
「さっきの」
「この前の」
「昨日の続き」
「終わった」
「やった」

などの省略表現は、最近の会話と activeTasks を照合して判断する。

ただし、対象が明確に1つに絞れない場合は無理に推定しない。
その場合は targetTaskId と targetTaskTitle を null にする。

会話履歴だけで新しいタスクを勝手に作ってはいけない。
ユーザーの今回の発言にタスク化の意図がある場合のみ task_create とする。

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

参照解決結果:
${JSON.stringify(resolvedReference, null, 2)}

最近の会話:
${JSON.stringify(conversationContext.history || [], null, 2)}

現在のアクティブタスク:
${JSON.stringify(activeTasks, null, 2)}

会話コンテキスト:
${JSON.stringify(conversationContext, null, 2)}
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
      needsDateConfirmation: false,
      dateExpression: null,
      targetTaskId: null,
      targetTaskTitle: null,
      memories: [],
      priority: "normal",
      confidence: 0,
    };
  }
}
}

module.exports = new ConversationAnalyzer();