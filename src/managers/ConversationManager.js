const sessionManager = require("../session/SessionManager");
const taskManager = require("./TaskManager");

class ConversationManager {
  async handle(message, analysis, userId = "default") {
    const session = sessionManager.get(userId);

    // 1. 曖昧な期日の確認待ちへの回答
    if (session.mode === "waiting_due_date" && session.pendingTask) {
      const pendingTask = session.pendingTask;

      // 返答で日付が確定できなかった場合
      if (!analysis.dueDate) {
        return {
          handled: true,
          reply: "すみません、期限の日付がうまく読み取れませんでした。具体的な日付で教えてください。",
          analysis,
        };
      }

      const fixedAnalysis = {
        ...pendingTask,
        dueDate: analysis.dueDate,
        needsDateConfirmation: false,
        dateExpression: null,
      };

      const result = taskManager.handle(fixedAnalysis);

      sessionManager.clear(userId);

      return {
        handled: true,
        reply: `承知しました。\n「${fixedAnalysis.title}」を ${fixedAnalysis.dueDate} 期限で登録しました。`,
        analysis: fixedAnalysis,
        taskResult: result,
      };
    }

    // 2. 新規タスクで期日確認が必要
    if (analysis.needsDateConfirmation) {
      sessionManager.set(userId, {
        mode: "waiting_due_date",
        pendingTask: {
          intent: analysis.intent,
          title: analysis.title,
          description: analysis.description,
          priority: analysis.priority,
          targetTaskId: analysis.targetTaskId,
          targetTaskTitle: analysis.targetTaskTitle,
        },
      });

      return {
        handled: true,
        reply: `「${analysis.dateExpression}」とのことですが、期限は何日を想定していますか？`,
        analysis,
      };
    }

    // 3. 通常は未処理として返す
    return {
      handled: false,
      systemHint: "",
      analysis,
    };
  }
}

module.exports = new ConversationManager();