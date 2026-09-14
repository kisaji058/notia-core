module.exports = {
  name: "014_user_categories",

  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        category_key TEXT NOT NULL,

        label TEXT NOT NULL,

        is_default INTEGER NOT NULL DEFAULT 0,

        sort_order INTEGER NOT NULL DEFAULT 0,

        created_at TEXT NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TEXT NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,

        UNIQUE (
          user_id,
          category_key
        )
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS
        idx_user_categories_user_id
      ON user_categories(user_id)
    `).run();

    const defaults = [
      ["work", "仕事", 1],
      ["school", "学校", 2],
      ["shopping", "買い物", 3],
      ["private", "プライベート", 4],
      ["other", "その他", 5],
    ];

    const users =
      db.prepare(`
        SELECT id
        FROM users
      `).all();

    const insert =
      db.prepare(`
        INSERT OR IGNORE INTO user_categories (
          user_id,
          category_key,
          label,
          is_default,
          sort_order
        )
        VALUES (?, ?, ?, 1, ?)
      `);

    for (const user of users) {
      for (
        const [
          categoryKey,
          label,
          sortOrder,
        ] of defaults
      ) {
        insert.run(
          user.id,
          categoryKey,
          label,
          sortOrder
        );
      }
    }
  },
};
