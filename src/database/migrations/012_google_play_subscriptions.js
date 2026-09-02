module.exports = {
  name:
    "012_google_play_subscriptions",

  up(db) {
    db.prepare(`
      ALTER TABLE user_subscriptions
      RENAME TO user_subscriptions_old
    `).run();

    db.prepare(`
      CREATE TABLE user_subscriptions (
        id INTEGER
          PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER
          NOT NULL UNIQUE,

        platform TEXT
          NOT NULL
          DEFAULT 'apple'
          CHECK (
            platform IN (
              'apple',
              'google'
            )
          ),

        plan TEXT
          NOT NULL
          DEFAULT 'free'
          CHECK (
            plan IN (
              'free',
              'standard',
              'unlimited'
            )
          ),

        product_id TEXT,

        original_transaction_id TEXT,

        status TEXT
          NOT NULL
          DEFAULT 'inactive'
          CHECK (
            status IN (
              'inactive',
              'active',
              'expired',
              'grace_period',
              'billing_retry',
              'revoked'
            )
          ),

        expires_at TEXT,

        auto_renew_status INTEGER
          CHECK (
            auto_renew_status IS NULL
            OR auto_renew_status IN (0, 1)
          ),

        last_verified_at TEXT,

        created_at TEXT
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TEXT
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `).run();

    db.prepare(`
      INSERT INTO user_subscriptions (
        id,
        user_id,
        platform,
        plan,
        product_id,
        original_transaction_id,
        status,
        expires_at,
        auto_renew_status,
        last_verified_at,
        created_at,
        updated_at
      )
      SELECT
        id,
        user_id,
        platform,
        plan,
        product_id,
        original_transaction_id,
        status,
        expires_at,
        auto_renew_status,
        last_verified_at,
        created_at,
        updated_at
      FROM user_subscriptions_old
    `).run();

    db.prepare(`
      DROP TABLE user_subscriptions_old
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        idx_user_subscriptions_original_transaction
      ON user_subscriptions (
        original_transaction_id
      )
      WHERE original_transaction_id IS NOT NULL
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_user_subscriptions_status
      ON user_subscriptions (
        status
      )
    `).run();
  },
};
