const sessionManager = require("../session/SessionManager");
const taskManager = require("./TaskManager");
const conversationAnalyzer = require("../analyzer/ConversationAnalyzer");
const ConversationIntentHelper = require("../utils/ConversationIntentHelper");

class ConversationManager {
  async handle(message, analysis, userId = "default") {
    const session = sessionManager.get(userId);

    // =====================
// 1. 時間確認待ちへの回答
// =====================
if (
  session.mode === "waiting_due_time"
) {
  // 時間確認中でも、
// 新しいタスク・予定・ルーティーンの発言なら
// 時間回答として扱わず通常処理へ戻す
const isNewRequest =
  analysis?.intent === "task_create" ||
  analysis?.intent === "routine_create";

if (isNewRequest) {
  sessionManager.clear(userId);

  return {
    handled: false,
    systemHint: "",
    analysis,
  };
}
  const pendingTasks =
    Array.isArray(session.pendingTasks)
      ? session.pendingTasks
      : session.targetTaskId
        ? [
            {
              id: session.targetTaskId,
              title:
                session.targetTaskTitle ||
                "タスク",
            },
          ]
        : [];

  const currentTaskIndex =
    session.currentTaskIndex ?? 0;

  const currentTask =
    pendingTasks[currentTaskIndex];

  if (!currentTask) {
    sessionManager.clear(userId);

    return {
      handled: false,
      systemHint: "",
      analysis,
    };
  }

  let wantsNoDueTime =
    ConversationIntentHelper.isNoDueTime(
      message
    );

  let wantsCancel =
    !wantsNoDueTime &&
    ConversationIntentHelper.isCancel(
      message
    );

  let analyzedDueTime =
    ConversationIntentHelper.parseDueTime(
      message
    ) ??
    analysis.updates?.dueTime ??
    analysis.dueTime ??
    null;

  if (
    !wantsNoDueTime &&
    !wantsCancel &&
    !analyzedDueTime
  ) {
    const confirmation =
      await conversationAnalyzer
        .analyzeDueTimeConfirmation(
          message,
          {
            mode: session.mode,
            task: {
              id: currentTask.id,
              title:
                currentTask.title ||
                null,
            },
          }
        );

    if (
      confirmation.confirmationIntent ===
      "no_due_time"
    ) {
      wantsNoDueTime = true;
    }

    if (
      confirmation.confirmationIntent ===
      "cancel"
    ) {
      wantsCancel = true;
    }

    if (
      confirmation.confirmationIntent ===
      "set_due_time"
    ) {
      analyzedDueTime =
        ConversationIntentHelper
          .parseDueTime(
            confirmation.dueTime
          );
    }
  }

  if (wantsCancel) {
    sessionManager.clear(userId);

    return {
      handled: true,
      reply:
        "承知しました。時間の設定を取りやめました。",
      analysis: {
        ...analysis,
        intent: "general_chat",
      },
      taskResult: null,
    };
  }

  if (
    !wantsNoDueTime &&
    !analyzedDueTime
  ) {
    return {
      handled: true,
      reply: [
        "すみません、時間を読み取れませんでした。",
        "「18時」「18時30分」または「未定」のように教えてください。",
      ].join("\n"),
      analysis,
      taskResult: null,
    };
  }

  let result = null;

  if (!wantsNoDueTime) {
    const fixedAnalysis = {
      ...analysis,
      intent: "task_update",
      targetTaskId:
        currentTask.id,
      targetTaskTitle:
        currentTask.title || null,
      updates: {
        dueTime: analyzedDueTime,
      },
    };

    result =
      taskManager.handle(
        fixedAnalysis
      );
  }

  const nextTaskIndex =
    currentTaskIndex + 1;

  const nextTask =
    pendingTasks[nextTaskIndex];

  const currentReply =
    wantsNoDueTime
      ? `「${currentTask.title}」は時間未定のままにしておきます。`
      : `「${currentTask.title}」の時間を${analyzedDueTime}に設定しました。`;

  if (nextTask) {
    sessionManager.set(
      userId,
      {
        mode:
          "waiting_due_time",
        pendingTasks,
        currentTaskIndex:
          nextTaskIndex,
      }
    );

    return {
      handled: true,
      reply: [
        currentReply,
        "",
        `続いて「${nextTask.title}」の時間は決まっていますか？`,
        "未定の場合は「未定」と言ってください。",
      ].join("\n"),
      analysis,
      taskResult: result,
    };
  }

  sessionManager.clear(userId);

  return {
    handled: true,
    reply: [
      "承知しました。",
      currentReply,
      "",
      "必要であれば、通知も設定できます。",
    ].join("\n"),
    analysis,
    taskResult: result,
  };
}

    // =====================
    // 1. 期限確認待ちへの回答
    // =====================
    if (
  session.mode === "waiting_due_dates" &&
  Array.isArray(session.pendingTasks)
) {
  const pendingTasks = session.pendingTasks;
  const currentTaskIndex = session.currentTaskIndex ?? 0;
  const currentTask = pendingTasks[currentTaskIndex];

  if (!currentTask) {
    sessionManager.clear(userId);

    return {
      handled: false,
      systemHint: "",
      analysis,
    };
  }

  let wantsNoDueDate =
  ConversationIntentHelper.isNoDueDate(message);

let wantsCancel =
  !wantsNoDueDate &&
  ConversationIntentHelper.isCancel(message);

let analyzedDueDate =
  analysis.updates?.dueDate ??
  analysis.dueDate ??
  null;

let analyzedDueTime =
  analysis.updates?.dueTime ??
  analysis.dueTime ??
  null;

// ルール判定でも日付解析でも判断できなかった場合だけ、
// AIによる確認応答判定を行う
if (
  !wantsNoDueDate &&
  !wantsCancel &&
  !analyzedDueDate
) {
  const confirmation =
    await conversationAnalyzer.analyzeConfirmation(
      message,
      {
        mode: session.mode,
        task: {
          title: currentTask.title,
          description: currentTask.description ?? null,
        },
      }
    );

  if (confirmation.confirmationIntent === "cancel") {
    wantsCancel = true;
  }

  if (
    confirmation.confirmationIntent === "no_due_date"
  ) {
    wantsNoDueDate = true;
  }

  if (
    confirmation.confirmationIntent === "set_due_date"
  ) {
    analyzedDueDate =
      confirmation.dueDate ?? analyzedDueDate;

    analyzedDueTime =
      confirmation.dueTime ?? analyzedDueTime;
  }
}

if (wantsCancel) {
  sessionManager.clear(userId);

  return {
    handled: true,
    reply: "承知しました。タスクの登録を取り消しました。",
    analysis: {
      ...analysis,
      intent: "chat",
    },
    taskResult: null,
  };
}

if (!analyzedDueDate && !wantsNoDueDate) {
  return {
    handled: true,
    reply: [
      "すみません、期限の日付がうまく読み取れませんでした。",
      "「明日」「7月15日」「期限なし」のように教えてください。",
    ].join("\n"),
    analysis,
  };
}

  pendingTasks[currentTaskIndex] = {
    ...currentTask,
    dueDate: wantsNoDueDate
      ? null
      : analyzedDueDate,
    dueTime:
  analyzedDueTime ??
  currentTask.dueTime ??
  null,
    needsDateConfirmation: false,
    dateExpression: null,
  };

  const nextTaskIndex = pendingTasks.findIndex(
    (task, index) =>
      index > currentTaskIndex &&
      task.needsDateConfirmation
  );

  if (nextTaskIndex !== -1) {
    sessionManager.set(userId, {
      mode: "waiting_due_dates",
      pendingTasks,
      currentTaskIndex: nextTaskIndex,
    });

    const nextTask = pendingTasks[nextTaskIndex];

    return {
      handled: true,
      reply: [
        `「${currentTask.title}」の期限を設定しました。`,
        `続いて「${nextTask.title}」の期限はいつにしますか？`,
        "期限なしの場合は「期限なし」と言ってください。",
      ].join("\n"),
      analysis,
    };
  }

  const firstTask = pendingTasks[0];

  const fixedAnalysis = {
    ...analysis,
    intent: "task_create",
    tasks: pendingTasks,

    title: firstTask?.title ?? null,
    description: firstTask?.description ?? null,
    dueDate: firstTask?.dueDate ?? null,
    dueTime: firstTask?.dueTime ?? null,
    priority: firstTask?.priority ?? "normal",
    category: firstTask?.category ?? null,
    notification: firstTask?.notification ?? null,

    needsDateConfirmation: false,
    dateExpression: null,
  };

  const result = taskManager.handle(fixedAnalysis);

  sessionManager.clear(userId);

  const registeredTasks = pendingTasks
    .map((task) => {
      const dueText = task.dueDate || "期限なし";
      return `・${task.title}（${dueText}）`;
    })
    .join("\n");

  return {
    handled: true,
    reply: [
      "承知しました。以下のタスクを登録しました。",
      registeredTasks,
    ].join("\n"),
    analysis: fixedAnalysis,
    taskResult: result,
  };
}

    // =====================
    // 2. 期限確認が必要
    // =====================

    // 新規タスクの場合
    if (analysis.intent === "task_create") {
  const tasks =
    Array.isArray(analysis.tasks) &&
    analysis.tasks.length > 0
      ? analysis.tasks
      : [
          {
            title: analysis.title,
            description: analysis.description,
            dueDate: analysis.dueDate,
            dueTime: analysis.dueTime,
            priority: analysis.priority,
            category: analysis.category,
            notification: analysis.notification,
            needsDateConfirmation:
              analysis.needsDateConfirmation,
            dateExpression: analysis.dateExpression,
          },
        ];

  const firstTaskIndex = tasks.findIndex(
    (task) => task.needsDateConfirmation
  );

  if (firstTaskIndex !== -1) {
    sessionManager.set(userId, {
      mode: "waiting_due_dates",
      pendingTasks: tasks,
      currentTaskIndex: firstTaskIndex,
    });

    const firstTask = tasks[firstTaskIndex];

    return {
      handled: true,
      reply: [
        `「${firstTask.title}」の期限はいつにしますか？`,
        "期限なしで登録する場合は「期限なし」と言ってください。",
      ].join("\n"),
      analysis,
    };
  }
}

    // 既存タスク更新の場合
    if (
      analysis.intent === "task_update" &&
      analysis.needsDateConfirmation
    ) {
      sessionManager.set(userId, {
        mode: "waiting_due_dates",
        pendingIntent: "task_update",

        pendingTasks: [
          {
            intent: analysis.intent,
            title: analysis.title,
            description: analysis.description,
            priority: analysis.priority,
            category: analysis.category,
            dueTime: analysis.dueTime,
            notification: analysis.notification,
            targetTaskId: analysis.targetTaskId,
            targetTaskTitle: analysis.targetTaskTitle,
            updates: analysis.updates || null,
            needsDateConfirmation:
              analysis.needsDateConfirmation,
            dateExpression:
              analysis.dateExpression,
          },
        ],
      });

      return {
        handled: true,
        reply: `「${analysis.dateExpression}」とのことですが、期限は何日を想定していますか？`,
        analysis,
      };
    }

    // =====================
    // 3. 通常は未処理
    // =====================
    return {
      handled: false,
      systemHint: "",
      analysis,
    };
  }
}

module.exports = new ConversationManager();