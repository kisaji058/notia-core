module.exports = {
  name: "013_secretary_progress",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_secretary_progress (
        user_id INTEGER PRIMARY KEY,
        total_exp INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `).run();
  },
};
