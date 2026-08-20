require("dotenv").config();

const chatRuntime = require("./src/runtime/ChatRuntime");
const express = require("express");
const session = require("express-session");
const SQLiteStore =
  require("connect-sqlite3")(
    session
  );
const path = require("path");

const AppLogger =
  require("./src/utils/AppLogger");

process.on(
  "uncaughtException",
  (error) => {
    AppLogger.error(
      "process.uncaughtException",
      error
    );

    process.exit(1);
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    const error =
      reason instanceof Error
        ? reason
        : new Error(
            String(reason)
          );

    AppLogger.error(
      "process.unhandledRejection",
      error
    );

    process.exit(1);
  }
);
const multer = require("multer");
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
const calendarRouter =
  require("./src/routes/calendar");
const todayRouter =
  require("./src/routes/today");

const {
  saveConversation,
  getRecentConversations,
  getEventsByDate,
  getTasksByDate,
  getGoogleIntegration,
  getAllUsers,
  getUserById,
  hasDailyNotificationBeenSent,
  markDailyNotificationSent,
  getNotificationSettings,
} = require("./database");

const notificationManager = require("./src/managers/NotificationManager");

const {
  extractDocumentSchedule,
} = require("./openai");

const app = express();
const PORT = process.env.PORT || 3000;

const nativeAppOrigins =
  new Set([
    "capacitor://localhost",
  ]);

app.use((req, res, next) => {
  const origin =
    req.headers.origin;

  if (
    origin &&
    nativeAppOrigins.has(origin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Vary",
      "Origin"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});
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

app.use("/api", routinesRouter);
app.use("/api", calendarRouter);
app.use("/api", todayRouter);

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

app.use(
  (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const statusCode =
      Number.isInteger(
        error?.status
      )
        ? error.status
        : Number.isInteger(
            error?.statusCode
          )
          ? error.statusCode
          : 500;

    AppLogger.error(
      "express.unhandled",
      error,
      {
        method:
          req.method,
        path:
          req.path ||
          req.url?.split("?")[0],
        userId:
          req.session?.userId ??
          null,
        statusCode,
      }
    );

    res.status(statusCode).json({
      error:
        statusCode >= 500
          ? "サーバー内部でエラーが発生しました。"
          : error.message ||
            "リクエストの処理に失敗しました。",
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Notia 起動: http://localhost:${PORT}`
  );
});

setInterval(
  runNotificationCycle,
  60 * 1000
);
