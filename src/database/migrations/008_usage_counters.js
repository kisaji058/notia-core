module.exports = {

  name:
    "008_usage_counters",

  up(db) {

    db.prepare(`
      CREATE TABLE IF NOT EXISTS
        usage_counters (

          id INTEGER
            PRIMARY KEY AUTOINCREMENT,

          user_id INTEGER
            NOT NULL,

          usage_type TEXT
            NOT NULL
            CHECK (
              usage_type IN (
                'document_pages'
              )
            ),

          period_start TEXT
            NOT NULL,

          period_end TEXT
            NOT NULL,

          used_count INTEGER
            NOT NULL
            DEFAULT 0
            CHECK (
              used_count >= 0
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
            usage_type,
            period_start,
            period_end
          )

        )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_usage_counters_user_type
      ON usage_counters (
        user_id,
        usage_type
      )
    `).run();

  },

};
