function formatDueDate(dueDate) {
  if (!dueDate) {
    return "期限なし";
  }

  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const dueDateObj = new Date(`${dueDate}T00:00:00+09:00`);

  const diffDays = Math.round(
    (dueDateObj - todayDate) / (1000 * 60 * 60 * 24)
  );

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

function isTaskListRequest(message) {
  return (
    message.includes("タスク一覧") ||
    message.includes("タスクを見せて") ||
    message.includes("タスク見せて") ||
    message.includes("タスク確認") ||
    message.includes("期日を日付で") ||
    message.includes("期限を日付で")
  );
}

function createTaskListReply(tasks) {
  if (tasks.length === 0) {
    return "現在、未完了のタスクはありません。";
  }

  return tasks
    .map((task, index) => {
      const due = formatDueDate(task.due_date);

      return `${index + 1}. ${due}：${task.title}`;
    })
    .join("\n");
}

function formatTasksForApi(tasks) {
  return tasks.map((task) => ({
    ...task,
    due_date_label: formatDueDate(task.due_date),
  }));
}

module.exports = {
  formatDueDate,
  isTaskListRequest,
  createTaskListReply,
  formatTasksForApi,
};