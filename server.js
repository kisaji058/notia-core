require("dotenv").config();

const { processMemory } = require("./src/managers/MemoryManager");
const express = require("express");
const path = require("path");
const conversationAnalyzer = require("./src/analyzer/ConversationAnalyzer");

const conversationManager = require("./src/managers/ConversationManager");
const { chatWithNotia } = require("./openai");
const taskManager = require("./src/managers/TaskManager");
const {
  getRelevantMemories,
  formatMemoriesForPrompt,
} = require("./src/memory/MemoryRetriever");

const {
  saveConversation,
  getRecentConversations,
  addTask,
  getActiveTasks,
  completeTask,
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    saveConversation("user", message);

const activeTasks = getActiveTasks();

const analysis = await conversationAnalyzer.analyze(message, {
  source: "api/chat",
  activeTasks,
});

console.log("analysis:", analysis);

const taskResult = taskManager.handle(analysis);

processMemory(analysis);

const result = await conversationManager.handle(message, analysis);

if (result.handled) {
  saveConversation("assistant", result.reply);

  return res.json({
    reply: result.reply,
    analysis,
    taskResult,
  });
}

const recentMessages = getRecentConversations(10);

const relevantMemories = getRelevantMemories(message);
const memoryHint = formatMemoriesForPrompt(relevantMemories);

const systemHint = `
${result.systemHint || ""}

${memoryHint}
`;

const reply = await chatWithNotia(
  message,
  recentMessages,
  systemHint
);

    saveConversation("assistant", reply);

    return res.json({
  reply,
  analysis,
  taskResult,
});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Notia error" });
  }
});

app.get("/api/tasks", (req, res) => {
  const tasks = getActiveTasks();
  res.json(tasks);
});

app.post("/api/tasks/:id/complete", (req, res) => {
  completeTask(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Notia 起動: http://localhost:${PORT}`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Notia 起動: http://localhost:${PORT}`);
});