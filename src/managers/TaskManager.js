const {
  addTask,
  findActiveTasks,
  updateTaskById,
} = require("../../database");

class TaskManager {
  handle(analysis) {
    if (!analysis || !analysis.intent) {
      return null;
    }
if (analysis.intent === "task_update") {
  if (!analysis.targetTaskId) {
    return {
      updated: false,
      reason: "target task not found",
    };
  }

  const updates = {};

  if (analysis.title) {
    updates.title = analysis.title;
  }

  if (analysis.description) {
    updates.description = analysis.description;
  }

  if (analysis.dueDate) {
    updates.dueDate = analysis.dueDate;
  }

  const success = updateTaskById(analysis.targetTaskId, updates);

  console.log("✅ タスク更新:", analysis.targetTaskId, updates);

  return {
    updated: success,
    title: analysis.title,
    taskId: analysis.targetTaskId,
  };
}


    if (analysis.intent !== "task_create") {
      return null;
    }

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

    addTask(
      analysis.title,
      analysis.description || "",
      analysis.dueDate || ""
    );

    console.log("✅ タスク登録:", analysis.title);

    return {
      created: true,
      duplicated: false,
      title: analysis.title,
      description: analysis.description,
      dueDate: analysis.dueDate,
    };
  }
}

module.exports = new TaskManager();