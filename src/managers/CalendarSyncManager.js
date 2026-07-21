const {
  getUnsyncedTimedTasks,
  saveExternalCalendarEvent,
  saveTaskCalendarLink,
  updateIntegrationLastSync,
  getUnsyncedGoogleRoutines,
  saveRoutineGoogleEventId,
} = require("../../database");

const googleProvider =
  require("../calendar/providers/GoogleCalendarProvider");

async function syncGoogleCalendar() {
  // =====================
  // Google → Notia
  // =====================

  const googleEvents =
    await googleProvider.listEvents();

  let importedEvents = 0;

  for (const event of googleEvents) {
    try {
      if (
        googleProvider.isNotiaEvent(event)
      ) {
        continue;
      }

      const normalizedEvent =
        googleProvider.normalizeEvent(
          event
        );

      saveExternalCalendarEvent(
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

  // =====================
  // Notia Task → Google
  // =====================

  const unsyncedTasks =
  getUnsyncedTimedTasks(
    "google"
  );

  let exportedTasks = 0;

  for (const task of unsyncedTasks) {
    try {
      const googleEvent =
        await googleProvider
          .createEventFromTask(
            task
          );

      saveTaskCalendarLink(
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

  // =====================
  // Notia Routine → Google
  // =====================

  const unsyncedRoutines =
    getUnsyncedGoogleRoutines();

  let exportedRoutines = 0;

  for (
    const routine of
    unsyncedRoutines
  ) {
    try {
      const googleEvent =
        await googleProvider
          .createRecurringEventFromRoutine(
            routine
          );

      saveRoutineGoogleEventId(
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

  // =====================
  // Last Sync
  // =====================

  updateIntegrationLastSync(
    "google"
  );

  return {
    importedEvents,
    exportedTasks,
    exportedRoutines,
  };
}

module.exports = {
  syncGoogleCalendar,
};