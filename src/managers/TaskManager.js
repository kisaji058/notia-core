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
  const tasks =
    Array.isArray(analysis.tasks) && analysis.tasks.length > 0
      ? analysis.tasks
      : [
          {
            title: analysis.title,
            description: analysis.description,
            dueDate: analysis.dueDate,
            dueTime: analysis.dueTime,
            priority: analysis.priority,
            category: analysis.category,
            notification: analysis.notification,
          },
        ];

  const createdTasks = [];
  const duplicatedTasks = [];
  const processedTaskKeys = new Set();

  for (const task of tasks) {
    if (!task.title) {
      continue;
    }
  
  const taskKey = `${task.title}::${task.dueDate || ""}`;

if (processedTaskKeys.has(taskKey)) {
  console.log(
    "解析結果内の重複をスキップ:",
    task.title,
    task.dueDate || null
  );
  continue;
}

processedTaskKeys.add(taskKey);

    const existingTasks =
  findActiveTasks(
    task.title,
    task.dueDate || null
  );

    if (existingTasks.length > 0) {
      console.log("既存タスクあり:", task.title);
      duplicatedTasks.push(task.title);
      continue;
    }

    const taskId = addTask(
  task.title,
  task.description || "",
  task.dueDate || null,
  task.priority || "normal",
  task.category || "other",
  task.dueTime || null,
  task.notification || "none"
);

    console.log("✅ タスク登録:", task.title);

    createdTasks.push({
  id: taskId,
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate || null,
      dueTime: task.dueTime || null,
      priority: task.priority || "normal",
      category: task.category || "other",
      notification: task.notification || "none",
    });
  }

  return {
    created: createdTasks.length > 0,
    duplicated: duplicatedTasks.length > 0,
    createdTasks,
    duplicatedTasks,
  };
}

  handleUpdate(analysis) {
    if (!analysis.targetTaskId) {
      return {
        updated: false,
        reason: "target task not found",
      };
    }

    const allowedFields = [
      "title",
      "description",
      "dueDate",
      "dueTime",
      "priority",
      "category",
      "notification",
    ];

    const updates = {};

    for (const field of allowedFields) {
      const value = analysis.updates?.[field];

      if (value !== undefined && value !== null) {
        updates[field] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        updated: false,
        reason: "no updates",
        taskId: analysis.targetTaskId,
      };
    }

    const success = updateTaskById(
      analysis.targetTaskId,
      updates
    );

    console.log(
      "✅ タスク更新:",
      analysis.targetTaskId,
      updates
    );

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

    const success = completeTaskById(
      analysis.targetTaskId
    );

    console.log("✅ タスク完了:", analysis.targetTaskId);

    return {
      completed: success,
      taskId: analysis.targetTaskId,
    };
  }
}

module.exports = new TaskManager();