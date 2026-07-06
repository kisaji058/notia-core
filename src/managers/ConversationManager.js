const sessionManager = require("../session/SessionManager");

const {
  completeTaskById,
} = require("../../database");

class ConversationManager {
  async handle(message, analysis, userId = "default") {
    const session = sessionManager.get(userId);

    // 1. 確認待ちタスクへの回答
    if (session.mode === "waiting_task_due_date" && session.pendingTask) {
      sessionManager.clear(userId);

      return {
        handled: false,
        systemHint: "",
        analysis,
      };
    }

    // 2. タスク完了
    if (analysis.intent === "task_complete" && analysis.targetTaskId) {
      completeTaskById(analysis.targetTaskId);

      return {
        handled: true,
        reply: `承知しました。\n「${analysis.targetTaskTitle || analysis.title}」を完了にしました。お疲れさまでした。`,
        analysis,
      };
    }

if (analysis.intent === "task_update") {
  return {
    handled: true,
    reply: "承知しました。タスクの期限を更新しました。",
    systemHint: null,
  };
}

    // 3. 通常会話へ
    return {
      handled: false,
      systemHint: "",
      analysis,
    };
  }
}

module.exports = new ConversationManager();