class ConversationReferenceResolver {
  resolve(message, { conversations = [], activeTasks = [] } = {}) {
    if (!this.isImplicitTaskReference(message)) {
      return null;
    }

    const targetTask = this.findRecentTask(conversations, activeTasks);

    if (!targetTask) {
      return null;
    }

    return {
      type: "task",
      targetTaskId: targetTask.id,
      targetTaskTitle: targetTask.title,
      confidence: 0.9,
    };
  }

  isImplicitTaskReference(message) {
    if (typeof message !== "string") return false;

    const normalizedMessage = message.trim();

    const referencePatterns = [
      /^(それ|あれ|これ|そのタスク|このタスク)$/,
      /(終わった|できた|完了した|済んだ|やった)$/,
      /(期限|締切).*(変えて|変更して|直して)$/,
      /タイトル.*(変えて|変更して|直して)$/,
      /説明.*(追加して|変えて|変更して)$/,
    ];

    return referencePatterns.some((pattern) =>
      pattern.test(normalizedMessage)
    );
  }

  findRecentTask(conversations, activeTasks) {
    if (!Array.isArray(activeTasks) || activeTasks.length === 0) {
      return null;
    }

    const validTasks = activeTasks.filter(
      (task) => task && task.id != null && typeof task.title === "string"
    );

    if (validTasks.length === 0) {
      return null;
    }

    const recentConversations = Array.isArray(conversations)
      ? [...conversations].reverse()
      : [];

    for (const conversation of recentConversations) {
      const content =
        conversation?.content ||
        conversation?.message ||
        "";

      if (typeof content !== "string") continue;

      const matchedTask = validTasks.find((task) =>
        content.includes(task.title)
      );

      if (matchedTask) {
        return matchedTask;
      }
    }

    if (validTasks.length === 1) {
      return validTasks[0];
    }

    return null;
  }
}

module.exports = new ConversationReferenceResolver();
