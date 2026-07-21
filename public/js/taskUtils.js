const priorityIcons = {
  high: "🔴",
  normal: "🟡",
  low: "🟢",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCategoryLabel(category) {
  const labels = {
    work: "仕事",
    school: "学校",
    shopping: "買い物",
    private: "プライベート",
    other: "その他",
  };

  return labels[category] ?? labels.other;
}

function getSortLabel(sort) {
  switch (sort) {
    case "priority":
      return "優先度順";

    case "newest":
      return "新しい順";

    case "oldest":
      return "古い順";

    default:
      return "期限が近い順";
  }
}

function formatCompletedDate(completedAt) {
  if (!completedAt) {
    return "完了日不明";
  }

  return `完了：${completedAt.slice(0, 10)}`;
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "期限なし";
  }

  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const dueDateObject = new Date(
    `${dueDate}T00:00:00+09:00`
  );

  if (Number.isNaN(dueDateObject.getTime())) {
    return dueDate;
  }

  const diffDays = Math.round(
    (dueDateObject - todayDate) /
      (1000 * 60 * 60 * 24)
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