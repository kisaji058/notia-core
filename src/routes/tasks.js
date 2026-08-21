const express = require("express");

const taskListManager =
  require("../managers/TaskListManager");

const {
  addTask,
  getActiveTasks,
  getRecentlyCompletedTasks,
  getTaskById,
  updateTaskById,
  completeTask,
  restoreTaskById,
  deleteTaskById,
  convertTaskToEvent,
} = require("../../database");

const router = express.Router();

const VALID_PRIORITIES = [
  "important",
  "normal",
];

const VALID_NOTIFICATIONS = [
  "none",
  "same_day",
  "at_time",
  "10_minutes_before",
  "30_minutes_before",
  "1_hour_before",
  "day_before",
];

const VALID_CATEGORIES = [
  "work",
  "school",
  "private",
  "shopping",
  "other",
];

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

router.post("/tasks", (req, res) => {
  try {
    const {
  title,
  description = "",
  due_date: dueDate = null,
  due_time: dueTime = null,
  location = "",
  priority = "normal",
  category = "other",
  notification = "none",
} = req.body;

    const normalizedTitle =
      String(title || "").trim();

    if (!normalizedTitle) {
      return res.status(400).json({
        error: "タスク名を入力してください",
      });
    }

    if (
      !VALID_PRIORITIES.includes(priority)
    ) {
      return res.status(400).json({
        error: "優先度が不正です",
      });
    }

    if (
      !VALID_CATEGORIES.includes(category)
    ) {
      return res.status(400).json({
        error: "分類が不正です",
      });
    }

    if (
      !VALID_NOTIFICATIONS.includes(
        notification
      )
    ) {
      return res.status(400).json({
        error: "通知設定が不正です",
      });
    }

    const taskId = addTask(
      req.userId,
  normalizedTitle,
  String(description || "").trim(),
  dueDate || null,
  priority,
  category,
  dueTime || null,
  notification,
  "task",
  String(location || "").trim()
);

    const task = getTaskById(
  req.userId,
  taskId
);

    return res.status(201).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error(
      "Task creation error:",
      error
    );

    return res.status(500).json({
      error: "タスクの登録に失敗しました",
    });
  }
});


router.get("/tasks", (req, res) => {
  try {
    const tasks = taskListManager.formatSortedTasksForApi(
  getActiveTasks(
  req.userId
)
);

    return res.json(tasks);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "タスク一覧の取得に失敗しました。",
    });
  }
});

router.get("/tasks/completed/recent", (req, res) => {
  try {
    const tasks = taskListManager.formatTasksForApi(
      getRecentlyCompletedTasks(
  req.userId,
  50
)
    );

    return res.json(tasks);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "完了済みタスクの取得に失敗しました。",
    });
  }
});

router.get("/tasks/:id", (req, res) => {
  try {
    const task = getTaskById(
  req.userId,
  req.params.id
);

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

router.patch("/tasks/:id", (req, res) => {
  try {
    const existingTask = getTaskById(
  req.userId,
  req.params.id
);

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
  location,
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
      !TIME_PATTERN.test(dueTime)
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

    if (location !== undefined) {
  updates.location =
    typeof location === "string"
      ? location.trim()
      : "";
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
      req.userId,
      req.params.id,
      updates
    );

    if (!updated) {
      return res.status(400).json({
        error: "変更内容がありません。",
      });
    }

    const task = getTaskById(
  req.userId,
  req.params.id
);

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

router.post("/tasks/:id/complete", (req, res) => {
  try {
    const task = getTaskById(
  req.userId,
  req.params.id
);

    if (!task) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    const completed = completeTask(
  req.userId,
  req.params.id
);

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

router.post(
  "/tasks/:id/convert-to-event",
  (req, res) => {
    try {
      const task =
        getTaskById(
  req.userId,
  req.params.id
);

      if (!task) {
        return res.status(404).json({
          error:
            "タスクが見つかりません。",
        });
      }

      const {
        title,
        description,
        dueDate,
        dueTime,
      } = req.body || {};

      if (
        title !== undefined &&
        (
          typeof title !== "string" ||
          !title.trim()
        )
      ) {
        return res.status(400).json({
          error:
            "予定名を入力してください。",
        });
      }

      const eventDate =
        dueDate !== undefined
          ? dueDate
          : task.due_date;

      if (!eventDate) {
        return res.status(400).json({
          error:
            "予定へ変更するには日付が必要です。",
        });
      }

      if (
        !DATE_PATTERN.test(
          eventDate
        )
      ) {
        return res.status(400).json({
          error:
            "日付の形式が正しくありません。",
        });
      }

      if (
        dueTime !== undefined &&
        dueTime !== null &&
        dueTime !== "" &&
        !TIME_PATTERN.test(
          dueTime
        )
      ) {
        return res.status(400).json({
          error:
            "時間の形式が正しくありません。",
        });
      }

      const result =
  convertTaskToEvent(
    req.userId,
    req.params.id,
    {
      title:
        title !== undefined
          ? title.trim()
          : undefined,

      description:
        description !== undefined
          ? String(description).trim()
          : undefined,

      eventDate,

      startTime:
        dueTime !== undefined
          ? dueTime || null
          : undefined,
    }
  );
        

      if (!result.ok) {
        if (
          result.reason ===
          "date_required"
        ) {
          return res.status(400).json({
            error:
              "予定へ変更するには日付が必要です。",
          });
        }

        return res.status(404).json({
          error:
            "タスクが見つかりません。",
        });
      }

      return res.json({
        ok: true,
        eventId: result.eventId,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        error:
          "予定への変更に失敗しました。",
      });
    }
  }
);

router.post("/tasks/:id/restore", (req, res) => {
  try {
    const task = getTaskById(
  req.userId,
  req.params.id
);

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

    const restored = restoreTaskById(
  req.userId,
  req.params.id
);

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

router.delete("/tasks/:id", (req, res) => {
  try {
    const task = getTaskById(
  req.userId,
  req.params.id
);

    if (!task) {
      return res.status(404).json({
        error: "タスクが見つかりません。",
      });
    }

    const deleted = deleteTaskById(
  req.userId,
  req.params.id
);

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

module.exports = router;
