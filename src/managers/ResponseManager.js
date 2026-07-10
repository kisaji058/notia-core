function createTaskResultReply(taskResult, analysis) {
  if (!taskResult) {
    return null;
  }

  if (
    taskResult.reason === "target task not found"
  ) {
    return [
      "一致するタスクが見つかりませんでした。",
      "「タスク一覧」と送ると、現在のタスクを確認できます。",
    ].join("\n");
  }

  if (taskResult.reason === "no updates") {
    return [
      "変更する内容を読み取れませんでした。",
      "期限・タイトル・説明のどれを変更するか教えてください。",
    ].join("\n");
  }

  if (taskResult.updated) {
    const title =
      analysis.targetTaskTitle ||
      analysis.title ||
      "タスク";

    if (analysis.dueDate !== undefined) {
      const dueDate = analysis.dueDate || "期限なし";

      return `承知しました。\n「${title}」の期限を ${dueDate} に更新しました。`;
    }

    if (analysis.title) {
      return `承知しました。\nタスク名を「${analysis.title}」に変更しました。`;
    }

    if (analysis.description) {
      return `承知しました。\n「${title}」の説明を更新しました。`;
    }

    return `承知しました。\n「${title}」を更新しました。`;
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

module.exports = {
  createTaskResultReply,
};