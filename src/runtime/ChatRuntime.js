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
  reply,
  analysis,
  taskResult = null
) {
  saveConversation(
    "assistant",
    reply
  );

  return {
    reply,
    analysis,
    taskResult,
  };
}

async function handleChat(message) {
  saveConversation("user", message);

// =====================
// 初期化
// =====================

const activeTasks = getActiveTasks();
const recentMessages = getRecentConversations(10);

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
    const tasks = getActiveTasks();
    const reply = taskListManager.createTaskListReply(tasks);

    return createReply(
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

  const conversationResult = await conversationManager.handle(message, analysis);

  if (conversationResult.handled) {
  return createReply(
    conversationResult.reply,
    conversationResult.analysis ||
      analysis,
    conversationResult.taskResult ||
      null
  );
}

 const memoryResult = await resolve(message, {
  analysis,
  activeTasks,
  conversations: recentMessages,
});

console.log(
  "memoryResult:",
  memoryResult
);

if (
  memoryResult?.handled &&
  memoryResult.reply
) {
  return createReply(
    memoryResult.reply,
    analysis
  );
}

// =====================
// Task処理
// =====================

const taskResult =
  taskManager.handle(analysis);

const taskReply =
  responseManager.createTaskResultReply(
    taskResult,
    analysis
  );

  if (
  taskResult?.created &&
  analysis.dueDate &&
  !analysis.dueTime &&
  taskResult.createdTasks?.length > 0
) {
  const createdTask =
    taskResult.createdTasks[0];

  const sessionManager =
    require("../session/SessionManager");

  sessionManager.set("default", {
    mode: "waiting_due_time",
    targetTaskId: createdTask.id,
    targetTaskTitle: createdTask.title,
  });
}

if (taskReply) {
  return createReply(
    taskReply,
    analysis,
    taskResult
  );
}

// =====================
// AI応答
// =====================

const systemHint = promptBuilder.createSystemHint(
  message,
  conversationResult
);

const prompt = promptBuilder.build({
  context,
  systemHint,
});

const reply = await chatWithNotia(message, [], prompt);


  return createReply(
  reply,
  analysis
);
}

module.exports = {
  handleChat,
};