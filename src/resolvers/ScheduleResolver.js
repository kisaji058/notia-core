const {
  getTodayRoutines,
} = require("../../database");

function resolve(
  analysis,
  context
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
        context
      );

    case "tomorrow":
      return resolveTomorrowSchedule(
        context
      );

    case "this_week":
      return resolveThisWeekSchedule(
        context
      );

    case "next_week":
      return resolveNextWeekSchedule(
        context
      );

    default:
      return {
        handled: false,
        reply: null,
      };
  }
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
  context
) {
  console.log(
    "schedule targetDate:",
    targetDate
  );

  console.log(
    "activeTasks:",
    (context.activeTasks || []).map(
      (task) => ({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        due_time: task.due_time,
        status: task.status,
      })
    )
  );
  
  const tasks =
  getTasksByDate(
    targetDate,
    context
  );

  if (tasks.length === 0) {
    return {
      handled: true,
      reply: `${label}の予定はありません。`,
    };
  }

  const lines = tasks.map((task) => {
    if (task.due_time) {
      return `・${task.due_time} ${task.title}`;
    }

    return `・${task.title}`;
  });

  return {
    handled: true,
    reply:
      `${label}は${tasks.length}件あります。\n\n` +
      lines.join("\n"),
  };
}

function resolveScheduleByRange(
  startDate,
  endDate,
  label,
  context
) {
  const tasks = (context.activeTasks || [])
    .filter((task) => {
      if (!task.due_date) {
        return false;
      }

      return (
        task.due_date >= startDate &&
        task.due_date <= endDate
      );
    })
    .sort((a, b) => {
      if (a.due_date !== b.due_date) {
        return a.due_date.localeCompare(
          b.due_date
        );
      }

      const timeA =
        a.due_time || "99:99";

      const timeB =
        b.due_time || "99:99";

      return timeA.localeCompare(timeB);
    });

  if (tasks.length === 0) {
    return {
      handled: true,
      reply: `${label}の予定はありません。`,
    };
  }

  const lines = tasks.map((task) => {
    const dateLabel =
      formatScheduleDate(task.due_date);

    if (task.due_time) {
      return (
        `・${dateLabel} ` +
        `${task.due_time} ` +
        `${task.title}`
      );
    }

    return (
      `・${dateLabel} ` +
      `${task.title}`
    );
  });

  return {
    handled: true,
    reply:
      `${label}は${tasks.length}件あります。\n\n` +
      lines.join("\n"),
  };
}

function resolveTodaySchedule(context) {
  const today =
    new Date().toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  const tasks =
  getTasksByDate(
    today,
    context
  );

  const routines =
    getTodayRoutines();

  if (
    tasks.length === 0 &&
    routines.length === 0
  ) {
    return {
      handled: true,
      reply:
        "今日の予定はありません。",
    };
  }

  const sections = [];

  if (tasks.length > 0) {
    const taskLines =
      tasks.map((task) => {
        if (task.due_time) {
          return (
            `・${task.due_time} ` +
            `${task.title}`
          );
        }

        return `・${task.title}`;
      });

    sections.push(
      "📝 タスク\n" +
      taskLines.join("\n")
    );
  }

  if (routines.length > 0) {
    const routineLines =
      routines.map((routine) => {
        if (routine.routine_time) {
          return (
            `・${routine.routine_time} ` +
            `${routine.title}`
          );
        }

        return `・${routine.title}`;
      });

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

function resolveTomorrowSchedule(context) {
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
    context
  );
}

function resolveThisWeekSchedule(context) {
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
    context
  );
}

function resolveNextWeekSchedule(context) {
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
    context
  );
}

module.exports = {
  resolve,
};