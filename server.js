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

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "期限なし";
  }

  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const dueDateObj = new Date(`${dueDate}T00:00:00+09:00`);

  const diffDays = Math.round(
    (dueDateObj - todayDate) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `期限超過（${Math.abs(diffDays)}日）`;
  }

  if (diffDays === 0) {
    return "本日中";
  }

  if (diffDays === 1) {
    return "明日";
  }

  if (diffDays === 2) {
    return "明後日";
  }

  return dueDate;
}

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

if (
  message.includes("タスク一覧") ||
  message.includes("タスクを見せて") ||
  message.includes("タスク見せて") ||
  message.includes("タスク確認") ||
  message.includes("期日を日付で") ||
  message.includes("期限を日付で")
) {
  const tasks = getActiveTasks();

const reply = tasks.length === 0
  ? "現在、未完了のタスクはありません。"
  : tasks.map((task, index) => {
      const due = formatDueDate(task.due_date);
      return `${index + 1}. ${due}：${task.title}`;
    }).join("\n");

  saveConversation("assistant", reply);

  return res.json({
    reply,
    analysis,
    taskResult: null,
  });
}

processMemory(analysis);

const result = await conversationManager.handle(message, analysis);

if (result.handled) {
  saveConversation("assistant", result.reply);

  return res.json({
    reply: result.reply,
    analysis: result.analysis || analysis,
    taskResult: result.taskResult || null,
  });
}



const taskResult = taskManager.handle(analysis);

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
  const tasks = getActiveTasks().map((task) => ({
    ...task,
    due_date_label: formatDueDate(task.due_date),
  }));

  res.json(tasks);
});

app.post("/api/tasks/:id/complete", (req, res) => {
  completeTask(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Notia 起動: http://localhost:${PORT}`);
});