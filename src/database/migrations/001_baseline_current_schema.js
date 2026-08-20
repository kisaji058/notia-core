const REQUIRED_TABLES = [
  "users",
  "auth_identities",
  "conversations",
  "tasks",
  "routines",
  "integrations",
  "external_calendar_events",
  "events",
  "task_calendar_links",
  "daily_notification_logs",
  "notification_settings",
  "memories",
];

module.exports = {
  name: "001_baseline_current_schema",

  up(db) {
    const existingTables =
      new Set(
        db.prepare(`
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
        `).all().map(
          (row) => row.name
        )
      );

    const missingTables =
      REQUIRED_TABLES.filter(
        (table) =>
          !existingTables.has(table)
      );

    if (missingTables.length > 0) {
      throw new Error(
        "Baseline schema is incomplete. " +
        "Missing tables: " +
        missingTables.join(", ")
      );
    }
  },
};
