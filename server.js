require("dotenv").config();

const chatRuntime = require("./src/runtime/ChatRuntime");
const express = require("express");
const path = require("path");
const taskListManager = require("./src/managers/TaskListManager");

const {
  getActiveTasks,
  completeTask,
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/tasks", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tasks.html"));
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const result = await chatRuntime.handleChat(message);

    return res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Notia error" });
  }
});

app.get("/api/tasks", (req, res) => {
  const tasks = taskListManager.formatTasksForApi(getActiveTasks());

  res.json(tasks);
});

app.post("/api/tasks/:id/complete", (req, res) => {
  completeTask(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Notia 起動: http://localhost:${PORT}`);
});