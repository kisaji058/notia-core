const {
  createRoutine,
  getRoutinesByDayOfWeek,
} = require("../../database");

async function resolve(
  analysis,
  context
) {
  if (
  analysis?.intent ===
  "routine_create"
) {
  return resolveRoutineCreate(
    analysis
  );
}

if (
  analysis?.intent ===
    "schedule_query" &&
  analysis.scheduleQuery?.target ===
    "routine"
) {
  return resolveRoutineQuery(
    
    analysis.scheduleQuery?.range,
    analysis.scheduleQuery?.dayOfWeek
  );
}

return {
  handled: false,
  reply: null,
};

function resolveRoutineCreate(
  analysis
) {
  const routine = analysis.routine;

  if (
    !routine ||
    !routine.title ||
    !Number.isInteger(
      routine.dayOfWeek
    )
  ) {
    return {
      handled: true,
      reply:
        "ルーティーンの内容を正しく理解できませんでした。",
    };
  }

  createRoutine({
    title: routine.title,
    dayOfWeek:
      routine.dayOfWeek,
    routineTime:
      routine.routineTime,
    category:
      routine.category || "other",
    googleCalendarEnabled:
      routine.googleCalendarEnabled ===
      true,
  });

  const dayLabels = [
    "日曜日",
    "月曜日",
    "火曜日",
    "水曜日",
    "木曜日",
    "金曜日",
    "土曜日",
  ];

  const dayLabel =
    dayLabels[routine.dayOfWeek];

  const timeText =
    routine.routineTime
      ? `${routine.routineTime}に`
      : "";

  return {
    handled: true,
    reply:
      `「${routine.title}」を` +
      `毎週${dayLabel}${timeText}` +
      "行うルーティーンとして登録しました。",
  };
}
}

function resolveRoutineQuery(
  range = "today",
  dayOfWeek = null
) {
  console.log({
    range,
    dayOfWeek,
  });

  const date = new Date();

  if (range === "tomorrow") {
    date.setDate(
      date.getDate() + 1
    );
  }

  if (
    range ===
    "day_after_tomorrow"
  ) {
    date.setDate(
      date.getDate() + 2
    );
  }

  const resolvedDayOfWeek =
    range === "weekday"
      ? dayOfWeek
      : date.getDay();

  const dayLabels = [
    "日曜日",
    "月曜日",
    "火曜日",
    "水曜日",
    "木曜日",
    "金曜日",
    "土曜日",
  ];

  let label;

  switch (range) {
    case "tomorrow":
      label = "明日";
      break;

    case "day_after_tomorrow":
      label = "明後日";
      break;

    case "weekday":
      label =
        dayLabels[
          resolvedDayOfWeek
        ];
      break;

    default:
      label = "今日";
  }

  const routines =
    getRoutinesByDayOfWeek(
      resolvedDayOfWeek
    );



  console.log({
  resolvedDayOfWeek,
  routines,
});

  if (routines.length === 0) {
    return {
      handled: true,
      reply:
        `${label}のルーティーンはありません。`,
    };
  }

  const lines = routines.map(
    (routine) => {
      if (routine.routine_time) {
        return `・${routine.routine_time} ${routine.title}`;
      }

      return `・${routine.title}`;
    }
  );

  return {
    handled: true,
     reply:
  `${label}のルーティーンは以下の通りです。\n\n` +
  lines.join("\n"), 
  };
}

module.exports = {
  resolve,
};