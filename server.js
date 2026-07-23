require("dotenv").config();

const chatRuntime = require("./src/runtime/ChatRuntime");
const express = require("express");
const path = require("path");
const taskListManager = require("./src/managers/TaskListManager");
const googleAuthRouter = require("./src/routes/googleAuth");
const googleProvider =
  require("./src/calendar/providers/GoogleCalendarProvider");

const {
  saveConversation,
  getRecentConversations,
  getRoutineById,
  getEventsByDate,
} = require("./database");

const {
  syncGoogleCalendar,
} = require("./src/managers/CalendarSyncManager");
const notificationManager = require("./src/managers/NotificationManager");

const {
  getActiveTasks,
  getTasksByDate,
  getExternalCalendarEventsByDate,
  getRecentlyCompletedTasks,
  getTaskById,
  updateTaskById,
  completeTask,
  restoreTaskById,
  deleteTaskById,
  getGoogleIntegration,
  getActiveRoutines,
  createRoutine,
  updateRoutineById,
  deleteRoutineById,
  getTodayRoutines,
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const notificationClients = new Set();

const VALID_PRIORITIES = [
  "important",
  "normal",
];

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

app.get(
  "/api/notifications/stream",
  (req, res) => {
    console.log("SSE client connected");
    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.flushHeaders();

res.write(": connected\n\n");

    notificationClients.add(res);

    req.on("close", () => {
      notificationClients.delete(res);
    });
  }
);

app.get("/api/conversations", (req, res) => {
  const conversations = getRecentConversations(100);
  res.json(conversations);
});

app.get("/api/integrations", (req, res) => {
  try {
    const google = getGoogleIntegration();

    if (!google) {
      return res.json({
        google: {
          connected: false,
        },
      });
    }

    res.json({
      google: {
        connected: true,
        email: google.email,
        connectedAt: google.connected_at,
        lastSync: google.last_sync_at,
      },
    });
  } catch (error) {
    console.error(
      "Integration status error:",
      error
    );

    res.status(500).json({
      error: "連携状態取得失敗",
    });
  }
});

app.use("/auth", googleAuthRouter);

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

app.get("/today", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "today.html"
    )
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

app.get(
  "/routines",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "routines.html"
      )
    );
  }
);


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

app.post("/api/calendar/sync", async (req, res) => {
  try {
    const result = await syncGoogleCalendar();

    res.json({
  success: true,
  importedEvents:
    result.importedEvents,
  exportedTasks:
    result.exportedTasks,
  exportedRoutines:
    result.exportedRoutines,
});
  } catch (error) {
    console.error(
      "Calendar sync error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Google Calendarとの同期に失敗しました。",
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

    const tasks =
      taskListManager.formatTasksForApi(
        getTasksByDate(date)
      );

    const externalEvents =
      getExternalCalendarEventsByDate(
        "google",
        date
      );

    return res.json({
      tasks,
      externalEvents,
    });
  } catch (error) {
    console.error(
      "Calendar fetch error:",
      error
    );

    return res.status(500).json({
      error:
        "カレンダーの取得に失敗しました。",
    });
  }
});

app.get("/api/today", (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: "date は必須です。",
      });
    }

    const tasks =
      taskListManager.formatTasksForApi(
        getTasksByDate(date)
      );

    const overdueTasks =
  taskListManager
    .formatTasksForApi(
      getActiveTasks()
    )
    .filter(
      (task) =>
        task.due_date &&
        task.due_date < date
    );

    const normalizedTasks = tasks.map(
  (task) => ({
    id: task.id,
    type: "task",
    source: "notia",

    title: task.title,
    description: task.description,

    startTime: task.due_time,
    endTime: null,

    subtitle:
      task.priority === "important"
        ? "重要タスク"
        : "通常タスク",

    location: null,

    dueDate: task.due_date,
    priority: task.priority,
    status: task.status,
  })
);

    const events =
      getEventsByDate(date);

    const externalEvents =
      getExternalCalendarEventsByDate(
        "google",
        date
      );

    const routines =
      getTodayRoutines();

    const schedule = [
      ...events.map((event) => ({
        id: event.id,
        type: "event",
        source: "notia",
        title: event.title,
        description:
          event.description,
        startTime:
          event.start_time,
        endTime:
          event.end_time,
        subtitle: "Notia",
        location:
          event.location,
      })),

      ...externalEvents.map((event) => ({
        id:
          event.external_event_id,
        type: "event",
        source: "google",
        title: event.title,
        description:
          event.description,

        startTime: event.is_all_day
          ? null
          : event.start_datetime
              ?.slice(11, 16),

        endTime: event.is_all_day
          ? null
          : event.end_datetime
              ?.slice(11, 16),

        subtitle:
          "Google Calendar",
        location:
          event.location,
        isAllDay:
          Boolean(event.is_all_day),
      })),

      ...routines.map((routine) => ({
        id: routine.id,
        type: "routine",
        source: "notia",
        title: routine.title,
        description: null,
        startTime:
          routine.routine_time,
        endTime: null,
        subtitle:
          "毎週のルーティーン",
        location: null,
      })),
    ];

    const timeline = [
  ...normalizedTasks,
  ...schedule,
];

timeline.sort((a, b) => {
  const timeA = a.startTime ?? "99:99";
  const timeB = b.startTime ?? "99:99";

  return timeA.localeCompare(timeB);
});

    return res.json({
  timeline,
  overdueTasks,
});
  } catch (error) {
    console.error(
      "Today fetch error:",
      error
    );

    return res.status(500).json({
      error:
        "Todayデータの取得に失敗しました。",
    });
  }
});

app.get("/api/tasks/completed", (req, res) => {
  try {
    const tasks = taskListManager.formatTasksForApi(
      getRecentlyCompletedTasks(50)
    );

    return res.json(tasks);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "完了タスクの取得に失敗しました。",
    });
  }
});

app.get("/api/tasks", (req, res) => {
  try {
    const tasks = taskListManager.formatSortedTasksForApi(
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
      getRecentlyCompletedTasks(50)
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

app.delete(
  "/api/routines/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ルーティーンIDが正しくありません。",
        });
      }

      const routine =
        getRoutineById(id);

      if (!routine) {
        return res.status(404).json({
          error:
            "ルーティーンが見つかりません。",
        });
      }

      if (
        routine.google_calendar_enabled &&
        routine.google_event_id
      ) {
        try {
          await googleProvider
            .deleteRecurringEvent(
              routine.google_event_id
            );
        } catch (error) {
          console.error(
            "Google routine delete error:",
            error
          );
        }
      }

      const result =
        deleteRoutineById(id);

      if (
        !result ||
        result.changes === 0
      ) {
        return res.status(404).json({
          error:
            "ルーティーンが見つかりません。",
        });
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "ルーティーン削除エラー:",
        error
      );

      return res.status(500).json({
        error:
          "ルーティーンの削除に失敗しました。",
      });
    }
  }
);

app.get(
  "/api/routines",
  (req, res) => {
    try {
      const routines =
        getActiveRoutines();

      return res.json(routines);
    } catch (error) {
      console.error(
        "ルーティーン取得エラー:",
        error
      );

      return res.status(500).json({
        error:
          "ルーティーン取得に失敗しました。",
      });
    }
  }
);

app.post(
  "/api/routines",
  (req, res) => {
    try {
      const {
        title,
        dayOfWeek,
        routineTime,
        category,
        googleCalendarEnabled,
      } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          error:
            "ルーティーン名を入力してください。",
        });
      }

      const normalizedDayOfWeek =
        Number(dayOfWeek);

      if (
        !Number.isInteger(
          normalizedDayOfWeek
        ) ||
        normalizedDayOfWeek < 0 ||
        normalizedDayOfWeek > 6
      ) {
        return res.status(400).json({
          error:
            "曜日が正しくありません。",
        });
      }

      if (
        routineTime !== null &&
        routineTime !== undefined &&
        routineTime !== "" &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          routineTime
        )
      ) {
        return res.status(400).json({
          error:
            "時間の形式が正しくありません。",
        });
      }

      const normalizedCategory =
        VALID_CATEGORIES.includes(
          category
        )
          ? category
          : "other";

      const result =
        createRoutine({
          title:
            title.trim(),
          dayOfWeek:
            normalizedDayOfWeek,
          routineTime:
            routineTime || null,
          category:
            normalizedCategory,
          googleCalendarEnabled:
            Boolean(
              googleCalendarEnabled
            ),
        });

      return res.status(201).json({
        success: true,
        routineId:
          Number(
            result.lastInsertRowid
          ),
      });
    } catch (error) {
      console.error(
        "ルーティーン登録エラー:",
        error
      );

      return res.status(500).json({
        error:
          "ルーティーンの登録に失敗しました。",
      });
    }
  }
);

app.put(
  "/api/routines/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ルーティーンIDが正しくありません。",
        });
      }

      const {
        title,
        dayOfWeek,
        routineTime,
        category,
        googleCalendarEnabled,
      } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          error:
            "タイトルを入力してください。",
        });
      }

      const normalizedDayOfWeek =
        Number(dayOfWeek);

      if (
        !Number.isInteger(
          normalizedDayOfWeek
        ) ||
        normalizedDayOfWeek < 0 ||
        normalizedDayOfWeek > 6
      ) {
        return res.status(400).json({
          error:
            "曜日が正しくありません。",
        });
      }

      if (
        routineTime !== null &&
        routineTime !== undefined &&
        routineTime !== "" &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          routineTime
        )
      ) {
        return res.status(400).json({
          error:
            "時間の形式が正しくありません。",
        });
      }

      const normalizedCategory =
        VALID_CATEGORIES.includes(
          category
        )
          ? category
          : "other";

      const result =
        updateRoutineById(
          id,
          {
            title:
              title.trim(),
            dayOfWeek:
              normalizedDayOfWeek,
            routineTime:
              routineTime || null,
            category:
              normalizedCategory,
            googleCalendarEnabled:
              Boolean(
                googleCalendarEnabled
              ),
          }
        );

      if (
        !result ||
        result.changes === 0
      ) {
        return res.status(404).json({
          error:
            "ルーティーンが見つかりません。",
        });
      }

      const routine =
  getRoutineById(id);

if (
  routine &&
  routine.google_calendar_enabled &&
  routine.google_event_id
) {
  try {
    await googleProvider
      .updateRecurringEventFromRoutine(
        routine
      );
  } catch (error) {
    console.error(
      "Google routine update error:",
      error
    );
  }
}

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "ルーティーン更新エラー:",
        error
      );

      return res.status(500).json({
        error:
          "ルーティーンの更新に失敗しました。",
      });
    }
  }
);

function broadcastNotification(
  title,
  body
) {
  const payload = JSON.stringify({
    title,
    body,
  });

  for (const client of notificationClients) {
    client.write(
      `data: ${payload}\n\n`
    );
  }
}

function runNotificationCheck() {
  const tasks =
    notificationManager.checkNotifications();

  if (tasks.length === 0) {
    return;
  }

  console.log("🔔 通知対象");

for (const task of tasks) {
  console.log(
    `・${task.title} (${task.dueDate} ${task.dueTime
?? ""})`
  );

  const body =
  task.notification === "day_before"
    ? `明日は「${task.title}」があります。`
    : `「${task.title}」の時間です。`;

broadcastNotification(
  "Notia",
  body
);
saveConversation(
  "assistant",
  `🔔 ${body}`
);
}
}

runNotificationCheck();

setInterval(
  runNotificationCheck,
  60 * 1000
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Notia 起動: http://localhost:${PORT}`);
});