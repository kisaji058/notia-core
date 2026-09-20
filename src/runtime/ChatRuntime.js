const conversationAnalyzer = require("../analyzer/ConversationAnalyzer");
const conversationManager = require("../managers/ConversationManager");
const taskManager = require("../managers/TaskManager");

const sessionManager =
  require("../session/SessionManager");

const taskListManager = require("../managers/TaskListManager");
const responseManager = require("../managers/ResponseManager");
const promptBuilder = require("../managers/PromptBuilder");
const {
  processMemory,
  resolve,
} = require("../managers/MemoryManager");
const { chatWithNotia } = require("../../openai");
const conversationContextBuilder = require("../builders/ConversationContextBuilder");
const referenceResolver = require("../resolvers/ConversationReferenceResolver");

const {
  saveConversation,
  getRecentConversations,
  getActiveTasks,
} = require("../../database");

const EXPLICIT_COMPLETION_PATTERNS = [
  "完了",
  "終わった",
  "終わりました",
  "終えた",
  "終えました",
  "済んだ",
  "済みました",
  "やり終えた",
  "片付いた",
];

const DECLINE_PATTERNS = [
  "しなくていい",
  "しなくて大丈夫",
  "いらない",
  "不要",
  "設定しなくていい",
  "今回はいい",
  "やらなくていい",
];

function includesAny(text, patterns) {
  return patterns.some((pattern) =>
    text.includes(pattern)
  );
}

function getPreviousAssistantMessage(
  conversations
) {
  for (
    let index = conversations.length - 1;
    index >= 0;
    index -= 1
  ) {
    const conversation =
      conversations[index];

    if (
      conversation.role === "assistant"
    ) {
      return conversation.message || "";
    }
  }

  return "";
}


function createReply(
  userId,
  reply,
  analysis,
  taskResult = null
) {
  saveConversation(
    userId,
    "assistant",
    reply
  );

  return {
    reply,
    analysis,
    taskResult,
  };
}

async function handleChat(
  message,
  userId
) {
  if (!userId) {
    throw new Error(
      "ChatRuntime: userId is required"
    );
  }

  saveConversation(
    userId,
    "user",
    message
  );

  // ===== Quick Task Registration Flow =====

  const quickSession = sessionManager.get(userId);

  if (quickSession.mode === "quick_task_create") {
    const pending = quickSession.pendingTask || {
      title: null,
      dueDate: null,
      dueTime: null,
      notification: null,
      noDueDate: false,
    };

    const parsed =
      await conversationAnalyzer.analyzeQuickTask(
        message,
        pending
      );

    // AI解析に失敗した場合は登録を進めない
    if (parsed.parseError) {
      return createReply(
        userId,
        "すみません、内容をうまく読み取れませんでした。もう一度教えてください。",
        { intent: "chat" }
      );
    }

    // 通知確認中の短い回答を明確に処理する
    if (quickSession.step === "waiting_notification") {
      const answer = message.trim();

      if (
        /^(なし|不要|いらない|通知なし|通知しない|しない)$/.test(answer)
      ) {
        parsed.notification = "none";
        parsed.cancel = false;
      }

      if (/^(当日|当日に|当日通知)$/.test(answer)) {
        parsed.notification = "same_day";
      }

      if (/^(前日|前日に|前日通知)$/.test(answer)) {
        parsed.notification = "day_before";
      }
    }

    // 期限確認中の短い回答を補正する
    if (quickSession.step === "waiting_date") {
      const answer = message.trim();

      if (
        /^(なし|期限なし|期日なし|未定|日付なし|設定しない)$/.test(answer)
      ) {
        parsed.noDueDate = true;
        parsed.dueDate = null;
        parsed.dueTime = null;
        parsed.cancel = false;
      }
    }

    if (parsed.cancel) {
      sessionManager.clear(userId);

      return createReply(
        userId,
        "承知しました。タスクの登録を中止しました。",
        { intent: "chat" }
      );
    }

    const task = {
      ...pending,

      // タスク名は最初の回答で確定させる
      title:
        quickSession.step === "waiting_title"
          ? parsed.title || pending.title
          : pending.title,

      // 日時は追加回答でも更新できる
      dueDate:
        parsed.dueDate || pending.dueDate,

      dueTime:
        parsed.dueTime || pending.dueTime,

      // 通知設定は明示された場合だけ更新する
      notification:
        parsed.notification !== null
          ? parsed.notification
          : pending.notification,

      noDueDate:
        parsed.noDueDate || pending.noDueDate,
    };

    if (parsed.noDueDate) {
      task.noDueDate = true;
      task.dueDate = null;
      task.dueTime = null;
    } else if (parsed.dueDate) {
      task.noDueDate = false;
      task.dueDate = parsed.dueDate;
    } else if (task.noDueDate) {
      task.dueDate = null;
      task.dueTime = null;
    }

    if (!task.title) {
      sessionManager.set(userId, {
        mode: "quick_task_create",
        step: "waiting_title",
        pendingTask: task,
      });

      return createReply(
        userId,
        "タスク名を教えてください。",
        { intent: "chat" }
      );
    }

    if (!task.dueDate && !task.noDueDate) {
      sessionManager.set(userId, {
        mode: "quick_task_create",
        step: "waiting_date",
        pendingTask: task,
      });

      return createReply(
        userId,
        "いつまでに行いますか？期限なしの場合は「期限なし」と教えてください。",
        { intent: "chat" }
      );
    }

    if (task.notification === null) {
      sessionManager.set(userId, {
        mode: "quick_task_create",
        step: "waiting_notification",
        pendingTask: task,
      });

      return createReply(
        userId,
        "通知は設定しますか？「なし」「当日」「前日」などで教えてください。",
        { intent: "chat" }
      );
    }

    const fixedAnalysis = {
      intent: "task_create",
      tasks: [{
        title: task.title,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        notification: task.notification,
        priority: "normal",
        category: "other",
        itemType: "task",
      }],
    };

    const result = taskManager.handle(
      fixedAnalysis,
      userId
    );

    sessionManager.clear(userId);

    if (!result?.created) {
      return createReply(
        userId,
        result?.duplicated
          ? "同じ内容のタスクがすでに登録されています。"
          : "タスクを登録できませんでした。もう一度お試しください。",
        { intent: "chat" },
        result
      );
    }

    const dueText = task.noDueDate
      ? "期限なし"
      : task.dueDate +
        (task.dueTime ? " " + task.dueTime : "");

    const notificationLabels = {
      none: "通知なし",
      same_day: "当日通知",
      day_before: "前日通知",
      at_time: "指定時刻に通知",
      "10_minutes_before": "10分前に通知",
      "30_minutes_before": "30分前に通知",
      "1_hour_before": "1時間前に通知",
    };

    const notificationText =
      notificationLabels[task.notification] ||
      "通知なし";

    return createReply(
      userId,
      "「" + task.title + "」を" +
      dueText +
      "、" +
      notificationText +
      "で登録しました。",
      fixedAnalysis,
      result
    );
  }



// =====================
// 初期化
// =====================

const activeTasks =
  getActiveTasks(userId);

const recentMessages =
  getRecentConversations(
    userId,
    10
  );

const context = conversationContextBuilder.build({
  conversations: recentMessages,
  activeTasks,
});

const resolvedReference = referenceResolver.resolve(message, context);

const analysis = await conversationAnalyzer.analyze(message, {
  source: "api/chat",
  activeTasks,
  context,
  resolvedReference,
});

// =====================
// 前処理
// =====================

  const previousAssistantMessage =
  getPreviousAssistantMessage(
    recentMessages
  );

const isExplicitCompletion =
  includesAny(
    message,
    EXPLICIT_COMPLETION_PATTERNS
  );

const isDecliningSuggestion =
  includesAny(
    message,
    DECLINE_PATTERNS
  );

  if (
  isDecliningSuggestion &&
  previousAssistantMessage.includes("通知")
) {
  const reply =
    "承知しました。通知は設定しません。";

  saveConversation(
    userId,
    "assistant",
    reply
  );

  return {
    reply,
    analysis: {
      ...analysis,
      intent: "notification_declined",
    },
    taskResult: null,
  };
}

if (
  analysis.intent === "task_complete" &&
  !isExplicitCompletion &&
  !analysis.targetTaskId
) {
  console.warn(
    "曖昧な完了判定を無効化しました。",
    {
      message,
      previousAssistantMessage,
      originalIntent: analysis.intent,
    }
  );

  analysis.intent = "general_chat";
  analysis.targetTaskTitle = null;
}

  if (taskListManager.isTaskListRequest(message)) {
    const tasks =
  getActiveTasks(userId);
    const reply = taskListManager.createTaskListReply(tasks);

    return createReply(
  userId,
  reply,
  analysis
);
  }

  processMemory(analysis);

  const normalizedMessage =
    String(message || "")
      .replace(/\s+/g, "");

  const explicitlyRequestsUnscheduledTask =
    analysis.intent === "task_create" &&
    (
      normalizedMessage.includes(
        "時間未設定タスク"
      ) ||
      normalizedMessage.includes(
        "時間未定タスク"
      ) ||
      normalizedMessage.includes(
        "時間指定なしタスク"
      )
    );

  if (explicitlyRequestsUnscheduledTask) {

    analysis.dueTime = null;
    analysis.needsDateConfirmation = false;
    analysis.dateExpression = null;

    if (Array.isArray(analysis.tasks)) {

      analysis.tasks =
        analysis.tasks.map((task) => ({
          ...task,
          dueTime: null,
          needsDateConfirmation: false,
          dateExpression: null,
        }));

    }

  } else if (
    analysis.intent === "task_create" &&
    !analysis.dueDate &&
    !analysis.needsDateConfirmation
  ) {

    analysis.needsDateConfirmation = true;
    analysis.dateExpression = "期限未指定";

  }

// =====================
// Resolver
// =====================

  const conversationResult =
  await conversationManager.handle(
    message,
    analysis,
    userId
  );

  if (conversationResult.handled) {
  return createReply(
    userId,
    conversationResult.reply,
    conversationResult.analysis ||
      analysis,
    conversationResult.taskResult ||
      null
  );
}

 const memoryResult = await resolve(
  message,
  {
    analysis,
    activeTasks,
    conversations: recentMessages,
  },
  userId
);

console.log(
  "memoryResult:",
  memoryResult
);

if (
  memoryResult?.handled &&
  memoryResult.reply
) {
  return createReply(
    userId,
    memoryResult.reply,
    analysis
  );
}

// =====================
// Task処理
// =====================

const taskResult =
  taskManager.handle(
    analysis,
    userId
  );

const taskReply =
  responseManager.createTaskResultReply(
    taskResult,
    analysis
  );

  if (
  taskResult?.created &&
  Array.isArray(taskResult.createdTasks)
) {
  const pendingDueTimeTasks =
  taskResult.createdTasks
    .filter(
      (task) =>
        task.itemType !== "event" &&
        task.dueDate &&
        !task.dueTime
    )
      .map((task) => ({
        id: task.id,
        title: task.title,
      }));

  if (pendingDueTimeTasks.length > 0) {
    const sessionManager =
      require("../session/SessionManager");

    sessionManager.set(userId, {
      mode: "waiting_due_time",
      pendingTasks:
        pendingDueTimeTasks,
      currentTaskIndex: 0,
    });
  }
}

if (taskReply) {
  return createReply(
    userId,
    taskReply,
    analysis,
    taskResult
  );
}

// =====================
// AI応答
// =====================

const systemHint =
  promptBuilder.createSystemHint(
    userId,
    message
  );

const prompt = promptBuilder.build({
  context,
  systemHint,
});

const reply = await chatWithNotia(message, [], prompt);


  return createReply(
    userId,
  reply,
  analysis
);
}

module.exports = {
  handleChat,
};