const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATABASE_PATH =
  path.resolve(
    process.cwd(),
    "notia.db"
  );

const BACKUP_DIR =
  path.resolve(
    process.cwd(),
    "backups"
  );

const MAX_BACKUPS = 30;

function createTimestamp() {
  const now = new Date();

  const parts =
    new Intl.DateTimeFormat(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }
    )
      .formatToParts(now)
      .reduce(
        (result, part) => {
          if (
            part.type !== "literal"
          ) {
            result[part.type] =
              part.value;
          }

          return result;
        },
        {}
      );

  return (
    `${parts.year}` +
    `${parts.month}` +
    `${parts.day}-` +
    `${parts.hour}` +
    `${parts.minute}` +
    `${parts.second}`
  );
}

function cleanupOldBackups() {
  const files =
    fs.readdirSync(BACKUP_DIR)
      .filter(
        (file) =>
          /^notia-\d{8}-\d{6}\.db$/.test(
            file
          )
      )
      .sort()
      .reverse();

  const filesToDelete =
    files.slice(MAX_BACKUPS);

  for (
    const file of filesToDelete
  ) {
    fs.unlinkSync(
      path.join(
        BACKUP_DIR,
        file
      )
    );

    console.log(
      `Deleted old backup: ${file}`
    );
  }
}

async function main() {
  if (
    !fs.existsSync(DATABASE_PATH)
  ) {
    throw new Error(
      `Database not found: ${DATABASE_PATH}`
    );
  }

  fs.mkdirSync(
    BACKUP_DIR,
    {
      recursive: true,
    }
  );

  const timestamp =
    createTimestamp();

  const backupPath =
    path.join(
      BACKUP_DIR,
      `notia-${timestamp}.db`
    );

  const db =
    new Database(
      DATABASE_PATH,
      {
        readonly: true,
        fileMustExist: true,
      }
    );

  try {
    await db.backup(
      backupPath
    );
  } finally {
    db.close();
  }

  cleanupOldBackups();

  const stats =
    fs.statSync(backupPath);

  console.log(
    "Database backup completed."
  );

  console.log(
    `Backup: ${backupPath}`
  );

  console.log(
    `Size: ${stats.size} bytes`
  );
}

main().catch((error) => {
  console.error(
    "Database backup failed:",
    error
  );

  process.exitCode = 1;
});
