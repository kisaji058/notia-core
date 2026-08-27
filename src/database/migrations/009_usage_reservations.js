module.exports = {

  name:
    "009_usage_reservations",

  up(db) {

    const columns =
      db.prepare(`
        PRAGMA table_info(
          usage_counters
        )
      `).all();

    const hasReservedCount =
      columns.some(
        (column) =>
          column.name ===
            "reserved_count"
      );

    if (!hasReservedCount) {
      db.prepare(`
        ALTER TABLE
          usage_counters
        ADD COLUMN
          reserved_count
          INTEGER NOT NULL
          DEFAULT 0
          CHECK (
            reserved_count >= 0
          )
      `).run();
    }

  },

};
