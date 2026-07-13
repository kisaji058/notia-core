function createTaskResultReply(taskResult, analysis) {
  if (!taskResult) {
    return null;
  }

  if (taskResult.reason === "target task not found") {
    return [
      "一致するタスクが見つかりませんでした。",
      "「タスク一覧」と送ると、現在のタスクを確認できます。",
    ].join("\n");
  }

  if (taskResult.reason === "no updates") {
    return [
      "変更する内容を読み取れませんでした。",
      "期限・時間・分類・優先度・通知など、変更したい内容を教えてください。",
    ].join("\n");
  }

  if (taskResult.updated) {
    return createUpdateReply(taskResult, analysis);
  }

  if (taskResult.created) {
    const title =
      analysis.title ||
      taskResult.title ||
      "タスク";

    return analysis.dueDate
      ? `承知しました。\n「${title}」を ${analysis.dueDate} 期限で登録しました。`
      : `承知しました。\n「${title}」を登録しました。`;
  }

  if (taskResult.completed) {
    const title =
      analysis.targetTaskTitle ||
      analysis.title ||
      taskResult.title ||
      "タスク";

    return `承知しました。\n「${title}」を完了にしました。`;
  }

  if (taskResult.duplicated) {
    return `「${taskResult.title}」はすでに登録されています。`;
  }

  return "タスクを処理できませんでした。もう一度内容を確認してください。";
}

function createUpdateReply(taskResult, analysis) {
  const updates = taskResult.updates || {};

  const originalTitle =
    analysis.targetTaskTitle ||
    "タスク";

  const categoryLabels = {
    work: "仕事",
    school: "学校",
    shopping: "買い物",
    private: "プライベート",
    other: "その他",
  };

  const priorityLabels = {
    high: "高",
    normal: "通常",
    low: "低",
  };

  const notificationLabels = {
    none: "なし",
    same_day: "当日",
    day_before: "前日",
  };

  const changedItems = [];

  if (updates.title !== undefined) {
    changedItems.push(
      `タスク名を「${updates.title}」に`
    );
  }

  if (updates.description !== undefined) {
    changedItems.push("説明を更新");
  }

  if (updates.dueDate !== undefined) {
    changedItems.push(
      `期限を${updates.dueDate || "期限なし"}に`
    );
  }

  if (updates.dueTime !== undefined) {
    changedItems.push(
      `時間を${updates.dueTime || "指定なし"}に`
    );
  }

  if (updates.priority !== undefined) {
    const priority =
      priorityLabels[updates.priority] ||
      updates.priority;

    changedItems.push(`優先度を${priority}に`);
  }

  if (updates.category !== undefined) {
    const category =
      categoryLabels[updates.category] ||
      updates.category;

    changedItems.push(`分類を${category}に`);
  }

  if (updates.notification !== undefined) {
    const notification =
      notificationLabels[updates.notification] ||
      updates.notification;

    changedItems.push(`通知を${notification}に`);
  }

  if (changedItems.length === 0) {
    return `承知しました。\n「${originalTitle}」を更新しました。`;
  }

  return [
    "承知しました。",
    `「${originalTitle}」の${changedItems.join("、")}変更しました。`,
  ].join("\n");
}

module.exports = {
  createTaskResultReply,
};