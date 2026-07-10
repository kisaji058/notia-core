class ConversationContextBuilder {
  build({
    conversations = [],
    activeTasks = [],
    session = null,
  } = {}) {
    return {
      history: this.buildHistory(conversations),
      activeTasks: this.buildActiveTasks(activeTasks),
      session: this.buildSession(session),
      currentTopic: this.buildCurrentTopic(conversations),
      recentActions: this.buildRecentActions(conversations),
    };
  }

  buildHistory(conversations) {
    if (!Array.isArray(conversations)) return "";

    return conversations
      .slice(-8)
      .map((conversation) => {
        const role = conversation.role || "unknown";
        const content =
          conversation.content ||
          conversation.message ||
          "";

        return `${role}: ${content}`;
      })
      .join("\n");
  }

  buildActiveTasks(activeTasks) {
    if (!Array.isArray(activeTasks)) return [];

    return activeTasks;
  }

  buildSession(session) {
    return session || null;
  }

  buildCurrentTopic() {
    return null;
  }

  buildRecentActions() {
    return [];
  }
}

module.exports = new ConversationContextBuilder();