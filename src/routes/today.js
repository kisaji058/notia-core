const express = require("express");

const taskListManager =
  require("../managers/TaskListManager");

const {
  getTasksByDate,
  getCompletedTasksByDate,
  getActiveTasks,
  getEventsByDate,
  getExternalCalendarEventsByDate,
  getTodayRoutines,
} = require("../../database");

const router = express.Router();

router.get("/today", (req, res) => {
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
  req.userId,
  date
),
    ...getCompletedTasksByDate(
  req.userId,
  date
),
  ]);

    const overdueTasks =
  taskListManager
    .formatTasksForApi(
      getActiveTasks(
  req.userId
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
  req.userId,
  date
);

    const externalEvents =
  getExternalCalendarEventsByDate(
    req.userId,
    "google",
    date
  );

    const routines =
  getTodayRoutines(
    req.userId
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

module.exports = router;
