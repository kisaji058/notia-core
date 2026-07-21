function createTaskResultReply(taskResult, analysis = {}) {
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
    return createTaskUpdatedReply(
      taskResult,
      analysis
    );
  }

  if (taskResult.created) {
    return createTaskCreatedReply(
      taskResult,
      analysis
    );
  }

  if (taskResult.completed) {
    return createTaskCompletedReply(
      taskResult,
      analysis
    );
  }

  if (taskResult.duplicated) {
    return `「${taskResult.duplicatedTasks[0]}」はすでに登録されています。`;
  }

  return [
    "タスクを処理できませんでした。",
    "もう一度内容を確認してください。",
  ].join("\n");
}

function createTaskCreatedReply(
  taskResult,
  analysis
) {
  const title =
    analysis.title ||
    taskResult.title ||
    "タスク";

  const dueText =
    formatDueDateForReply(
      analysis.dueDate
    );

  const timeText =
    formatDueTimeForReply(
      analysis.dueTime
    );

  let scheduleText = "";

  if (dueText && timeText) {
    scheduleText = `${dueText} ${timeText}で`;
  } else if (dueText) {
    scheduleText = `${dueText}までのタスクとして`;
  } else if (timeText) {
    scheduleText = `${timeText}で`;
  }

  const reply = scheduleText
    ? `承知しました。\n「${title}」を${scheduleText}登録しました。`
    : `承知しました。\n「${title}」を登録しました。`;

  return appendAdvice(
    reply,
    taskResult,
    analysis
  );
}

function createTaskUpdatedReply(
  taskResult,
  analysis
) {
  const title =
    analysis.targetTaskTitle ||
    analysis.title ||
    taskResult.title ||
    "タスク";

  const changedItems =
    getChangedItems(taskResult);

  const reply =
    buildUpdatedReply(
      title,
      changedItems,
      taskResult.updates || {}
    );

  return appendAdvice(
    reply,
    taskResult,
    analysis
  );
}

function createTaskCompletedReply(
  taskResult,
  analysis
) {
  const title =
    analysis.targetTaskTitle ||
    analysis.title ||
    taskResult.title ||
    "タスク";

  return [
    "承知しました。",
    `「${title}」を完了にしました。`,
    "",
    "お疲れさまでした。",
  ].join("\n");
}

function getChangedItems(taskResult) {
  const updates =
    taskResult.updates || {};

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
    const dueText =
      updates.dueDate
        ? formatDueDateForReply(
            updates.dueDate
          )
        : "期限なし";

    changedItems.push(
      `期限を${dueText}に`
    );
  }

  if (updates.dueTime !== undefined) {
    const timeText =
      updates.dueTime ||
      "指定なし";

    changedItems.push(
      `時間を${timeText}に`
    );
  }

  if (updates.priority !== undefined) {
    const priority =
      priorityLabels[updates.priority] ||
      updates.priority;

    changedItems.push(
      `優先度を${priority}に`
    );
  }

  if (updates.category !== undefined) {
    const category =
      categoryLabels[updates.category] ||
      updates.category;

    changedItems.push(
      `分類を${category}に`
    );
  }

  if (updates.notification !== undefined) {
    const notification =
      notificationLabels[
        updates.notification
      ] ||
      updates.notification;

    changedItems.push(
      `通知を${notification}に`
    );
  }

  return changedItems;
}

function buildUpdatedReply(
  title,
  changedItems,
  updates
) {
  const hasDueDate =
    updates.dueDate !== undefined;

  const hasDueTime =
    updates.dueTime !== undefined;

  if (hasDueDate || hasDueTime) {
    const dueText =
      updates.dueDate
        ? formatDueDateForReply(
            updates.dueDate
          )
        : null;

    const timeText =
      updates.dueTime || null;

    const scheduleText = [
      dueText,
      timeText,
    ]
      .filter(Boolean)
      .join(" ");

    if (scheduleText) {
      return [
        "承知しました。",
        `「${title}」を${scheduleText}へ変更しました。`,
      ].join("\n");
    }
  }

  if (changedItems.length === 0) {
    return [
      "承知しました。",
      `「${title}」を更新しました。`,
    ].join("\n");
  }

  return [
    "承知しました。",
    `「${title}」の${changedItems.join("、")}変更しました。`,
  ].join("\n");
}

function formatDueDateForReply(dueDate) {
  if (!dueDate) {
    return null;
  }

  const todayString =
    new Date().toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  const today =
    new Date(
      `${todayString}T00:00:00+09:00`
    );

  const target =
    new Date(
      `${dueDate}T00:00:00+09:00`
    );

  const diffDays =
    Math.round(
      (target - today) /
      (1000 * 60 * 60 * 24)
    );

  if (diffDays === 0) {
    return "今日";
  }

  if (diffDays === 1) {
    return "明日";
  }

  if (diffDays === 2) {
    return "明後日";
  }

  return target.toLocaleDateString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "short",
    }
  );
}

function formatDueTimeForReply(dueTime) {
  if (!dueTime) {
    return null;
  }

  return dueTime;
}

function appendAdvice(
  reply,
  taskResult,
  analysis
) {
  if (!reply) {
    return reply;
  }

  const advice =
    createTaskAdvice(
      taskResult,
      analysis
    );

  if (!advice) {
    return reply;
  }

  return `${reply}\n\n${advice}`;
}

function createTaskAdvice(
  taskResult,
  analysis
) {
  if (!taskResult || !analysis) {
    return null;
  }

  const updates =
    taskResult.updates || {};

  // =====================
  // 新規登録
  // =====================

  // 日付は決まったが、時間が未設定
  if (
    taskResult.created &&
    analysis.dueDate &&
    !analysis.dueTime
  ) {
    return "時間は決まっていますか？";
  }

  // 日付と時間が最初から決まっている
  if (
    taskResult.created &&
    analysis.dueDate &&
    analysis.dueTime &&
    (
      !analysis.notification ||
      analysis.notification === "none"
    )
  ) {
    return "必要であれば、通知も設定できます。";
  }

  // =====================
  // 更新
  // =====================

  // 時間を後から設定・変更した
  if (
    taskResult.updated &&
    updates.dueTime !== undefined &&
    updates.dueTime &&
    updates.notification === undefined
  ) {
    return "必要であれば、通知も設定できます。";
  }

  return null;
}

module.exports = {
  createTaskResultReply,
};