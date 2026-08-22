module.exports = {
  name: "003_native_google_calendar_oauth",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS
        native_google_calendar_states (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          state_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
        )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_google_calendar_states_user_id
      ON native_google_calendar_states(user_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_google_calendar_states_expires_at
      ON native_google_calendar_states(expires_at)
    `).run();
  },
};
