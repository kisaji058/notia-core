module.exports = {
  name:
    "011_document_chat_history",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS
        document_chat_history (
          id INTEGER
            PRIMARY KEY AUTOINCREMENT,

          user_id INTEGER
            NOT NULL,

          file_name TEXT
            NOT NULL,

          page_count INTEGER
            NOT NULL
            CHECK (
              page_count >= 1
            ),

          items_json TEXT
            NOT NULL,

          warnings_json TEXT
            NOT NULL
            DEFAULT '[]',

          source_message TEXT,

          created_at TEXT
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
        )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_document_chat_history_user_created
      ON document_chat_history (
        user_id,
        created_at
      )
    `).run();
  },
};
