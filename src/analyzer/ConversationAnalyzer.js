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
会話の意図・タスク・期限・更新対象・更新内容・優先度を
JSONのみで返してください。

返却形式:
{
  "intent": "chat | task_create | task_update | task_complete | reminder | schedule | unknown",
  "title": "string | null",
  "description": "string | null",
  "dueDate": "string | null",
  "dueTime": "string | null",
  "category": "work | school | shopping | private | other | null",
  "notification": "none | same_day | day_before | null",
  "targetTaskId": "number | null",
  "targetTaskTitle": "string | null",
  "needsDateConfirmation": "boolean",
  "dateExpression": "string | null",

  "updates": {
    "title": "string | null",
    "description": "string | null",
    "dueDate": "string | null",
    "dueTime": "string | null",
    "priority": "low | normal | high | null",
    "category": "work | school | shopping | private | other | null",
    "notification": "none | same_day | day_before | null"
  },

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

【基本ルール】

- 必ず返却形式にあるすべての項目を返す。
- 値がない場合は空文字ではなく null を返す。
- updates は必ず返す。
- task_update以外の場合もupdatesを返し、すべてnullにする。
- ユーザーが変更を指示していない項目をupdatesに入れてはいけない。
- ユーザーの発言から推測できない値を勝手に補完してはいけない。

【memories】

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

【intent】

- 雑談 → chat
- 新しいタスク → task_create
- 既存タスクの修正 → task_update
- 既存タスクの完了 → task_complete
- 判定できない → unknown

【タスク作成】

task_createの場合:

- titleは簡潔にまとめる。
- descriptionは補足情報を入れる。
- priorityは通常normal。
- 今日中、緊急、至急、重要などはhigh。
- categoryを判断できる場合は分類する。
- 判断できない場合はcategoryをnullにする。
- notificationの指定がなければnullにする。
- updatesのすべての項目はnullにする。

カテゴリの判断例:

- 学校、授業、レポート、試験、教材、生徒、部活動
  → school

- 仕事、会議、出張、資料作成、職場、業務
  → work

- 買い物、購入、スーパー、注文
  → shopping

- 個人的な予定、趣味、家族、通院、旅行
  → private

- どれにも明確に当てはまらない
  → other

【タスク更新】

既存タスクの内容を変更する発言はtask_updateにする。

task_updateの場合:

- 変更する内容だけをupdatesに入れる。
- 変更しない項目は必ずnullにする。
- title、description、dueDate、dueTime、priority、category、
  notificationのトップレベル値は原則nullにする。
- priorityのトップレベル値は互換性維持のためnormalを返してよいが、
  実際の変更内容はupdates.priorityを使用する。
- 更新対象をtargetTaskIdとtargetTaskTitleに入れる。

更新例:

ユーザー:
学校にして

返却内容:
{
  "intent": "task_update",
  "updates": {
    "title": null,
    "description": null,
    "dueDate": null,
    "dueTime": null,
    "priority": null,
    "category": "school",
    "notification": null
  }
}

ユーザー:
仕事に変更して

updates.category:
"work"

ユーザー:
買い物にして

updates.category:
"shopping"

ユーザー:
プライベートに変更して

updates.category:
"private"

ユーザー:
その他にして

updates.category:
"other"

【優先度更新】

- 「優先度を上げて」
- 「重要にして」
- 「至急にして」
- 「緊急にして」

updates.priority:
"high"

- 「普通にして」
- 「通常にして」
- 「優先度を標準にして」

updates.priority:
"normal"

- 「優先度を下げて」
- 「後回しでいい」
- 「低めにして」

updates.priority:
"low"

【時間更新】

dueTimeは必ずHH:mm形式またはnullを返す。

変換例:

- 15時 → 15:00
- 午後3時 → 15:00
- 朝9時 → 09:00
- 9時30分 → 09:30
- 午後3時半 → 15:30

既存タスクの時間変更の場合はupdates.dueTimeに入れる。

ユーザー:
15時にして

updates.dueTime:
"15:00"

ユーザー:
明日の15時にして

updates.dueDate:
明日をYYYY-MM-DDに変換した値

updates.dueTime:
"15:00"

【通知更新】

- 「通知して」
- 「通知をオンにして」
- 「当日に通知して」

updates.notification:
"same_day"

- 「前日に通知して」
- 「通知を前日にして」

updates.notification:
"day_before"

- 「通知しないで」
- 「通知をオフにして」
- 「通知をなしにして」

updates.notification:
"none"

【複数項目の更新】

1回の発言で複数の更新が指定された場合は、
該当するすべての項目をupdatesに入れる。

ユーザー:
学校にして、明日の15時、通知は前日にして

updates:
{
  "title": null,
  "description": null,
  "dueDate": "明日に該当するYYYY-MM-DD",
  "dueTime": "15:00",
  "priority": null,
  "category": "school",
  "notification": "day_before"
}

【日時】

- dueDateおよびupdates.dueDateは、
  必ずYYYY-MM-DDまたはnullを返す。
- 空文字""は絶対に返さない。

- 日付が一意に決まる場合のみ、
  dueDateまたはupdates.dueDateにYYYY-MM-DDを返す。
- この場合、needsDateConfirmationはfalse、
  dateExpressionはnullにする。

- 日付が曖昧な場合は、
  dueDateとupdates.dueDateをnullにし、
  needsDateConfirmationをtrueにする。
- dateExpressionには、
  ユーザーが実際に発言した曖昧な期日表現をそのまま入れる。

- task_createで期日表現がない場合は、
  dueDateをnull、
  needsDateConfirmationをtrue、
  dateExpressionを"期限未指定"にする。

- task_updateで日付変更の指示がない場合は、
  needsDateConfirmationをfalse、
  dateExpressionをnullにする。

- ユーザーが言っていない曖昧な期日表現を補完してはいけない。
- 「買わないと」「やらないと」「しなきゃ」は
  タスクとして扱ってよい。

自動変換してよい表現:

- 今日
- 明日
- 明後日
- 1週間後
- 一週間後
- 3日後などの「○日後」
- 7月15日などの日付指定
- 来週月曜日
- 来週金曜日など曜日まで指定された表現

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

ユーザー:
今週中に資料を作る

{
  "intent": "task_create",
  "title": "資料を作る",
  "description": null,
  "dueDate": null,
  "dueTime": null,
  "category": null,
  "notification": null,
  "needsDateConfirmation": true,
  "dateExpression": "今週中",
  "targetTaskId": null,
  "targetTaskTitle": null,
  "updates": {
    "title": null,
    "description": null,
    "dueDate": null,
    "dueTime": null,
    "priority": null,
    "category": null,
    "notification": null
  },
  "memories": [],
  "priority": "normal",
  "confidence": 0.9
}

【参照解決結果】

resolvedReferenceが存在する場合は、
その内容を最優先で参照する。

resolvedReferenceにtargetTaskIdとtargetTaskTitleが
含まれている場合は、
task_updateまたはtask_completeの対象として使用する。

resolvedReferenceが存在する場合、
別のタスクを勝手に推定してはいけない。

ただし、ユーザー発言がタスクの完了や更新を意味しない場合は、
resolvedReferenceがあってもintentを無理に変更しない。

【会話コンテキスト】

最近の会話履歴がある場合は必ず参考にする。

以下のような省略表現は、
最近の会話とactiveTasksを照合して判断する。

- あれ
- それ
- さっきの
- この前の
- 昨日の続き
- 終わった
- やった
- 学校にして
- 優先度を下げて
- 15時にして

対象が明確に1つに絞れない場合は無理に推定しない。
その場合はtargetTaskIdとtargetTaskTitleをnullにする。

会話履歴だけで新しいタスクを勝手に作ってはいけない。
ユーザーの今回の発言にタスク化の意図がある場合のみ
task_createとする。

【activeTasks】

会話コンテキストにactiveTasksがある場合は必ず参照する。

task_updateまたはtask_completeの場合は、
最も一致するタスクを推定し、

targetTaskId
targetTaskTitle

を返す。

一致しない場合は両方nullにする。

以下のような指示語は、
会話の流れとactiveTasksを考慮して推定する。

- さっきのタスク
- そのタスク
- これ
- それ

confidenceが0.7未満の場合は、
対象を断定したtask_updateやtask_completeにせず、
chatまたはunknownにする。

confidenceは0から1の数値で返す。

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
      const parsed = JSON.parse(text);

      return {
        intent: parsed.intent || "unknown",
        title: parsed.title ?? null,
        description: parsed.description ?? null,
        dueDate: parsed.dueDate ?? null,
        dueTime: parsed.dueTime ?? null,
        category: parsed.category ?? null,
        notification: parsed.notification ?? null,
        needsDateConfirmation:
          parsed.needsDateConfirmation ?? false,
        dateExpression: parsed.dateExpression ?? null,
        targetTaskId: parsed.targetTaskId ?? null,
        targetTaskTitle: parsed.targetTaskTitle ?? null,
        updates: {
          title: parsed.updates?.title ?? null,
          description: parsed.updates?.description ?? null,
          dueDate: parsed.updates?.dueDate ?? null,
          dueTime: parsed.updates?.dueTime ?? null,
          priority: parsed.updates?.priority ?? null,
          category: parsed.updates?.category ?? null,
          notification: parsed.updates?.notification ?? null,
        },
        memories: Array.isArray(parsed.memories)
          ? parsed.memories
          : [],
        priority: parsed.priority || "normal",
        confidence:
          typeof parsed.confidence === "number"
            ? parsed.confidence
            : 0,
      };
    } catch (error) {
      return {
        intent: "unknown",
        title: null,
        description: text,
        dueDate: null,
        dueTime: null,
        category: null,
        notification: null,
        needsDateConfirmation: false,
        dateExpression: null,
        targetTaskId: null,
        targetTaskTitle: null,
        updates: {
          title: null,
          description: null,
          dueDate: null,
          dueTime: null,
          priority: null,
          category: null,
          notification: null,
        },
        memories: [],
        priority: "normal",
        confidence: 0,
      };
    }
  }
}

module.exports = new ConversationAnalyzer();