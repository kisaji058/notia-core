const conversationAnalyzer = require("../analyzer/ConversationAnalyzer");
const conversationManager = require("../managers/ConversationManager");
const taskManager = require("../managers/TaskManager");
const taskListManager = require("../managers/TaskListManager");
const responseManager = require("../managers/ResponseManager");
const promptBuilder = require("../managers/PromptBuilder");
const { processMemory } = require("../managers/MemoryManager");
const { chatWithNotia } = require("../../openai");
const conversationContextBuilder = require("../builders/ConversationContextBuilder");
const referenceResolver = require("../resolvers/ConversationReferenceResolver");

const {
  saveConversation,
  getRecentConversations,
  getActiveTasks,
} = require("../../database");

async function handleChat(message) {
  saveConversation("user", message);

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

  console.log("analysis:", analysis);

  if (taskListManager.isTaskListRequest(message)) {
    const tasks = getActiveTasks();
    const reply = taskListManager.createTaskListReply(tasks);

    saveConversation("assistant", reply);

    return {
      reply,
      analysis,
      taskResult: null,
    };
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

  const conversationResult = await conversationManager.handle(message, analysis);

  if (conversationResult.handled) {
    saveConversation("assistant", conversationResult.reply);

    return {
      reply: conversationResult.reply,
      analysis: conversationResult.analysis || analysis,
      taskResult: conversationResult.taskResult || null,
    };
  }

  const taskResult = taskManager.handle(analysis);

  const taskReply = responseManager.createTaskResultReply(taskResult, analysis);

  if (taskReply) {
    saveConversation("assistant", taskReply);

    return {
      reply: taskReply,
      analysis,
      taskResult,
    };
  }

const systemHint = promptBuilder.createSystemHint(
  message,
  conversationResult
);

const prompt = promptBuilder.build({
  context,
  systemHint,
});

const reply = await chatWithNotia(message, [], prompt);


  saveConversation("assistant", reply);

  return {
    reply,
    analysis,
    taskResult,
  };
}

module.exports = {
  handleChat,
};