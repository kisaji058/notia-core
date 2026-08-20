const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR =
  path.join(
    __dirname,
    "migrations"
  );

function ensureMigrationTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function getAppliedMigrations(db) {
  return new Set(
    db.prepare(`
      SELECT migration_name
      FROM schema_migrations
    `).all().map(
      (row) => row.migration_name
    )
  );
}

function loadMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (file) =>
        /^\d+_.+\.js$/.test(file)
    )
    .sort()
    .map((file) => {
      const migration =
        require(
          path.join(
            MIGRATIONS_DIR,
            file
          )
        );

      if (
        !migration ||
        typeof migration.name !==
          "string" ||
        typeof migration.up !==
          "function"
      ) {
        throw new Error(
          `Invalid migration: ${file}`
        );
      }

      return migration;
    });
}

function runMigrations(db) {
  ensureMigrationTable(db);

  const applied =
    getAppliedMigrations(db);

  const migrations =
    loadMigrations();

  const results = [];

  for (
    const migration of migrations
  ) {
    if (
      applied.has(
        migration.name
      )
    ) {
      results.push({
        name: migration.name,
        applied: false,
      });

      continue;
    }

    const transaction =
      db.transaction(() => {
        migration.up(db);

        db.prepare(`
          INSERT INTO schema_migrations (
            migration_name
          )
          VALUES (?)
        `).run(
          migration.name
        );
      });

    transaction();

    results.push({
      name: migration.name,
      applied: true,
    });
  }

  return results;
}

module.exports = {
  ensureMigrationTable,
  runMigrations,
};
