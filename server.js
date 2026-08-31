require("dotenv").config();

const chatRuntime = require("./src/runtime/ChatRuntime");
const express = require("express");
const session = require("express-session");
const SQLiteStore =
  require("connect-sqlite3")(
    session
  );
const path = require("path");
const crypto = require("crypto");

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
const requireApiAuth =
  require("./src/middleware/requireApiAuth");
const notificationSettingsRouter =
  require("./src/routes/notificationSettings");

const nativePushRouter =
  require("./src/routes/nativePush");
const onboardingRouter =
  require("./src/routes/onboarding");
const accountRouter =
  require("./src/routes/account");

const subscriptionRouter =
  require("./src/routes/subscription");
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
  saveDocumentChatHistory,
  getRecentDocumentChatHistory,
  getEventsByDate,
  getTasksByDate,
  getGoogleIntegration,
  getAllUsers,
  getUserById,
  hasDailyNotificationBeenSent,
  markDailyNotificationSent,
  getNotificationSettings,
  getNativePushTokensByUserId,
  registerDocumentForRecheck,
  reserveDocumentRecheck,
  releaseDocumentRecheck,
} = require("./database");

const notificationManager = require("./src/managers/NotificationManager");

const {
  sendPush,
} = require("./src/services/APNsService");

const {
  extractDocumentSchedule,
} = require("./openai");

const {
  countDocumentPages,
} = require("./src/services/DocumentPageCounterService");

const {
  reserveDocumentUsage,
  commitDocumentUsage,
  releaseDocumentUsage,
} = require("./src/services/UsageService");

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

app.use(express.json());

app.use(
  "/api",
  requireApiAuth
);
app.use(
  "/api",
  notificationSettingsRouter
);

app.use(
  "/api",
  nativePushRouter
);

app.use(
  "/api",
  onboardingRouter
);

app.use(
  "/api",
  accountRouter
);

app.use(
  "/api",
  subscriptionRouter
);
const documentUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 25 * 1024 * 1024,
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
      req.userId;

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
      req.userId,
      100
    );

  const documents =
    getRecentDocumentChatHistory(
      req.userId,
      100
    ).map(
      (document) => ({
        role: "document",
        message: "",
        created_at:
          document.created_at,
        document: {
          id:
            document.id,
          fileName:
            document.file_name,
          pageCount:
            document.page_count,
          items:
            JSON.parse(
              document.items_json ||
                "[]"
            ),
          warnings:
            JSON.parse(
              document.warnings_json ||
                "[]"
            ),
          sourceMessage:
            document.source_message ||
            "",
        },
      })
    );

  const history = [
    ...conversations,
    ...documents,
  ]
    .sort(
      (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at)
    )
    .slice(-100);

  res.json(history);
});

app.get("/api/integrations", (req, res) => {
  try {
    const google =
  getGoogleIntegration(
    req.userId
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

    let reservation = null;

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

      const fileHash =
        crypto.createHash("sha256")
          .update(req.file.buffer)
          .digest("hex");

      const pageCount =
        await countDocumentPages({
          buffer:
            req.file.buffer,
          mimeType:
            req.file.mimetype,
        });

      if (
        !Number.isInteger(pageCount) ||
        pageCount < 1
      ) {
        return res.status(400).json({
          success: false,
          error:
            "資料のページ数を確認できませんでした。",
        });
      }

      const usage =
        reserveDocumentUsage({
          userId:
            req.userId,
          pageCount,
        });

      if (!usage.success) {
        return res.status(429).json({
          success: false,
          code:
            "DOCUMENT_PAGE_LIMIT_REACHED",
          error:
            "今月の資料読み取り上限を超えています。",
          usage: {
            requestedPages:
              pageCount,
            usedPages:
              usage.usedCount,
            reservedPages:
              usage.reservedCount,
            limit:
              usage.limit,
          },
        });
      }

      reservation =
        usage.reservation;

      let responseFinished = false;
      let responseSucceeded = false;
      let documentHistoryPayload = null;

      res.once(
        "finish",
        () => {
          responseFinished = true;

          if (!responseSucceeded) {
            return;
          }

          let usageSettled =
            !reservation;

          if (reservation) {
            const reservationToSettle =
              reservation;

            try {
              const committed =
                commitDocumentUsage({
                  userId:
                    req.userId,
                  reservation:
                    reservationToSettle,
                });

              if (
                committed &&
                committed.changes === 1
              ) {
                usageSettled = true;
              } else {
                console.error(
                  "Document usage commit failed after response finish."
                );
              }
            } catch (commitError) {
              console.error(
                "Document usage commit error after response finish:",
                commitError
              );
            }

            if (!usageSettled) {
              try {
                releaseDocumentUsage({
                  userId:
                    req.userId,
                  reservation:
                    reservationToSettle,
                });
              } catch (releaseError) {
                console.error(
                  "Document usage release error after failed commit:",
                  releaseError
                );
              }
            }

            reservation = null;
          }

          if (!usageSettled) {
            return;
          }

          try {
            registerDocumentForRecheck({
              userId:
                req.userId,
              fileHash,
            });
          } catch (
            registrationError
          ) {
            console.error(
              "Document recheck registration error:",
              registrationError
            );
          }

          if (
            documentHistoryPayload
          ) {
            try {
              saveDocumentChatHistory(
                documentHistoryPayload
              );
            } catch (
              historyError
            ) {
              console.error(
                "Document chat history save error:",
                historyError
              );
            }
          }
        }
      );

      res.once(
        "close",
        () => {
          if (
            responseFinished ||
            !reservation
          ) {
            return;
          }

          try {
            releaseDocumentUsage({
              userId:
                req.userId,
              reservation,
            });
          } catch (
            releaseError
          ) {
            console.error(
              "Document usage release error after response close:",
              releaseError
            );
          }

          reservation = null;
        }
      );

      console.log(
        "Document received:",
        {
          originalName,
          mimeType:
            req.file.mimetype,
          size:
            req.file.size,
          pageCount,
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

      documentHistoryPayload = {
        userId:
          req.userId,
        fileName:
          originalName,
        pageCount,
        items:
          Array.isArray(
            result.items
          )
            ? result.items
            : [],
        warnings:
          Array.isArray(
            result.warnings
          )
            ? result.warnings
            : [],
        sourceMessage:
          String(
            req.body.message ||
            ""
          ).trim(),
      };

      responseSucceeded = true;

      return res.json({
        success: true,

        file: {
          name:
            originalName,
          type:
            req.file.mimetype,
          size:
            req.file.size,
          pageCount,
        },

        items:
          Array.isArray(result.items)
            ? result.items
            : [],

        warnings:
          Array.isArray(
            result.warnings
          )
            ? result.warnings
            : [],

        usage: {
          pageCount,
          unlimited:
            Boolean(
              usage.unlimited
            ),
          usedPages:
            usage.unlimited
              ? null
              : usage.usedCount +
                pageCount,
          limit:
            usage.unlimited
              ? null
              : usage.limit,
        },
      });

    } catch (error) {

      if (reservation) {
        try {
          releaseDocumentUsage({
            userId:
              req.userId,
            reservation,
          });
        } catch (
          releaseError
        ) {
          console.error(
            "Document usage release error:",
            releaseError
          );
        }

        reservation = null;
      }

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

app.post(
  "/api/document/recheck",
  documentUpload.single("file"),
  async (req, res) => {
    let recheckReserved = false;
    let fileHash = null;

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

      fileHash =
        crypto.createHash("sha256")
          .update(req.file.buffer)
          .digest("hex");

      const pageCount =
        await countDocumentPages({
          buffer:
            req.file.buffer,
          mimeType:
            req.file.mimetype,
        });

      if (
        !Number.isInteger(pageCount) ||
        pageCount < 1
      ) {
        return res.status(400).json({
          success: false,
          error:
            "資料のページ数を確認できませんでした。",
        });
      }

      const recheckUsage =
        reserveDocumentRecheck({
          userId:
            req.userId,
          fileHash,
          limit: 2,
        });

      if (!recheckUsage.success) {
        const status =
          recheckUsage.code ===
            "DOCUMENT_RECHECK_LIMIT_REACHED"
            ? 429
            : 403;

        return res.status(status).json({
          success: false,
          code:
            recheckUsage.code,
          error:
            recheckUsage.code ===
              "DOCUMENT_RECHECK_LIMIT_REACHED"
              ? "このファイルは再調査上限に達しています。"
              : "このファイルは再調査対象として登録されていません。",
          recheck: {
            count:
              recheckUsage.count,
            limit:
              recheckUsage.limit,
          },
        });
      }

      recheckReserved = true;

      console.log(
        "Document recheck received:",
        {
          originalName,
          mimeType:
            req.file.mimetype,
          size:
            req.file.size,
          pageCount,
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
          mode: "recheck",
        });

      console.log(
        "Document recheck result:",
        JSON.stringify(
          result,
          null,
          2
        )
      );

      recheckReserved = false;

      return res.json({
        success: true,

        file: {
          name:
            originalName,
          type:
            req.file.mimetype,
          size:
            req.file.size,
          pageCount,
        },

        items:
          Array.isArray(result.items)
            ? result.items
            : [],

        warnings:
          Array.isArray(
            result.warnings
          )
            ? result.warnings
            : [],
      });
    } catch (error) {
      if (recheckReserved) {
        try {
          releaseDocumentRecheck({
            userId:
              req.userId,
            fileHash,
          });
        } catch (
          releaseError
        ) {
          console.error(
            "Document recheck release error:",
            releaseError
          );
        }
      }

      console.error(
        "Document recheck error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "資料の再調査に失敗しました。",
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
    req.userId
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

async function sendNativePushNotification(
  userId,
  title,
  body
) {
  const tokens =
    getNativePushTokensByUserId(
      userId
    );

  if (tokens.length === 0) {
    return;
  }

  const results =
    await Promise.allSettled(
      tokens.map(
        (token) =>
          sendPush({
            deviceToken:
              token.device_token,
            title,
            body,
          })
      )
    );

  for (
    let index = 0;
    index < results.length;
    index += 1
  ) {
    const result =
      results[index];

    if (
      result.status ===
        "rejected"
    ) {
      console.error(
        "Native push send error:",
        {
          userId,
          pushTokenId:
            tokens[index].id,
          error:
            result.reason
              ?.message ||
            "Unknown APNs error",
        }
      );
    }
  }
}

function sendNotificationToUser(
  userId,
  title,
  body
) {
  broadcastNotification(
    userId,
    title,
    body
  );

  sendNativePushNotification(
    userId,
    title,
    body
  ).catch((error) => {
    console.error(
      "Native push dispatch error:",
      {
        userId,
        error:
          error.message,
      }
    );
  });
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

    sendNotificationToUser(
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

  sendNotificationToUser(
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

  sendNotificationToUser(
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
