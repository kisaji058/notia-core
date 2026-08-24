module.exports = {

  name: "005_native_push_tokens",

  up(db) {

    db.prepare(`
      CREATE TABLE IF NOT EXISTS
        native_push_tokens (

          id INTEGER PRIMARY KEY AUTOINCREMENT,

          user_id INTEGER NOT NULL,

          device_token TEXT NOT NULL UNIQUE,

          platform TEXT NOT NULL
            DEFAULT 'ios',

          created_at TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          updated_at TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE

        )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_push_tokens_user_id

      ON native_push_tokens(user_id)
    `).run();

  },

};
