const express = require("express");

const {
  addEvent,
  getEventById,
  updateEventById,
  deleteEventById,
  getActiveEvents,
  convertEventToTask,
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

router.get(
  "/events",
  (req, res) => {
    try {
      const events =
        getActiveEvents(
          req.session.userId
        );

      return res.json(events);
    } catch (error) {
      console.error(
        "予定一覧取得エラー:",
        error
      );

      return res.status(500).json({
        error:
          "予定一覧の取得に失敗しました。",
      });
    }
  }
);

router.get("/events/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "予定IDが正しくありません。",
      });
    }

    const event = getEventById(
  req.session.userId,
  id
);

    if (!event) {
      return res.status(404).json({
        error: "予定が見つかりません。",
      });
    }

    return res.json(event);
  } catch (error) {
    console.error("予定取得エラー:", error);

    return res.status(500).json({
      error: "予定の取得に失敗しました。",
    });
  }
});

router.post("/events", (req, res) => {
  try {
    const {
  title,
  description,
  eventDate,
  startTime,
  endTime,
  location,
  priority = "normal",
  category = "other",
  notification = "none",
} = req.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        error: "予定のタイトルを入力してください。",
      });
    }

    if (
      typeof eventDate !== "string" ||
      !DATE_PATTERN.test(eventDate)
    ) {
      return res.status(400).json({
        error: "日付が正しくありません。",
      });
    }

    if (
      startTime &&
      !TIME_PATTERN.test(startTime)
    ) {
      return res.status(400).json({
        error: "開始時刻が正しくありません。",
      });
    }

    if (
      endTime &&
      !TIME_PATTERN.test(endTime)
    ) {
      return res.status(400).json({
        error: "終了時刻が正しくありません。",
      });
    }

    if (
      startTime &&
      endTime &&
      endTime < startTime
    ) {
      return res.status(400).json({
        error:
          "終了時刻は開始時刻以降にしてください。",
      });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
  return res.status(400).json({
    error: "優先度が正しくありません。",
  });
}

if (!VALID_CATEGORIES.includes(category)) {
  return res.status(400).json({
    error: "分類が正しくありません。",
  });
}

if (!VALID_NOTIFICATIONS.includes(notification)) {
  return res.status(400).json({
    error: "通知設定が正しくありません。",
  });
}

    const eventId = addEvent(
      req.session.userId,
  title.trim(),
  typeof description === "string"
    ? description.trim()
    : "",
  eventDate,
  startTime || null,
  endTime || null,
  typeof location === "string"
    ? location.trim()
    : "",
  priority,
  category,
  notification
);

    const event = getEventById(
  req.session.userId,
  Number(eventId)
);

    return res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("予定登録エラー:", error);

    return res.status(500).json({
      error: "予定の登録に失敗しました。",
    });
  }
});

router.put("/events/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "予定IDが正しくありません。",
      });
    }

    if (!getEventById(
  req.session.userId,
  id
)) {
      return res.status(404).json({
        error: "予定が見つかりません。",
      });
    }

    const {
  title,
  description,
  eventDate,
  startTime,
  endTime,
  location,
  priority = "normal",
  category = "other",
  notification = "none",
} = req.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        error: "予定のタイトルを入力してください。",
      });
    }

    if (
      typeof eventDate !== "string" ||
      !DATE_PATTERN.test(eventDate)
    ) {
      return res.status(400).json({
        error: "日付が正しくありません。",
      });
    }

    if (
      startTime &&
      !TIME_PATTERN.test(startTime)
    ) {
      return res.status(400).json({
        error: "開始時刻が正しくありません。",
      });
    }

    if (
      endTime &&
      !TIME_PATTERN.test(endTime)
    ) {
      return res.status(400).json({
        error: "終了時刻が正しくありません。",
      });
    }

    if (
      startTime &&
      endTime &&
      endTime < startTime
    ) {
      return res.status(400).json({
        error:
          "終了時刻は開始時刻以降にしてください。",
      });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
  return res.status(400).json({
    error: "優先度が正しくありません。",
  });
}

if (!VALID_CATEGORIES.includes(category)) {
  return res.status(400).json({
    error: "分類が正しくありません。",
  });
}

if (!VALID_NOTIFICATIONS.includes(notification)) {
  return res.status(400).json({
    error: "通知設定が正しくありません。",
  });
}

    const updated = updateEventById(
  req.session.userId,
  id,
  {
  title: title.trim(),

  description:
    typeof description === "string"
      ? description.trim()
      : "",

  event_date: eventDate,

  start_time:
    startTime || null,

  end_time:
    endTime || null,

  location:
    typeof location === "string"
      ? location.trim()
      : "",

  priority,
  category,
  notification,

  status: "active",
});

    if (!updated) {
      return res.status(404).json({
        error: "予定が見つかりません。",
      });
    }

    return res.json({
      success: true,
      event: getEventById(
  req.session.userId,
  id
),
    });
  } catch (error) {
    console.error("予定更新エラー:", error);

    return res.status(500).json({
      error: "予定の更新に失敗しました。",
    });
  }
});

router.delete("/events/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "予定IDが正しくありません。",
      });
    }

    if (!getEventById(
  req.session.userId,
  id
)) {
      return res.status(404).json({
        error: "予定が見つかりません。",
      });
    }

    deleteEventById(
  req.session.userId,
  id
);

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error("予定削除エラー:", error);

    return res.status(500).json({
      error: "予定の削除に失敗しました。",
    });
  }
});


router.post(
  "/events/:id/convert-to-task",
  (req, res) => {
    try {
      const event =
  getEventById(
    req.session.userId,
    req.params.id
  );

      if (!event) {
        return res.status(404).json({
          error:
            "予定が見つかりません。",
        });
      }

      const {
  title,
  description,
  eventDate,
  startTime,
  priority,
  category,
  notification,
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
            "タスク名を入力してください。",
        });
      }

      const dueDate =
        eventDate !== undefined
          ? eventDate
          : event.event_date;

      if (
        !dueDate ||
        !DATE_PATTERN.test(
          dueDate
        )
      ) {
        return res.status(400).json({
          error:
            "期限の日付が正しくありません。",
        });
      }

      if (
        startTime !== undefined &&
        startTime !== null &&
        startTime !== "" &&
        !TIME_PATTERN.test(
          startTime
        )
      ) {
        return res.status(400).json({
          error:
            "時間の形式が正しくありません。",
        });
      }

      const result =
        convertEventToTask(
          req.session.userId,
          req.params.id,
          {
            title:
              title !== undefined
                ? title.trim()
                : undefined,

            description:
              description !== undefined
                ? String(
                    description
                  ).trim()
                : undefined,

            dueDate,

            dueTime:
              startTime !== undefined
                ? startTime || null
                : undefined,

            priority:
  priority !== undefined
    ? priority
    : event.priority,

category:
  category !== undefined
    ? category
    : event.category,

notification:
  notification !== undefined
    ? notification
    : event.notification,
          }
        );

      if (!result.ok) {
        if (
          result.reason ===
          "date_required"
        ) {
          return res.status(400).json({
            error:
              "タスクへ変更するには期限が必要です。",
          });
        }

        return res.status(404).json({
          error:
            "予定が見つかりません。",
        });
      }

      return res.json({
        ok: true,
        taskId: result.taskId,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        error:
          "タスクへの変更に失敗しました。",
      });
    }
  }
);

module.exports = router;
