require("dotenv").config();

const chatRuntime = require("./src/runtime/ChatRuntime");
const express = require("express");
const path = require("path");
const taskListManager = require("./src/managers/TaskListManager");

const {
  getActiveTasks,
  getTasksByDate,
  getRecentlyCompletedTasks,
  getTaskById,
  updateTaskById,
  completeTask,
  restoreTaskById,
  deleteTaskById,
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

const VALID_PRIORITIES = ["high", "normal", "low"];

const VALID_NOTIFICATIONS = [
  "none",
  "same_day",
  "day_before",
];
const VALID_CATEGORIES = [
  "work",
  "school",
  "private",
  "shopping",
  "other",
];

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/tasks", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tasks.html"));
});

app.get("/calendar", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "calendar.html")
  );
});

app.get("/tasks/:id", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "task.html")
  );
});

app.get("/tasks-completed", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "tasks-completed.html")
  );
});


app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "message is required",
      });
    }

    const result = await chatRuntime.handleChat(message);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Notia error",
    });
  }
});

app.get("/api/calendar", (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: "date は必須です。",
      });
    }

    const tasks = taskListManager.formatTasksForApi(
      getTasksByDate(date)
    );

    return res.json(tasks);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "カレンダーの取得に失敗しました。",
    });
  }
});

app.get("/api/tasks", (req, res) => {
  try {
    const tasks = taskListManager.formatTasksForApi(
      getActiveTasks()
    );

    return res.json(tasks);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスク一覧の取得に失敗しました。",
    });
  }
});

app.get("/api/tasks/completed/recent", (req, res) => {
  try {
    const tasks = taskListManager.formatTasksForApi(
      getRecentlyCompletedTasks(5)
    );

    return res.json(tasks);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "完了済みタスクの取得に失敗しました。",
    });
  }
});

app.get("/api/tasks/:id", (req, res) => {
  try {
    const task = getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    const [formattedTask] =
      taskListManager.formatTasksForApi([task]);

    return res.json(formattedTask);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスクの取得に失敗しました。",
    });
  }
});

app.patch("/api/tasks/:id", (req, res) => {
  try {
    const existingTask = getTaskById(req.params.id);

    if (!existingTask) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    const {
      title,
      description,
      dueDate,
      dueTime,
      priority,
      category,
      notification,
    } = req.body;

    // タスク名
    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return res.status(400).json({
        error: "タスク名を入力してください。",
      });
    }

    // 優先度
    if (
      priority !== undefined &&
      !VALID_PRIORITIES.includes(priority)
    ) {
      return res.status(400).json({
        error: "優先度が正しくありません。",
      });
    }

    // 分類
    if (
      category !== undefined &&
      !VALID_CATEGORIES.includes(category)
    ) {
      return res.status(400).json({
        error: "分類が正しくありません。",
      });
    }

    // 時間
    if (
      dueTime !== undefined &&
      dueTime !== null &&
      dueTime !== "" &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)
    ) {
      return res.status(400).json({
        error: "時間の形式が正しくありません。",
      });
    }

    // 通知タイミング
    if (
      notification !== undefined &&
      !VALID_NOTIFICATIONS.includes(notification)
    ) {
      return res.status(400).json({
        error: "通知タイミングが正しくありません。",
      });
    }

    const updates = {};

    if (title !== undefined) {
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description =
        typeof description === "string"
          ? description.trim()
          : "";
    }

    if (dueDate !== undefined) {
      updates.dueDate = dueDate || null;
    }

    if (dueTime !== undefined) {
      updates.dueTime = dueTime || null;
    }

    if (priority !== undefined) {
      updates.priority = priority;
    }

    if (category !== undefined) {
      updates.category = category;
    }

    if (notification !== undefined) {
      updates.notification = notification;
    }

    const updated = updateTaskById(
      req.params.id,
      updates
    );

    if (!updated) {
      return res.status(400).json({
        error: "変更内容がありません。",
      });
    }

    const task = getTaskById(req.params.id);

    const [formattedTask] =
      taskListManager.formatTasksForApi([task]);

    return res.json({
      ok: true,
      task: formattedTask,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスクの更新に失敗しました。",
    });
  }
});

app.post("/api/tasks/:id/complete", (req, res) => {
  try {
    const task = getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    const completed = completeTask(req.params.id);

    return res.json({
      ok: completed,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスクの完了処理に失敗しました。",
    });
  }
});

app.post("/api/tasks/:id/restore", (req, res) => {
  try {
    const task = getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    if (task.status !== "completed") {
      return res.status(400).json({
        error: "このタスクは完了済みではありません。",
      });
    }

    const restored = restoreTaskById(req.params.id);

    return res.json({
      ok: restored,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスクの復元に失敗しました。",
    });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    const task = getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    const deleted = deleteTaskById(req.params.id);

    return res.json({
      ok: deleted,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスクの削除に失敗しました。",
    });
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Notia 起動: http://localhost:${PORT}`);
});