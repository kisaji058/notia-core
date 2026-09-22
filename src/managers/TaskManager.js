const {
  addTask,
  addEvent,
  findActiveTasks,
  updateTaskById,
  getActiveEvents,
  getEventById,
  updateEventById,
  completeTask,
  addSecretaryExp,
} = require("../../database");

class TaskManager {
  handle(analysis, userId) {
  if (!userId) {
    throw new Error(
      "TaskManager: userId is required"
    );
  }
    if (!analysis || !analysis.intent) {
      return null;
    }

    if (analysis.intent === "task_create") {
      return this.handleCreate(
  analysis,
  userId
);
    }

    if (analysis.intent === "task_update") {
      return this.handleUpdate(
  analysis,
  userId
);
    }

    if (analysis.intent === "task_complete") {
      return this.handleComplete(
  analysis,
  userId
);
    }

    return null;
  }

  handleCreate(analysis, userId) {
  const tasks =
    Array.isArray(analysis.tasks) && analysis.tasks.length > 0
      ? analysis.tasks
      : [
          {
            title: analysis.title,
            description: analysis.description,
            dueDate: analysis.dueDate,
            dueTime: analysis.dueTime,
            endDate: analysis.endDate,
            endTime: analysis.endTime,
            priority: analysis.priority,
            category: analysis.category,
            notification: analysis.notification,
            itemType: analysis.itemType,
            location: analysis.location,
          },
        ];

  const createdTasks = [];
  const duplicatedTasks = [];
  const processedTaskKeys = new Set();

  for (const task of tasks) {
    if (!task.title) {
      continue;
    }
  
  const taskKey =
  `${task.title}::${task.dueDate || ""}::${task.dueTime || ""}`;

if (processedTaskKeys.has(taskKey)) {
  console.log(
    "解析結果内の重複をスキップ:",
    task.title,
    task.dueDate || null
  );
  continue;
}

processedTaskKeys.add(taskKey);

if (task.itemType === "event") {
  if (!task.dueDate) {
    console.log(
      "予定の日付がないため登録をスキップ:",
      task.title
    );
    continue;
  }

  const eventId = addEvent(
  userId,
  task.title,
  task.description || "",
  task.dueDate,
  task.dueTime || null,
  task.endTime || null,
  task.location || "",
  task.priority || "normal",
  task.category || "other",
  task.notification || "none",
  task.endDate || task.dueDate
);

  console.log("✅ 予定登録:", task.title);

  addSecretaryExp(
    userId,
    3
  );

  createdTasks.push({
  id: eventId,
  title: task.title,
  description:
    task.description || "",
  dueDate: task.dueDate,
  dueTime:
    task.dueTime || null,
  endDate:
    task.endDate || task.dueDate,
  endTime:
    task.endTime || null,
  priority:
    task.priority || "normal",
  category:
    task.category || "other",
  notification:
    task.notification || "none",
  itemType: "event",
});

  continue;
}

    const existingTasks =
  findActiveTasks(
    userId,
    task.title,
    task.dueDate || null,
    task.dueTime || null
  );

    if (existingTasks.length > 0) {
      console.log("既存タスクあり:", task.title);
      duplicatedTasks.push(task.title);
      continue;
    }

    const taskId = addTask(
  userId,
  task.title,
  task.description || "",
  task.dueDate || null,
  task.priority || "normal",
  task.category || "other",
  task.dueTime || null,
  task.notification || "none",
  task.itemType === "event"
    ? "event"
    : "task",
  task.location || ""
);

    console.log("✅ タスク登録:", task.title);

    addSecretaryExp(
      userId,
      2
    );

    createdTasks.push({
  id: taskId,
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate || null,
      dueTime: task.dueTime || null,
      priority: task.priority || "normal",
      category: task.category || "other",
      notification: task.notification || "none",
      itemType:
  task.itemType === "event"
    ? "event"
    : "task",
    });
  }

  return {
    created: createdTasks.length > 0,
    duplicated: duplicatedTasks.length > 0,
    createdTasks,
    duplicatedTasks,
  };
}

  handleUpdate(analysis, userId) {
    if (
      analysis.updates?.location != null &&
      analysis.targetEventId == null
    ) {
      return {
        updated: false,
        reason: "ambiguous event",
      };
    }

    if (
      analysis.targetEventId != null &&
      analysis.targetTaskId != null
    ) {
      return {
        updated: false,
        reason: "ambiguous event",
      };
    }

    if (analysis.targetEventId != null) {
      const eventId = Number(analysis.targetEventId);
      const targetTitle = analysis.targetTaskTitle;
      const location = analysis.updates?.location;

      const otherUpdates = Object.entries(analysis.updates || {})
        .filter(([field, value]) =>
          field !== "location" && value !== null && value !== undefined
        );

      if (otherUpdates.length > 0) {
        return {
          updated: false,
          reason: "unsupported event update",
        };
      }

      if (
        !Number.isSafeInteger(eventId) ||
        eventId <= 0 ||
        typeof targetTitle !== "string" ||
        !targetTitle.trim()
      ) {
        return {
          updated: false,
          reason: "target task not found",
        };
      }

      const event = getEventById(userId, eventId);

      if (
        !event ||
        event.status !== "active" ||
        event.title !== targetTitle.trim()
      ) {
        return {
          updated: false,
          reason: "target task not found",
        };
      }

      const targetEventDate = analysis.targetEventDate;

      if (
        targetEventDate != null &&
        (
          typeof targetEventDate !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(targetEventDate)
        )
      ) {
        return {
          updated: false,
          reason: "ambiguous event",
        };
      }

      if (
        targetEventDate != null &&
        !(
          event.event_date <= targetEventDate &&
          (event.end_date || event.event_date) >= targetEventDate
        )
      ) {
        return {
          updated: false,
          reason: "ambiguous event",
        };
      }

      const matchingEvents = getActiveEvents(userId).filter(
        (candidate) =>
          candidate.title === event.title &&
          (
            targetEventDate == null ||
            (
              candidate.event_date <= targetEventDate &&
              (candidate.end_date || candidate.event_date) >= targetEventDate
            )
          )
      );

      if (matchingEvents.length !== 1 ||
          matchingEvents[0].id !== event.id) {
        return {
          updated: false,
          reason: "ambiguous event",
        };
      }

      if (typeof location !== "string" || !location.trim()) {
        return {
          updated: false,
          reason: "no updates",
        };
      }

      const success = updateEventById(userId, event.id, {
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        location: location.trim(),
        items_to_bring: event.items_to_bring,
        priority: event.priority,
        category: event.category,
        notification: event.notification,
        status: event.status,
      });

      return {
        updated: success,
        taskId: event.id,
        updates: { location: location.trim() },
      };
    }

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
      userId,
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

  handleComplete(analysis, userId) {
    if (!analysis.targetTaskId) {
      return {
        completed: false,
        reason: "target task not found",
      };
    }

    const success = completeTask(
      userId,
      analysis.targetTaskId
    );

    if (success) {
      addSecretaryExp(
        userId,
        5
      );
    }

    console.log("✅ タスク完了:", analysis.targetTaskId);

    return {
      completed: success,
      taskId: analysis.targetTaskId,
    };
  }
}

module.exports = new TaskManager();