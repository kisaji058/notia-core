const Database =
  require("better-sqlite3");

const {
  runMigrations,
} = require(
  "./src/database/migrationRunner"
);

const db =
  new Database("notia.db");

try {
  const results =
    runMigrations(db);

  console.table(results);

  console.log(
    "\nApplied migrations:"
  );

  console.table(
    db.prepare(`
      SELECT
        id,
        migration_name,
        applied_at
      FROM schema_migrations
      ORDER BY id ASC
    `).all()
  );
} finally {
  db.close();
}
