const {
  getNotificationTargets,
  markTaskNotified,
} = require("../../database");

class NotificationManager {
  getTargets(date) {
    return getNotificationTargets(date);
  }

  getToday() {
    return new Date().toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );
  }

  checkNotifications() {
  const today = this.getToday();

  const tasks =
    this.getTargets(today);

  for (const task of tasks) {
    markTaskNotified(task.id);
  }

  return tasks;
}
}

module.exports = new NotificationManager();