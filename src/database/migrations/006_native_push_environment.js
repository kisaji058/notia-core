module.exports = {

  name:
    "006_native_push_environment",

  up(db) {
    const columns =
      db.prepare(`
        PRAGMA table_info(
          native_push_tokens
        )
      `).all();

    const hasEnvironment =
      columns.some(
        (column) =>
          column.name ===
            "apns_environment"
      );

    if (!hasEnvironment) {
      db.prepare(`
        ALTER TABLE
          native_push_tokens

        ADD COLUMN
          apns_environment
          TEXT NOT NULL
          DEFAULT 'sandbox'
      `).run();
    }
  },

};
