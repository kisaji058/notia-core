module.exports = {

  name: "004_native_apple_auth",

  up(db) {

    db.prepare(`
      CREATE TABLE IF NOT EXISTS
        native_apple_auth_nonces (

          id INTEGER PRIMARY KEY AUTOINCREMENT,

          nonce_hash TEXT NOT NULL UNIQUE,

          expires_at TEXT NOT NULL,

          used_at TEXT,

          created_at TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP

        )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_native_apple_auth_nonces_expires_at

      ON native_apple_auth_nonces(expires_at)
    `).run();

  },

};
