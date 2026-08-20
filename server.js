require("dotenv").config();

const chatRuntime = require("./src/runtime/ChatRuntime");
const express = require("express");
const session = require("express-session");
const SQLiteStore =
  require("connect-sqlite3")(
    session
  );
const path = require("path");
const multer = require("multer");
const taskListManager = require("./src/managers/TaskListManager");
const googleAuthRouter = require("./src/routes/googleAuth");
const authRouter =
  require("./src/routes/auth");
const notificationSettingsRouter =
  require("./src/routes/notificationSettings");
const onboardingRouter =
  require("./src/routes/onboarding");
const accountRouter =
  require("./src/routes/account");
const pagesRouter =
  require("./src/routes/pages");
const eventsRouter =
  require("./src/routes/events");
const tasksRouter =
  require("./src/routes/tasks");
const routinesRouter =
  require("./src/routes/routines");

const {
  saveConversation,
  getRecentConversations,
  getEventsByDate,
  getEventsByDateRange,
  getActiveTasks,
  getTasksByDate,
  getTasksByDateRange,
  getCompletedTasksByDate,
  getExternalCalendarEventsByDate,
  getExternalCalendarEventsByDateRange,
  getGoogleIntegration,
  getActiveRoutines,
  getTodayRoutines,
  getAllUsers,
  getUserById,
  hasDailyNotificationBeenSent,
  markDailyNotificationSent,
  getNotificationSettings,
} = require("./database");

const {
  syncGoogleCalendar,
} = require("./src/managers/CalendarSyncManager");
const notificationManager = require("./src/managers/NotificationManager");

const {
  extractDocumentSchedule,
} = require("./openai");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction =
  process.env.NODE_ENV ===
  "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: __dirname,
    }),

    secret:
      process.env.SESSION_SECRET ||
      "notia-local-development-secret",

    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge:
        1000 *
        60 *
        60 *
        24 *
        30,
    },
  })
);
app.use("/login", authRouter);

function requireAuth(req, res, next) {
  const userId =
    req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      error: "ログインが必要です。",
    });
  }

  const user =
    getUserById(userId);

  if (!user) {
    req.session.destroy(() => {});

    res.clearCookie("connect.sid");

    return res.status(401).json({
      error: "アカウントが存在しません。",
    });
  }

  next();
}

app.use("/api", requireAuth);
app.use(
  "/api",
  notificationSettingsRouter
);

app.use(
  "/api",
  onboardingRouter
);

app.use(
  "/api",
  accountRouter
);
const documentUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "application/pdf",
    ];

    if (
      !allowedTypes.includes(
        file.mimetype
      )
    ) {
      return callback(
        new Error(
          "PNG、JPEG、PDFのみ添付できます。"
        )
      );
    }

    callback(null, true);
  },
});
const notificationClients =
  new Map();

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

function normalizeRoutineDays(
  daysOfWeek,
  fallbackDayOfWeek
) {
  const source = Array.isArray(daysOfWeek)
    ? daysOfWeek
    : [fallbackDayOfWeek];

  const normalized = [
    ...new Set(source.map((day) => Number(day))),
  ].sort((a, b) => a - b);

  if (
    normalized.length === 0 ||
    normalized.some(
      (day) =>
        !Number.isInteger(day) ||
        day < 0 ||
        day > 6
    )
  ) {
    return null;
  }

  return normalized;
}

function getRoutineDays(routine) {
  return normalizeRoutineDays(
    Array.isArray(routine.days_of_week)
      ? routine.days_of_week
      : typeof routine.days_of_week === "string"
        ? routine.days_of_week.split(",")
        : null,
    routine.day_of_week
  ) || [];
}

app.get(
  "/api/notifications/stream",
  (req, res) => {
    const userId =
      req.session.userId;

    console.log(
      "SSE client connected:",
      userId
    );

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

    let clients =
      notificationClients.get(
        userId
      );

    if (!clients) {
      clients = new Set();

      notificationClients.set(
        userId,
        clients
      );
    }

    clients.add(res);

    req.on("close", () => {
      const currentClients =
        notificationClients.get(
          userId
        );

      if (!currentClients) {
        return;
      }

      currentClients.delete(res);

      if (
        currentClients.size === 0
      ) {
        notificationClients.delete(
          userId
        );
      }
    });
  }
);

app.get("/api/conversations", (req, res) => {
  const conversations =
  getRecentConversations(
    req.session.userId,
    100
  );
  res.json(conversations);
});

app.get("/api/integrations", (req, res) => {
  try {
    const google =
  getGoogleIntegration(
    req.session.userId
  );

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

app.use("/", pagesRouter);

app.use(
  express.static(
    path.join(__dirname, "public"),
    {
      etag: true,
      maxAge: 0,

      setHeaders: (res, filePath) => {
        if (
          filePath.endsWith(".html")
        ) {
          res.setHeader(
            "Cache-Control",
            "no-cache"
          );

          return;
        }

        if (
          /\.(css|js|png|jpg|jpeg|webp|svg|ico)$/i.test(
            filePath
          )
        ) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=3600"
          );
        }
      },
    }
  )
);

// =====================
// Notia events API
// =====================

app.use("/api", eventsRouter);
app.use("/api", tasksRouter);

function normalizeUploadFilename(
  filename
) {
  if (!filename) {
    return "";
  }

  try {
    return Buffer.from(
      filename,
      "latin1"
    ).toString("utf8");
  } catch {
    return filename;
  }
}

app.post(
  "/api/document/extract",

  documentUpload.single("file"),

  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "ファイルがありません。",
          });
      }

      const originalName =
  normalizeUploadFilename(
    req.file.originalname
  );

console.log(
  "Document received:",
  {
    originalName,
    mimeType:
      req.file.mimetype,
    size:
      req.file.size,
  }
);

     const result =
  await extractDocumentSchedule({
    buffer:
      req.file.buffer,

    mimeType:
      req.file.mimetype,

    fileName:
      originalName,

    userMessage:
      String(
        req.body.message || ""
      ).trim(),
  });

  console.log(
  "Document extraction result:",
  JSON.stringify(
    result,
    null,
    2
  )
);

return res.json({
  success: true,

  file: {
    name: originalName,
    type:
      req.file.mimetype,
    size:
      req.file.size,
  },

  items:
    Array.isArray(result.items)
      ? result.items
      : [],

  warnings:
    Array.isArray(result.warnings)
      ? result.warnings
      : [],
}); 
    } catch (error) {
      console.error(
        "Document upload error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "資料の受信に失敗しました。",
        });
    }
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

    const result =
  await chatRuntime.handleChat(
    message,
    req.session.userId
  );

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
    const result =
  await syncGoogleCalendar(
    req.session.userId
  );

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
        "Google予定との同期に失敗しました。",
    });
  }
});

function expandRoutinesByDate(
  routines,
  startDate,
  endDate
) {
  const expanded = [];

  const current = new Date(
    `${startDate}T00:00:00Z`
  );

  const end = new Date(
    `${endDate}T00:00:00Z`
  );

  while (current <= end) {
    const date = current
      .toISOString()
      .slice(0, 10);

    const dayOfWeek =
      current.getUTCDay();

    for (const routine of routines) {
      if (getRoutineDays(routine).includes(dayOfWeek)) {
        expanded.push({
          ...routine,
          routine_date: date,
        });
      }
    }

    current.setUTCDate(
      current.getUTCDate() + 1
    );
  }

  return expanded;
}

app.get("/api/calendar", (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
    } = req.query;

    // 日表示
    if (date) {
      const tasks =
  taskListManager.formatTasksForApi(
    getTasksByDate(
  req.session.userId,
  date
)
  );

      const events =
        getEventsByDate(
  req.session.userId,
  date
);

      const routines =
        expandRoutinesByDate(
          getActiveRoutines(
  req.session.userId
),
          date,
          date
        );

      const externalEvents =
        getExternalCalendarEventsByDate(
  req.session.userId,
  "google",
  date
);

      return res.json({
        tasks,
        events,
        routines,
        externalEvents,
      });
    }

    // 週・月表示
    if (!startDate || !endDate) {
      return res.status(400).json({
        error:
          "date、またはstartDateとendDateが必要です。",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error:
          "startDateはendDate以前にしてください。",
      });
    }

    const tasks =
  taskListManager.formatTasksForApi(
    getTasksByDateRange(
      req.session.userId,
      startDate,
      endDate
    )
  );

    const events =
      getEventsByDateRange(
  req.session.userId,
  startDate,
  endDate
);

    const routines =
      expandRoutinesByDate(
        getActiveRoutines(
  req.session.userId
),
        startDate,
        endDate
      );

    const externalEvents =
      getExternalCalendarEventsByDateRange(
  req.session.userId,
  "google",
  startDate,
  endDate
);

    return res.json({
      tasks,
      events,
      routines,
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
  taskListManager.formatTasksForApi([
    ...getTasksByDate(
  req.session.userId,
  date
),
    ...getCompletedTasksByDate(
  req.session.userId,
  date
),
  ]);

    const overdueTasks =
  taskListManager
    .formatTasksForApi(
      getActiveTasks(
  req.session.userId
)
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
      getEventsByDate(
  req.session.userId,
  date
);

    const externalEvents =
  getExternalCalendarEventsByDate(
    req.session.userId,
    "google",
    date
  );

    const routines =
  getTodayRoutines(
    req.session.userId
  );
  
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
          "Google予定",
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

app.use("/api", routinesRouter);

function broadcastNotification(
  userId,
  title,
  body
) {
  const payload =
    JSON.stringify({
      title,
      body,
    });

  const clients =
    notificationClients.get(
      userId
    );

  if (!clients) {
    return;
  }

  for (const client of clients) {
    client.write(
      `data: ${payload}\n\n`
    );
  }
}

function runNotificationCheck(
  userId
) {
  const tasks =
    notificationManager
      .checkNotifications(userId);

  if (tasks.length === 0) {
    return;
  }

  console.log(
    "🔔 通知対象:",
    userId
  );

  for (const item of tasks) {
    console.log(
      `・${item.title} (${item.due_date || ""} ${item.due_time || ""})`
    );

    const body = {
      same_day:
        `本日は「${item.title}」があります。`,

      day_before:
        `明日は「${item.title}」があります。`,

      at_time:
        `「${item.title}」の時間です。`,

      "10_minutes_before":
        `「${item.title}」は10分後です。`,

      "30_minutes_before":
        `「${item.title}」は30分後です。`,

      "1_hour_before":
        `「${item.title}」は1時間後です。`,
    }[item.notification] ||
      `「${item.title}」のお知らせです。`;

    broadcastNotification(
      userId,
      "Notia",
      body
    );

    saveConversation(
      userId,
      "assistant",
      `🔔 ${body}`
    );
  }
}

function getJapanNowParts() {
  const now = new Date();

  const date = now.toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );

  const time = now.toLocaleTimeString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );

  return {
    date,
    time,
  };
}

function createTaskTitleSummary(tasks) {
  const titles =
    tasks
      .slice(0, 3)
      .map(
        (task) =>
          `「${task.title}」`
      );

  if (tasks.length <= 3) {
    return titles.join("、");
  }

  return (
    titles.join("、") +
    `など${tasks.length}件`
  );
}

function runMorningTaskSummary(
  userId
) {
  const { date, time } =
    getJapanNowParts();

  const settings =
    getNotificationSettings(
      userId
    );

  if (!settings.morningEnabled) {
    return;
  }

  const morningTime =
    settings.morningTime;

  const end = new Date(
    `${date}T${morningTime}:00+09:00`
  );

  end.setMinutes(
    end.getMinutes() + 2
  );

  const endTime =
    end.toLocaleTimeString(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );

  if (
    time < morningTime ||
    time >= endTime
  ) {
    return;
  }

  if (
    hasDailyNotificationBeenSent(
      userId,
      "morning_summary",
      date
    )
  ) {
    return;
  }

  const tasks =
    getTasksByDate(
      userId,
      date
    );
  
  const events =
  getEventsByDate(
    userId,
    date
  );

  if (
  tasks.length === 0 &&
  events.length === 0
) {
    markDailyNotificationSent(
      userId,
      "morning_summary",
      date
    );

    return;
  }

  const items = [
  ...tasks.map((task) => ({
    title: task.title,
    type: "task",
  })),
  ...events.map((event) => ({
    title: event.title,
    type: "event",
  })),
];

const summary =
  createTaskTitleSummary(items);

const body =
  items.length === 1
    ? `おはようございます。今日は${summary}があります。`
    : `おはようございます。今日は${summary}があります。無理のない順番で進めていきましょう。`;

  broadcastNotification(
    userId,
    "Notia",
    body
  );

  saveConversation(
    userId,
    "assistant",
    `🔔 ${body}`
  );

  markDailyNotificationSent(
    userId,
    "morning_summary",
    date
  );
}

function runEveningTaskCheck(
  userId
) {
  const { date, time } =
    getJapanNowParts();

  const settings =
    getNotificationSettings(
      userId
    );

  if (!settings.eveningEnabled) {
    return;
  }

  const eveningTime =
    settings.eveningTime;

  const end = new Date(
    `${date}T${eveningTime}:00+09:00`
  );

  end.setMinutes(
    end.getMinutes() + 2
  );

  const endTime =
    end.toLocaleTimeString(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );

  if (
    time < eveningTime ||
    time >= endTime
  ) {
    return;
  }

  if (
    hasDailyNotificationBeenSent(
      userId,
      "evening_check",
      date
    )
  ) {
    return;
  }

  const tasks =
    getTasksByDate(
      userId,
      date
    );

  if (tasks.length === 0) {
    markDailyNotificationSent(
      userId,
      "evening_check",
      date
    );

    return;
  }

  const summary =
    createTaskTitleSummary(tasks);

  const body =
    tasks.length === 1
      ? `今日のタスクがあと1件、${summary}残っています。今日中に済ませるか、一度確認しておきませんか？`
      : `今日のタスクがあと${tasks.length}件残っています。${summary}です。今日中に済ませるものだけ、もう一度確認しておきませんか？`;

  broadcastNotification(
    userId,
    "Notia",
    body
  );

  saveConversation(
    userId,
    "assistant",
    `🔔 ${body}`
  );

  markDailyNotificationSent(
    userId,
    "evening_check",
    date
  );
}

function runNotificationCycle() {
  const users =
    getAllUsers();

  for (const user of users) {
    try {
      runNotificationCheck(
        user.id
      );

      runMorningTaskSummary(
        user.id
      );

      runEveningTaskCheck(
        user.id
      );
    } catch (error) {
      console.error(
        "Notification cycle error:",
        {
          userId: user.id,
          error:
            error.message,
        }
      );
    }
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Notia 起動: http://localhost:${PORT}`
  );
});

setInterval(
  runNotificationCycle,
  60 * 1000
);
