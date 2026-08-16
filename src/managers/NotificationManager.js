const {
  getNotificationTargets,
  getEventNotificationTargets,
  markTaskNotified,
  markEventNotified,
} = require("../../database");

const NOTIFICATION_OFFSETS = {
  at_time: 0,
  "10_minutes_before": 10,
  "30_minutes_before": 30,
  "1_hour_before": 60,
};

class NotificationManager {
  getTargets(
  userId,
  date
) {
  const tasks =
    getNotificationTargets(
      userId,
      date
    )
      .map((task) => ({
        ...task,
        notificationSource: "task",
      }));

  const events =
    getEventNotificationTargets(
      userId,
      date
    )
      .map((event) => ({
        ...event,
        notificationSource: "event",
      }));

  return [
    ...tasks,
    ...events,
  ];
}

  getToday(date = new Date()) {
    return date.toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );
  }

  getTomorrow(date = new Date()) {
    const tomorrow = new Date(
      date.getTime() + 24 * 60 * 60 * 1000
    );

    return this.getToday(tomorrow);
  }

  isNotificationDue(task, now) {
    if (task.notification === "same_day") {
      return task.due_date === this.getToday(now);
    }

    if (task.notification === "day_before") {
      return task.due_date === this.getTomorrow(now);
    }

    const offsetMinutes =
      NOTIFICATION_OFFSETS[
        task.notification
      ];

    if (
      offsetMinutes === undefined ||
      !task.due_date ||
      !task.due_time
    ) {
      return false;
    }

    const dueTime =
      String(task.due_time).slice(0, 5);

    const dueAt = new Date(
      `${task.due_date}T${dueTime}:00+09:00`
    );

    if (
      Number.isNaN(dueAt.getTime())
    ) {
      return false;
    }

    const notificationAt =
      dueAt.getTime() -
      offsetMinutes * 60 * 1000;

    const difference =
      now.getTime() - notificationAt;

    return (
      difference >= 0 &&
      difference < 2 * 60 * 1000
    );
  }

  checkNotifications(userId) {
  const now = new Date();
  const today = this.getToday(now);

  const targets =
    this.getTargets(
      userId,
      today
    );

  const notificationTargets =
    targets.filter((item) =>
      this.isNotificationDue(
        item,
        now
      )
    );

  for (const item of notificationTargets) {
    if (
      item.notificationSource === "event"
    ) {
      markEventNotified(
        userId,
        item.id
      );
    } else {
      markTaskNotified(
        userId,
        item.id
      );
    }
  }

  return notificationTargets;
}
}

module.exports =
  new NotificationManager();