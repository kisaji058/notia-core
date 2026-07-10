const sessionManager = require("../session/SessionManager");
const taskManager = require("./TaskManager");

class ConversationManager {
  async handle(message, analysis, userId = "default") {
    const session = sessionManager.get(userId);

    // 1. 期日確認待ちへの回答
    if (session.mode === "waiting_due_date" && session.pendingTask) {
      const pendingTask = session.pendingTask;

      const wantsNoDueDate =
        message.includes("期限なし") ||
        message.includes("なし") ||
        message.includes("未定");

      if (!analysis.dueDate && !wantsNoDueDate) {
        return {
          handled: true,
          reply: "すみません、期限の日付がうまく読み取れませんでした。具体的な日付で教えてください。",
          analysis,
        };
      }

      const fixedAnalysis = {
        ...pendingTask,
        dueDate: wantsNoDueDate ? null : analysis.dueDate,
        needsDateConfirmation: false,
        dateExpression: null,
      };

      const result = taskManager.handle(fixedAnalysis);

      sessionManager.clear(userId);

      if (fixedAnalysis.intent === "task_update") {
        const dueText = fixedAnalysis.dueDate || "期限なし";

        return {
          handled: true,
          reply: `承知しました。\n「${fixedAnalysis.targetTaskTitle}」を ${dueText} 期限に更新しました。`,
          analysis: fixedAnalysis,
          taskResult: result,
        };
      }

      const dueText = fixedAnalysis.dueDate || "期限なし";

      return {
        handled: true,
        reply: `承知しました。\n「${fixedAnalysis.title}」を ${dueText} 期限で登録しました。`,
        analysis: fixedAnalysis,
        taskResult: result,
      };
    }

    // 2. 期日確認が必要
    const isNoDueDateRequest = analysis.dateExpression === "期限未指定";

    const hasDateExpression =
      analysis.dateExpression &&
      message.includes(analysis.dateExpression);

    if (
      analysis.needsDateConfirmation &&
      (hasDateExpression || isNoDueDateRequest)
    ) {
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

      const reply = isNoDueDateRequest
        ? `「${analysis.title}」の期限はいつにしますか？\n期限なしで登録する場合は「期限なし」と言ってください。`
        : `「${analysis.dateExpression}」とのことですが、期限は何日を想定していますか？`;

      return {
        handled: true,
        reply,
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