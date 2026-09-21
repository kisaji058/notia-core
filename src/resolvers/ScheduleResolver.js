const {
  getTodayRoutines,
  getEventsByDate,
  getEventsByDateRange,
  getExternalCalendarEventsByDate,
  getExternalCalendarEventsByDateRange,
} = require("../../database");

function resolve(
  analysis,
  context,
  userId
) {
  if (
    analysis?.intent !==
      "schedule_query" ||
    analysis.scheduleQuery?.target !==
      "schedule"
  ) {
    return {
      handled: false,
      reply: null,
    };
  }

  switch (
    analysis.scheduleQuery?.range
  ) {
    case "today":
      return resolveTodaySchedule(
  context,
  userId
);

    case "tomorrow":
      return resolveTomorrowSchedule(
        context,
        userId
      );

    case "this_week":
      return resolveThisWeekSchedule(
        context,
        userId
      );

    case "next_week":
      return resolveNextWeekSchedule(
        context,
        userId
      );

    default:
      return {
        handled: false,
        reply: null,
      };
  }
}

function resolveByDateRange(
  startDate,
  endDate,
  context,
  userId
) {
  const label = startDate === endDate
    ? formatScheduleDate(startDate)
    : `${formatScheduleDate(startDate)}〜${formatScheduleDate(endDate)}`;

  return resolveScheduleByRange(
    startDate,
    endDate,
    label,
    context,
    userId,
    startDate !== endDate
  );
}

function formatScheduleDate(dateString) {
  const date = new Date(
    `${dateString}T00:00:00+09:00`
  );

  return date.toLocaleDateString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }
  );
}

function getTasksByDate(
  targetDate,
  context
) {
  return (context.activeTasks || [])
    .filter(
      (task) =>
        task.due_date === targetDate
    )
    .sort((a, b) => {
      const timeA =
        a.due_time || "99:99";

      const timeB =
        b.due_time || "99:99";

      return timeA.localeCompare(timeB);
    });
}

function resolveScheduleByDate(
  targetDate,
  label,
  context,
  userId
) {
  return resolveScheduleByRange(
    targetDate,
    targetDate,
    label,
    context,
    userId,
    false
  );
}

function resolveScheduleByRange(
  startDate,
  endDate,
  label,
  context,
  userId,
  showDate = true
) {
  const tasks = (context.activeTasks || [])
    .filter((task) =>
      task.due_date >= startDate &&
      task.due_date <= endDate
    )
    .sort((a, b) =>
      (a.due_date || "").localeCompare(b.due_date || "") ||
      (a.due_time || "99:99").localeCompare(b.due_time || "99:99")
    );

  const events = getEventsByDateRange(
    userId,
    startDate,
    endDate
  );

  const externalEvents =
    getExternalCalendarEventsByDateRange(
      userId,
      "google",
      startDate,
      endDate
    );

  const dateLabel = (date) =>
    showDate && date
      ? `${formatScheduleDate(date)} `
      : "";

  const eventLines = events.map((event) => {
    const date = event.event_date < startDate
      ? startDate
      : event.event_date;
    const time = event.start_time
      ? `${event.start_time} `
      : "";

    return `・${dateLabel(date)}${time}${event.title}`;
  });

  const googleLines = externalEvents.map((event) => {
    const date = event.start_datetime?.slice(0, 10);
    const displayDate = date && date < startDate
      ? startDate
      : date;
    const time = event.is_all_day
      ? ""
      : event.start_datetime?.slice(11, 16);
    const timeLabel = time ? `${time} ` : "";

    return (
      `・${dateLabel(displayDate)}${timeLabel}${event.title}` +
      "（Google）"
    );
  });

  const taskLines = tasks.map((task) => {
    const time = task.due_time
      ? `${task.due_time} `
      : "";

    return (
      `・${dateLabel(task.due_date)}${time}${task.title}`
    );
  });

  const sections = [];

  if (eventLines.length || googleLines.length) {
    sections.push(
      "📅 予定\n" +
      [...eventLines, ...googleLines].join("\n")
    );
  }

  if (taskLines.length) {
    sections.push(
      "📝 タスク\n" + taskLines.join("\n")
    );
  }

  return {
    handled: true,
    reply: sections.length
      ? `${label}の予定です。\n\n${sections.join("\n\n")}`
      : `${label}の予定はありません。`,
  };
}

function resolveTodaySchedule(
  context,
  userId
) {
  const today =
    new Date().toLocaleDateString(
      "sv-SE",
      { timeZone: "Asia/Tokyo" }
    );

  const tasks = getTasksByDate(
    today,
    context
  );

  const events = getEventsByDate(
    userId,
    today
  );

  const externalEvents =
    getExternalCalendarEventsByDate(
      userId,
      "google",
      today
    );

  const routines = getTodayRoutines(userId);

  if (
    tasks.length === 0 &&
    events.length === 0 &&
    externalEvents.length === 0 &&
    routines.length === 0
  ) {
    return {
      handled: true,
      reply: "今日の予定はありません。",
    };
  }

  const sections = [];

  if (
    events.length > 0 ||
    externalEvents.length > 0
  ) {
    const eventLines = events.map(
      (event) => {
        const time = event.start_time
          ? `${event.start_time} `
          : "";

        return `・${time}${event.title}`;
      }
    );

    const googleLines = externalEvents.map(
      (event) => {
        const time =
          event.is_all_day
            ? ""
            : event.start_datetime
                ?.slice(11, 16);

        const timeLabel = time
          ? `${time} `
          : "";

        return (
          `・${timeLabel}${event.title}` +
          "（Google）"
        );
      }
    );

    sections.push(
      "📅 予定\n" +
      [...eventLines, ...googleLines].join("\n")
    );
  }

  if (tasks.length > 0) {
    const taskLines = tasks.map(
      (task) => {
        const time = task.due_time
          ? `${task.due_time} `
          : "";

        return `・${time}${task.title}`;
      }
    );

    sections.push(
      "📝 タスク\n" +
      taskLines.join("\n")
    );
  }

  if (routines.length > 0) {
    const routineLines = routines.map(
      (routine) => {
        const time = routine.routine_time
          ? `${routine.routine_time} `
          : "";

        return `・${time}${routine.title}`;
      }
    );

    sections.push(
      "🔁 ルーティーン\n" +
      routineLines.join("\n")
    );
  }

  return {
    handled: true,
    reply:
      "今日の予定です。\n\n" +
      sections.join("\n\n"),
  };
}

function resolveTomorrowSchedule(context, userId) {
  const tomorrow = new Date();

  tomorrow.setDate(
    tomorrow.getDate() + 1
  );

  const tomorrowDate =
    tomorrow.toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  return resolveScheduleByDate(
    tomorrowDate,
    "明日",
    context,
    userId
  );
}

function resolveThisWeekSchedule(context, userId) {
  const today = new Date();

  const day = today.getDay();

  // 月曜日始まり
  const diff =
    day === 0 ? -6 : 1 - day;

  const start = new Date(today);
  start.setDate(today.getDate() + diff);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startDate =
    start.toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });

  const endDate =
    end.toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });

  return resolveScheduleByRange(
    startDate,
    endDate,
    "今週",
    context,
    userId
  );
}

function resolveNextWeekSchedule(context, userId) {
  const today = new Date();

  const day = today.getDay();

  // 今週の月曜日
  const diffToMonday =
    day === 0 ? -6 : 1 - day;

  const thisWeekMonday =
    new Date(today);

  thisWeekMonday.setDate(
    today.getDate() + diffToMonday
  );

  // 来週の月曜日
  const start =
    new Date(thisWeekMonday);

  start.setDate(
    thisWeekMonday.getDate() + 7
  );

  // 来週の日曜日
  const end =
    new Date(start);

  end.setDate(
    start.getDate() + 6
  );

  const startDate =
    start.toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  const endDate =
    end.toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  return resolveScheduleByRange(
    startDate,
    endDate,
    "来週",
    context,
    userId
  );
}

module.exports = {
  resolve,
  resolveByDateRange,
};