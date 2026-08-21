const express = require("express");

const taskListManager =
  require("../managers/TaskListManager");

const {
  getTasksByDate,
  getTasksByDateRange,
  getEventsByDate,
  getEventsByDateRange,
  getExternalCalendarEventsByDate,
  getExternalCalendarEventsByDateRange,
  getActiveRoutines,
} = require("../../database");

const {
  syncGoogleCalendar,
} = require("../managers/CalendarSyncManager");

const router = express.Router();

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
      if (
        getRoutineDays(routine)
          .includes(dayOfWeek)
      ) {
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

router.post("/calendar/sync", async (req, res) => {
  try {
    const result =
  await syncGoogleCalendar(
    req.userId
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

router.get("/calendar", (req, res) => {
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
  req.userId,
  date
)
  );

      const events =
        getEventsByDate(
  req.userId,
  date
);

      const routines =
        expandRoutinesByDate(
          getActiveRoutines(
  req.userId
),
          date,
          date
        );

      const externalEvents =
        getExternalCalendarEventsByDate(
  req.userId,
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
      req.userId,
      startDate,
      endDate
    )
  );

    const events =
      getEventsByDateRange(
  req.userId,
  startDate,
  endDate
);

    const routines =
      expandRoutinesByDate(
        getActiveRoutines(
  req.userId
),
        startDate,
        endDate
      );

    const externalEvents =
      getExternalCalendarEventsByDateRange(
  req.userId,
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

module.exports = router;
