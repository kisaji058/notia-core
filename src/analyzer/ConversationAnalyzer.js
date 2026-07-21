const { chatWithNotia } = require("../../openai");
const VALID_INTENTS = [
  "chat",
  "task_create",
  "task_update",
  "task_complete",
  "schedule_query",
  "routine_create",
  "unknown",
];

const VALID_CATEGORIES = [
  "work",
  "school",
  "shopping",
  "private",
  "other",
];

const VALID_NOTIFICATIONS = [
  "none",
  "same_day",
  "day_before",
];

const VALID_PRIORITIES = [
  "low",
  "normal",
  "high",
];

function validateEnum(value, validValues) {
  return validValues.includes(value)
    ? value
    : null;
}

function hasExplicitTaskUpdateCue(message) {
  if (typeof message !== "string") {
    return false;
  }

  const updatePatterns = [
    /変更して/,
    /変えて/,
    /直して/,
    /修正して/,
    /更新して/,
    /にして/,
    /へ変更/,
    /期限を/,
    /締切を/,
    /時間を/,
    /優先度を/,
    /分類を/,
    /カテゴリを/,
    /通知を/,
    /タイトルを/,
    /説明を/,
  ];

  return updatePatterns.some((pattern) =>
    pattern.test(message)
  );
}

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
  "intent": "chat | task_create | task_update | task_complete | schedule_query | routine_create | unknown",
"tasks": [
    {
      "title": "string",
      "description": "string | null",
      "dueDate": "string | null",
      "dueTime": "string | null",
      "category": "work | school | shopping | private | other | null",
      "notification": "none | same_day | day_before | null",
      "needsDateConfirmation": "boolean",
      "dateExpression": "string | null",
      "priority": "low | normal | high"
    }
  ],
  "routine": {
  "title": "string | null",
  "dayOfWeek": "number | null",
  "routineTime": "string | null",
  "category": "work | school | shopping | private | other | null",
  "googleCalendarEnabled": "boolean"
},
  "title": "string | null",
  "description": "string | null",
  "dueDate": "string | null",
  "dueTime": "string | null",
  "category": "work | school | shopping | private | other | null",
  "notification": "none | same_day | day_before | null",
  "targetTaskId": "number | null",
  "targetTaskTitle": "string | null",
  "scheduleQuery": {
  "range": "today | tomorrow | day_after_tomorrow | weekday | next_weekday | this_week | next_week | this_month | null",
  "target":
"schedule | task | routine | null",
  "title": "string | null",
  "dayOfWeek": "number | null"
},
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
- tasksは必ず配列で返す。
- task_createの場合は、作成するすべてのタスクをtasksに入れる。
- task_create以外の場合はtasks: []を返す。
- タスクが1件だけの場合もtasksに1件入れる。
- 複数の行動が含まれる場合は、1つにまとめず別々のタスクに分割する。
- 既存互換のため、task_createではtasksの先頭要素と同じ内容を
  title、description、dueDate、dueTime、category、notification、
  needsDateConfirmation、dateExpression、priorityにも入れる。
- routine_createの場合はtasksを空配列にする。
- routine_createの場合のみroutineを設定する。
- routine_create以外ではroutineはnullを返す。
- RoutineとTaskを混在させてはいけない。

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
- 毎週の繰り返し予定登録 → routine_create

【ルーティーン登録】

毎週繰り返す予定や習慣は
intent を "routine_create" にする。

routine_create の場合は

tasks は必ず [] を返す。

routine を返す。

例

ユーザー:
毎週月曜18時にジム

{
  "intent":"routine_create",

  "tasks":[],

  "routine":{
      "title":"ジム",
      "dayOfWeek":1,
      "routineTime":"18:00",
      "category":"private",
      "googleCalendarEnabled":false
  }
}

曜日は

0 日
1 月
2 火
3 水
4 木
5 金
6 土

時間指定がない場合は
routineTimeはnull。

Google同期はfalse。

例

ユーザー:
毎週月曜18時にジム

出力:

{
  "intent": "routine_create"
}

例

ユーザー:
火曜日は英語

↓

intent:
"routine_create"

例

ユーザー:
毎週金曜日9時ミーティング

↓

intent:
"routine_create"

routine_create の場合は
tasks は必ず [] を返す。

【予定照会】

ユーザーが予定やタスクを確認したい場合は、
intent を "schedule_query" にする。

### 例1：今日の予定

ユーザー:
今日何ある？

出力:
{
  "intent": "schedule_query",
  "scheduleQuery": {
    "range": "today",
    "target": "schedule",
    "title": null
  }
}

### 例2：期間の予定

ユーザー:
今週の予定教えて

出力:
{
  "intent": "schedule_query",
  "scheduleQuery": {
    "range": "this_week",
    "target": "schedule",
    "title": null
  }
}

### 例3：タスク検索

ユーザー:
歯医者っていつだっけ？

出力:
{
  "intent": "schedule_query",
  "scheduleQuery": {
    "range": null,
    "target": "task",
    "title": "歯医者"
  }
}

### 例4：ルーティーン照会

ユーザー:
今日のルーティーンは？

出力:

{
  "intent": "schedule_query",
  "scheduleQuery": {
    "range": "today",
    "target": "routine",
    "title": null
  }
}

月曜日のルーティーン

今日の習慣

今日のルーチン

### 例5：曜日指定

ユーザー:
月曜日のルーティーンは？

出力:
{
  "intent": "schedule_query",
  "scheduleQuery": {
    "range": "weekday",
    "target": "routine",
    "title": null,
    "dayOfWeek": 1
  }
}

ユーザー:
金曜日のルーティーン

出力:
{
  "intent": "schedule_query",
  "scheduleQuery": {
    "range": "weekday",
    "target": "routine",
    "title": null,
    "dayOfWeek": 5
  }
}


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

【複数タスク作成】

1回のユーザー発言に複数の独立した行動が含まれる場合は、
行動ごとに別々のタスクとしてtasksへ入れる。

例:

ユーザー:
明日スーパーに行って、銀行にも行く



tasks:
[
  {
    "title": "スーパーに行く",
    "description": null,
    "dueDate": "明日に該当するYYYY-MM-DD",
    "dueTime": null,
    "category": "shopping",
    "notification": null,
    "needsDateConfirmation": false,
    "dateExpression": null,
    "priority": "normal"
  },
  {
    "title": "銀行に行く",
    "description": null,
    "dueDate": "明日に該当するYYYY-MM-DD",
    "dueTime": null,
    "category": "private",
    "notification": null,
    "needsDateConfirmation": false,
    "dateExpression": null,
    "priority": "normal"
  }
]

共通の期日表現が複数の行動にかかっている場合は、
すべてのタスクに同じdueDateを設定する。

ユーザー:
明日、スーパーに行って銀行にも行く

この場合、「明日」は両方のタスクに適用する。

ユーザー:
スーパーは明日、銀行は金曜日に行く

この場合、それぞれ異なるdueDateを設定する。

ユーザー:
明日スーパーに行って、銀行にも行く。クリーニングも出す

この場合は3件のタスクに分け、
3件すべてに明日の日付を設定する。

「〜して、〜する」
「〜と〜をやる」
「〜も」
「それから」
「あと」
などで複数の独立した行動が示されている場合は、
可能な限り個別のタスクに分割する。

単なる手順や補足は別タスクに分割せず、
descriptionに入れる。

例:
資料を作って上司に確認してもらう

「上司への確認依頼」が独立して管理すべき行動なら2件、
資料作成の説明にすぎない場合は1件とする。
文脈から自然な単位で判断する。

【新規タスクと更新の区別】

ユーザーの今回の発言が、
新しい行動・予定・用事を述べている場合はtask_createにする。

既存のactiveTasksに似たタイトルのタスクが存在していても、
それだけを理由にtask_updateにしてはいけない。

以下のような発言は、新規タスクとして扱う。

- 明日会議がある
- 明後日牛乳を買いに行く
- 金曜日に銀行へ行く
- 来週資料を作る

task_updateにするのは、
ユーザーが既存タスクの変更を明示している場合、
またはresolvedReferenceが存在する場合に限る。

変更を明示する表現の例:

- 期限を変えて
- 明日に変更して
- 15時にして
- タイトルを変えて
- 学校にして
- 優先度を上げて

resolvedReferenceがnullで、
ユーザーが変更を明示していない場合は、
似たactiveTasksが存在していてもtask_updateにしてはいけない。

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
- 複数タスクの場合、期限の有無はタスクごとに判断する。
- 共通の期日表現がある場合は、対象となるすべてのタスクに適用する。
- 一部のタスクだけ期日が未指定の場合、そのタスクだけ
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

console.log(
  "ConversationAnalyzer result:",
  {
    userMessage,
    resolvedReference,
    response,
  }
);

const analysis = this.safeParse(response);

const shouldRetryWithoutTaskContext =
  analysis.intent === "task_update" &&
  !resolvedReference &&
  !hasExplicitTaskUpdateCue(userMessage);

if (!shouldRetryWithoutTaskContext) {
  return analysis;
}

console.warn(
  "⚠️ 更新指示のないtask_updateを再解析:",
  {
    userMessage,
    targetTaskId: analysis.targetTaskId,
    targetTaskTitle: analysis.targetTaskTitle,
  }
);

const retryPrompt = `
ユーザー発言:
${userMessage}

重要:
この発言には既存タスクを変更する明示的な指示がありません。
既存タスクとのタイトルの類似だけを理由に、
task_updateとして扱ってはいけません。

この発言単体から意図を判定してください。

参照解決結果:
null

最近の会話:
[]

現在のアクティブタスク:
[]

会話コンテキスト:
{}
`;

const retryResponse = await chatWithNotia(
  retryPrompt,
  [],
  systemPrompt
);

console.log(
  "ConversationAnalyzer retry result:",
  {
    userMessage,
    response: retryResponse,
  }
);

return this.safeParse(retryResponse);
  }

  async analyzeConfirmation(userMessage, context = {}) {
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const systemPrompt = `
現在日時: ${today} (Asia/Tokyo)

あなたはNotiaの確認応答判定器です。

現在、Notiaはタスクの期限をユーザーに確認しています。
ユーザーの返答を、次のJSON形式で分類してください。

{
  "confirmationIntent": "set_due_date | no_due_date | cancel | unclear",
  "dueDate": "YYYY-MM-DD | null",
  "dueTime": "HH:mm | null"
}

判断ルール:

- 明日、7月15日、来週金曜日など
  → set_due_date

- 期限なし、期限はいらない、未定で登録
  → no_due_date

- やっぱりやめる、もういい、今回はなし、
  登録しなくていい、保留にする、忘れて
  → cancel

- 意味が判断できない
  → unclear

重要:

- 「やっぱなし」「今回はいい」「今はやめておく」など、
  表現が多少曖昧でも、タスク登録を撤回する意味ならcancelにする。
- no_due_dateは、タスク自体は登録し、期限だけ設定しない場合。
- cancelは、タスク自体を登録しない場合。
- 日付が判定できる場合はdueDateをYYYY-MM-DDで返す。
- 時間が指定された場合はdueTimeをHH:mmで返す。
- 値がない場合は必ずnullを返す。
- JSONのみ返す。
`;

  const userPrompt = `
現在の確認状態:
${JSON.stringify(context, null, 2)}

ユーザー発言:
${userMessage}
`;

  const response = await chatWithNotia(
    userPrompt,
    [],
    systemPrompt
  );

  try {
    const parsed = JSON.parse(response);

    const validIntents = [
      "set_due_date",
      "no_due_date",
      "cancel",
      "unclear",
    ];

    return {
      confirmationIntent: validIntents.includes(
        parsed.confirmationIntent
      )
        ? parsed.confirmationIntent
        : "unclear",
      dueDate: parsed.dueDate ?? null,
      dueTime: parsed.dueTime ?? null,
      
    };
  } catch (error) {
    console.error("確認応答の解析に失敗:", error);

    return {
      confirmationIntent: "unclear",
      dueDate: null,
      dueTime: null,
    };
  }
}

  safeParse(text) {
  try {
    const parsed = JSON.parse(text);

    let tasks = [];

    if (Array.isArray(parsed.tasks)) {
      tasks = parsed.tasks
        .filter(
          (task) =>
            task &&
            typeof task.title === "string" &&
            task.title.trim()
        )
        .map((task) => ({
          title: task.title.trim(),
          description: task.description ?? null,
          dueDate: task.dueDate ?? null,
          dueTime: task.dueTime ?? null,
          category: validateEnum(
  task.category,
  VALID_CATEGORIES
),
          notification: validateEnum(
  task.notification,
  VALID_NOTIFICATIONS
),
          needsDateConfirmation:
            task.needsDateConfirmation ?? false,
          dateExpression: task.dateExpression ?? null,
          priority:
  validateEnum(
    task.priority,
    VALID_PRIORITIES
  ) || "normal",
        }));
    }

    if (
      parsed.intent === "task_create" &&
      tasks.length === 0 &&
      typeof parsed.title === "string" &&
      parsed.title.trim()
    ) {
      tasks = [
        {
          title: parsed.title.trim(),
          description: parsed.description ?? null,
          dueDate: parsed.dueDate ?? null,
          dueTime: parsed.dueTime ?? null,
          category: parsed.category ?? null,
          notification: parsed.notification ?? null,
          needsDateConfirmation:
            parsed.needsDateConfirmation ?? false,
          dateExpression: parsed.dateExpression ?? null,
          priority: parsed.priority || "normal",
        },
      ];
    }

    return {
      intent:
  VALID_INTENTS.includes(parsed.intent)
    ? parsed.intent
    : "unknown",
      tasks,
      routine: parsed.routine
  ? {
      title:
        parsed.routine.title ?? null,

      dayOfWeek:
        parsed.routine.dayOfWeek ?? null,

      routineTime:
        parsed.routine.routineTime ?? null,

      category:
  validateEnum(
    parsed.routine.category,
    VALID_CATEGORIES
  ),

      googleCalendarEnabled:
        parsed.routine.googleCalendarEnabled ??
        false,
    }
  : null,
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
      scheduleQuery: {
  range:
    parsed.scheduleQuery?.range ?? null,

  target:
    parsed.scheduleQuery?.target ?? null,

  title:
    parsed.scheduleQuery?.title ?? null,
  dayOfWeek:
  parsed.scheduleQuery?.dayOfWeek ?? null,
},
      updates: {
        title: parsed.updates?.title ?? null,
        description: parsed.updates?.description ?? null,
        dueDate: parsed.updates?.dueDate ?? null,
        dueTime: parsed.updates?.dueTime ?? null,
        priority:
  validateEnum(
    parsed.updates?.priority,
    VALID_PRIORITIES
  ),

category:
  validateEnum(
    parsed.updates?.category,
    VALID_CATEGORIES
  ),

notification:
  validateEnum(
    parsed.updates?.notification,
    VALID_NOTIFICATIONS
  ),
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
      intent:
  VALID_INTENTS.includes(parsed.intent)
    ? parsed.intent
    : "unknown",
      tasks: [],
      routine: null,
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

      scheduleQuery: {
  range: null,
  target: null,
  title: null,
  dayOfWeek: null,
},

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