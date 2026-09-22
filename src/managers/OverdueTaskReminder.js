"use strict";

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 10 * 60 * 1000;

function getReminderKey(task) {
  if (
    task?.item_type !== "task" ||
    task.status !== "active" ||
    !task.notification ||
    task.notification === "none" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(task.due_date || "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.due_time || "")
  ) {
    return null;
  }

  return `${task.due_date}T${task.due_time}`;
}

function isReminderDue(task, now = new Date()) {
  const key = getReminderKey(task);
  if (!key) return false;

  const dueAt = new Date(`${key}:00+09:00`);
  if (Number.isNaN(dueAt.getTime())) return false;

  const elapsed = now.getTime() - dueAt.getTime();

  return elapsed >= HOUR_MS && elapsed < HOUR_MS + WINDOW_MS;
}

module.exports = {
  getReminderKey,
  isReminderDue,
};
