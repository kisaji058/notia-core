class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  get(userId = "default") {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        mode: "normal",
        pendingTask: null,
      });
    }

    return this.sessions.get(userId);
  }

  set(userId = "default", newState = {}) {
    const currentState = this.get(userId);

    const updatedState = {
      ...currentState,
      ...newState,
    };

    this.sessions.set(userId, updatedState);

    return updatedState;
  }

  clear(userId = "default") {
    this.sessions.set(userId, {
      mode: "normal",
      pendingTask: null,
    });

    return this.get(userId);
  }
}

module.exports = new SessionManager();