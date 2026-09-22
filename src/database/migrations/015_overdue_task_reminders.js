"use strict";

module.exports = {
  name: "015_overdue_task_reminders",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS overdue_task_reminder_logs (
        user_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        reminder_key TEXT NOT NULL,
        sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, task_id, reminder_key),
        FOREIGN KEY (task_id)
          REFERENCES tasks(id)
          ON DELETE CASCADE
      )
    `).run();
  },
};
