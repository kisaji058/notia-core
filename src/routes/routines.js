const express = require("express");

const googleProvider =
  require("../calendar/providers/GoogleCalendarProvider");

const {
  getRoutineById,
  getActiveRoutines,
  createRoutine,
  updateRoutineById,
  deleteRoutineById,
} = require("../../database");

const router = express.Router();

const VALID_CATEGORIES = [
  "work",
  "school",
  "private",
  "shopping",
  "other",
];

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeRoutineDays(
  daysOfWeek,
  fallbackDayOfWeek
) {
  const source = Array.isArray(daysOfWeek)
    ? daysOfWeek
    : (
        fallbackDayOfWeek !== undefined &&
        fallbackDayOfWeek !== null
      )
      ? [fallbackDayOfWeek]
      : null;

  if (!source || source.length === 0) {
    return null;
  }

  const normalized = [
    ...new Set(
      source.map((day) => Number(day))
    ),
  ].sort((a, b) => a - b);

  if (
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

router.delete(
  "/routines/:id",
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
  getRoutineById(
    req.userId,
    id
  );

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
    req.userId,
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
        deleteRoutineById(
  req.userId,
  id
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

router.get(
  "/routines",
  (req, res) => {
    try {
      const routines =
        getActiveRoutines(
          req.userId
        );

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

router.post(
  "/routines",
  (req, res) => {
    try {
      const {
        title,
        dayOfWeek,
        daysOfWeek,
        routineTime,
        category,
        googleCalendarEnabled,
        memo,
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

      const normalizedDaysOfWeek =
        normalizeRoutineDays(
          daysOfWeek,
          dayOfWeek
        );

      if (
        !normalizedDaysOfWeek
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
        !TIME_PATTERN.test(
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

      const routine =
  createRoutine(
    req.userId,
    {
          title:
            title.trim(),
          dayOfWeek:
            normalizedDaysOfWeek[0],
          daysOfWeek:
            normalizedDaysOfWeek,
          routineTime:
            routineTime || null,
          category:
            normalizedCategory,
          memo:
  typeof memo === "string"
    ? memo.trim().slice(0, 2000)
    : "",
          googleCalendarEnabled:
            Boolean(
              googleCalendarEnabled
            ),
        });

      return res.status(201).json({
        success: true,
        routineId:
          Number(routine.id),
        routine,
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

router.put(
  "/routines/:id",
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
        daysOfWeek,
        routineTime,
        category,
        googleCalendarEnabled,
        memo,
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

      const normalizedDaysOfWeek =
        normalizeRoutineDays(
          daysOfWeek,
          dayOfWeek
        );

      if (
        !normalizedDaysOfWeek
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
        !TIME_PATTERN.test(
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
    req.userId,
    id,
    {
      title: title.trim(),
      dayOfWeek:
        normalizedDaysOfWeek[0],
      daysOfWeek:
        normalizedDaysOfWeek,
      routineTime:
        routineTime || null,
      category:
        normalizedCategory,
      memo:
        typeof memo === "string"
          ? memo.trim().slice(0, 2000)
          : "",
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
  getRoutineById(
    req.userId,
    id
  );

if (
  routine &&
  routine.google_calendar_enabled &&
  routine.google_event_id
) {
  try {
    await googleProvider
  .updateRecurringEventFromRoutine(
    req.userId,
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
        routine,
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

module.exports = router;
