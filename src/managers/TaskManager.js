const {
  addTask,
  findActiveTasks,
  updateTaskById,
  completeTaskById,
} = require("../../database");

class TaskManager {
  handle(analysis) {
    if (!analysis || !analysis.intent) {
      return null;
    }

    if (analysis.intent === "task_create") {
      return this.handleCreate(analysis);
    }

    if (analysis.intent === "task_update") {
      return this.handleUpdate(analysis);
    }

    if (analysis.intent === "task_complete") {
      return this.handleComplete(analysis);
    }

    return null;
  }

  handleCreate(analysis) {
    if (!analysis.title) {
      return null;
    }

    const existingTasks = findActiveTasks(analysis.title);

    if (existingTasks.length > 0) {
      console.log("既存タスクあり:", analysis.title);

      return {
        created: false,
        duplicated: true,
        title: analysis.title,
      };
    }

    const dueDate = analysis.dueDate || null;

    addTask(
      analysis.title,
      analysis.description || "",
      dueDate
    );

    console.log("✅ タスク登録:", analysis.title);

    return {
      created: true,
      duplicated: false,
      title: analysis.title,
      description: analysis.description || "",
      dueDate,
    };
  }

  handleUpdate(analysis) {
    if (!analysis.targetTaskId) {
      return {
        updated: false,
        reason: "target task not found",
      };
    }

    const updates = {};

    if (analysis.title !== undefined && analysis.title !== null) {
      updates.title = analysis.title;
    }

    if (analysis.description !== undefined && analysis.description !== null) {
      updates.description = analysis.description;
    }

    if (analysis.dueDate !== undefined) {
      updates.dueDate = analysis.dueDate || null;
    }

    if (Object.keys(updates).length === 0) {
      return {
        updated: false,
        reason: "no updates",
        taskId: analysis.targetTaskId,
      };
    }

    const success = updateTaskById(analysis.targetTaskId, updates);

    console.log("✅ タスク更新:", analysis.targetTaskId, updates);

    return {
      updated: success,
      taskId: analysis.targetTaskId,
      updates,
    };
  }

  handleComplete(analysis) {
    if (!analysis.targetTaskId) {
      return {
        completed: false,
        reason: "target task not found",
      };
    }

    const success = completeTaskById(analysis.targetTaskId);

    console.log("✅ タスク完了:", analysis.targetTaskId);

    return {
      completed: success,
      taskId: analysis.targetTaskId,
    };
  }
}

module.exports = new TaskManager();