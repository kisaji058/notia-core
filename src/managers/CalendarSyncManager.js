const {
  getUnsyncedTimedTasks,
  getUnsyncedEvents,
  saveEventCalendarLink,
  saveExternalCalendarEvent,
  saveTaskCalendarLink,
  updateIntegrationLastSync,
  getUnsyncedGoogleRoutines,
  saveRoutineGoogleEventId,
} = require("../../database");

const googleProvider =
  require("../calendar/providers/GoogleCalendarProvider");

async function syncGoogleCalendar(
  userId,
  selectedCategories = null
) {
  const allowedCategories =
    selectedCategories === null
      ? null
      : new Set(selectedCategories);

  // Google → Notia
  const googleEvents =
    await googleProvider.listEvents(userId);

  let importedEvents = 0;

  for (const event of googleEvents) {
    try {
      if (
        googleProvider.isNotiaEvent(event)
      ) {
        continue;
      }

      const normalizedEvent =
        googleProvider.normalizeEvent(event);

      saveExternalCalendarEvent(
        userId,
        "google",
        normalizedEvent
      );

      importedEvents += 1;
    } catch (error) {
      console.error(
        "Google event import error:",
        {
          eventId: event.id,
          summary: event.summary,
          error: error.message,
        }
      );
    }
  }

  const unsyncedTasks =
    getUnsyncedTimedTasks(
      userId,
      "google"
    );

  let exportedTasks = 0;

  for (const task of unsyncedTasks) {
    if (
      allowedCategories &&
      !allowedCategories.has(task.category || "other")
    ) {
      continue;
    }
    try {
      const googleEvent =
        await googleProvider
          .createEventFromTask(
            userId,
            task
          );

      saveTaskCalendarLink(
        userId,
        task.id,
        "google",
        googleEvent.id
      );

      exportedTasks += 1;
    } catch (error) {
      console.error(
        "Google task export error:",
        {
          taskId: task.id,
          title: task.title,
          error: error.message,
        }
      );
    }
  }

  // Notiaの予定 → Google
  const unsyncedEvents =
    getUnsyncedEvents(userId, "google");

  let exportedEvents = 0;

  for (const event of unsyncedEvents) {
    if (
      allowedCategories &&
      !allowedCategories.has(event.category || "other")
    ) {
      continue;
    }

    try {
      const googleEvent =
        await googleProvider.createEventFromNotiaEvent(
          userId,
          event
        );

      saveEventCalendarLink(
        userId,
        event.id,
        "google",
        googleEvent.id
      );

      exportedEvents += 1;
    } catch (error) {
      console.error(
        "Google event export error:",
        {
          eventId: event.id,
          title: event.title,
          error: error.message,
        }
      );
    }
  }

  const unsyncedRoutines =
    getUnsyncedGoogleRoutines(
      userId
    );

  let exportedRoutines = 0;

  for (const routine of unsyncedRoutines) {
    if (
      allowedCategories &&
      !allowedCategories.has(routine.category || "other")
    ) {
      continue;
    }
    try {
      const googleEvent =
        await googleProvider
          .createRecurringEventFromRoutine(
            userId,
            routine
          );

      saveRoutineGoogleEventId(
        userId,
        routine.id,
        googleEvent.id
      );

      exportedRoutines += 1;
    } catch (error) {
      console.error(
        "Google routine export error:",
        {
          routineId: routine.id,
          title: routine.title,
          error: error.message,
        }
      );
    }
  }

  updateIntegrationLastSync(
    userId,
    "google"
  );

  return {
    importedEvents,
    exportedTasks,
    exportedEvents,
    exportedRoutines,
  };
}

module.exports = {
  syncGoogleCalendar,
};