const sessionManager = require("../session/SessionManager");
const taskManager = require("./TaskManager");

class ConversationManager {
  async handle(message, analysis, userId = "default") {
    const session = sessionManager.get(userId);

    // 1. 期限確認待ちへの回答
    if (
      session.mode === "waiting_due_date" &&
      session.pendingTask
    ) {
      const pendingTask = session.pendingTask;

      const wantsNoDueDate =
        message.includes("期限なし") ||
        message.includes("期限はなし") ||
        message.includes("未定");

      // task_createではトップレベル、
      // task_updateではupdatesに日付が入る可能性がある
      const analyzedDueDate =
        analysis.updates?.dueDate ??
        analysis.dueDate ??
        null;

      if (!analyzedDueDate && !wantsNoDueDate) {
        return {
          handled: true,
          reply: [
            "すみません、期限の日付がうまく読み取れませんでした。",
            "「明日」「7月15日」のように教えてください。",
          ].join("\n"),
          analysis,
        };
      }

      const dueDate = wantsNoDueDate
        ? null
        : analyzedDueDate;

      let fixedAnalysis;

      // 既存タスクの期限変更
      if (pendingTask.intent === "task_update") {
        fixedAnalysis = {
          ...pendingTask,
          intent: "task_update",
          dueDate: null,
          needsDateConfirmation: false,
          dateExpression: null,

          updates: {
            title: null,
            description: null,
            dueDate: wantsNoDueDate
              ? null
              : dueDate,
            dueTime: null,
            priority: null,
            category: null,
            notification: null,
            ...(pendingTask.updates || {}),
          },

          // 「期限なし」を明示的な削除として区別する
          clearFields: wantsNoDueDate
            ? ["dueDate"]
            : [],
        };
      } else {
        // 新しいタスクの期限確定
        fixedAnalysis = {
          ...pendingTask,
          intent: "task_create",
          dueDate,
          dueTime:
            analysis.updates?.dueTime ??
            analysis.dueTime ??
            pendingTask.dueTime ??
            null,
          category:
            analysis.updates?.category ??
            analysis.category ??
            pendingTask.category ??
            null,
          notification:
            analysis.updates?.notification ??
            analysis.notification ??
            pendingTask.notification ??
            null,
          needsDateConfirmation: false,
          dateExpression: null,
        };
      }

      const result = taskManager.handle(fixedAnalysis);

      sessionManager.clear(userId);

      const dueText = dueDate || "期限なし";

      if (fixedAnalysis.intent === "task_update") {
        return {
          handled: true,
          reply: `承知しました。\n「${fixedAnalysis.targetTaskTitle}」の期限を ${dueText} に変更しました。`,
          analysis: fixedAnalysis,
          taskResult: result,
        };
      }

      return {
        handled: true,
        reply: `承知しました。\n「${fixedAnalysis.title}」を ${dueText} 期限で登録しました。`,
        analysis: fixedAnalysis,
        taskResult: result,
      };
    }

    // 2. 期限確認が必要
    const isNoDueDateRequest =
      analysis.dateExpression === "期限未指定";

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
          category: analysis.category,
          dueTime: analysis.dueTime,
          notification: analysis.notification,
          targetTaskId: analysis.targetTaskId,
          targetTaskTitle: analysis.targetTaskTitle,
          updates: analysis.updates || null,
        },
      });

      const reply = isNoDueDateRequest
        ? [
            `「${analysis.title}」の期限はいつにしますか？`,
            "期限なしで登録する場合は「期限なし」と言ってください。",
          ].join("\n")
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