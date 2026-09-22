"use strict";

const {
  getReminderKey,
  isReminderDue,
} = require("../managers/OverdueTaskReminder");

function createOverdueTaskReminderRepository(db) {
  const getTasks = db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND item_type = 'task'
      AND status = 'active'
      AND notification IS NOT NULL
      AND notification != 'none'
      AND due_date IS NOT NULL
      AND due_time IS NOT NULL
  `);

  const claimReminder = db.prepare(`
    INSERT OR IGNORE INTO overdue_task_reminder_logs (
      user_id,
      task_id,
      reminder_key
    )
    SELECT user_id, id, ?
    FROM tasks
    WHERE user_id = ?
      AND id = ?
      AND item_type = 'task'
      AND status = 'active'
      AND notification IS NOT NULL
      AND notification != 'none'
      AND due_date = ?
      AND due_time = ?
  `);

  function claimDueReminders(userId, now = new Date()) {
    const reminders = [];

    for (const task of getTasks.all(userId)) {
      if (!isReminderDue(task, now)) continue;

      const reminderKey = getReminderKey(task);
      const result = claimReminder.run(
        reminderKey,
        userId,
        task.id,
        task.due_date,
        task.due_time
      );

      if (result.changes === 1) {
        reminders.push(task);
      }
    }

    return reminders;
  }

  return { claimDueReminders };
}

module.exports = { createOverdueTaskReminderRepository };
