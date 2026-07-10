function getToday() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
}

function getDiffDays(dueDate) {
  if (!dueDate) {
    return null;
  }

  const today = getToday();

  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const dueDateObj = new Date(`${dueDate}T00:00:00+09:00`);

  if (Number.isNaN(dueDateObj.getTime())) {
    return null;
  }

  return Math.round(
    (dueDateObj - todayDate) / (1000 * 60 * 60 * 24)
  );
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "期限なし";
  }

  const diffDays = getDiffDays(dueDate);

  if (diffDays === null) {
    return dueDate;
  }

  if (diffDays < 0) {
    return `期限超過（${Math.abs(diffDays)}日）`;
  }

  if (diffDays === 0) {
    return "本日中";
  }

  if (diffDays === 1) {
    return "明日";
  }

  if (diffDays === 2) {
    return "明後日";
  }

  return dueDate;
}

function getTaskGroup(task) {
  if (!task.due_date) {
    return "noDueDate";
  }

  const diffDays = getDiffDays(task.due_date);

  if (diffDays === null) {
    return "noDueDate";
  }

  if (diffDays < 0) {
    return "overdue";
  }

  if (diffDays === 0) {
    return "today";
  }

  if (diffDays === 1) {
    return "tomorrow";
  }

  if (diffDays <= 7) {
    return "thisWeek";
  }

  return "later";
}

function isTaskListRequest(message) {
  if (typeof message !== "string") {
    return false;
  }

  return (
    message.includes("タスク一覧") ||
    message.includes("タスクを見せて") ||
    message.includes("タスク見せて") ||
    message.includes("タスク確認") ||
    message.includes("期日を日付で") ||
    message.includes("期限を日付で")
  );
}

function sortTasksByDueDate(tasks) {
  return [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) {
      return 0;
    }

    if (!a.due_date) {
      return 1;
    }

    if (!b.due_date) {
      return -1;
    }

    return a.due_date.localeCompare(b.due_date);
  });
}

function formatTaskLines(tasks) {
  return sortTasksByDueDate(tasks)
    .map((task) => {
      const due = formatDueDate(task.due_date);

      return `・${task.title}（${due}）`;
    })
    .join("\n");
}

function createTaskListReply(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return "現在、未完了のタスクはありません。";
  }

  const groups = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDueDate: [],
  };

  for (const task of tasks) {
    const group = getTaskGroup(task);
    groups[group].push(task);
  }

  const sections = [
    {
      title: "⏰ 期限切れ",
      tasks: groups.overdue,
    },
    {
      title: "📅 今日",
      tasks: groups.today,
    },
    {
      title: "📅 明日",
      tasks: groups.tomorrow,
    },
    {
      title: "🗓 今週",
      tasks: groups.thisWeek,
    },
    {
      title: "📌 それ以降",
      tasks: groups.later,
    },
    {
      title: "📝 期限なし",
      tasks: groups.noDueDate,
    },
  ];

  return sections
    .filter((section) => section.tasks.length > 0)
    .map((section) => {
      return `${section.title}\n${formatTaskLines(section.tasks)}`;
    })
    .join("\n\n");
}

function formatTasksForApi(tasks = []) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks.map((task) => ({
    ...task,
    due_date_label: formatDueDate(task.due_date),
    due_date_group: getTaskGroup(task),
  }));
}

module.exports = {
  getDiffDays,
  formatDueDate,
  getTaskGroup,
  isTaskListRequest,
  createTaskListReply,
  formatTasksForApi,
};