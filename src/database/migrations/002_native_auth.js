module.exports = {
  name: "002_native_auth",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS native_auth_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code_hash TEXT NOT NULL UNIQUE,
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
        idx_native_auth_codes_user_id
      ON native_auth_codes(user_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_auth_codes_expires_at
      ON native_auth_codes(expires_at)
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS native_auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        last_used_at TEXT,
        created_at TEXT NOT NULL
          DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_auth_tokens_user_id
      ON native_auth_tokens(user_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_auth_tokens_expires_at
      ON native_auth_tokens(expires_at)
    `).run();
  },
};
