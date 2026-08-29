module.exports = {
  name:
    "010_document_rechecks",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS
        document_rechecks (
          id INTEGER
            PRIMARY KEY AUTOINCREMENT,

          user_id INTEGER
            NOT NULL,

          file_hash TEXT
            NOT NULL,

          recheck_count INTEGER
            NOT NULL
            DEFAULT 0
            CHECK (
              recheck_count >= 0
            ),

          created_at TEXT
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          updated_at TEXT
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE,

          UNIQUE (
            user_id,
            file_hash
          )
        )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_document_rechecks_user_hash

      ON document_rechecks (
        user_id,
        file_hash
      )
    `).run();
  },
};
