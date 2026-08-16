const conversationAnalyzer = require("../analyzer/ConversationAnalyzer");
const conversationManager = require("../managers/ConversationManager");
const taskManager = require("../managers/TaskManager");
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
  !isExplicitCompletion
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

  if (
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