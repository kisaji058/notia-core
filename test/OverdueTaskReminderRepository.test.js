"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const migration = require(
  "../src/database/migrations/015_overdue_task_reminders"
);
const {
  createOverdueTaskReminderRepository,
} = require("../src/database/overdueTaskReminderRepository");

test("未完了タスクを1時間後に1回だけ通知対象にする", () => {
  const db = new Database(":memory:");

  try {
    db.exec(`
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        item_type TEXT NOT NULL,
        status TEXT NOT NULL,
        notification TEXT,
        due_date TEXT,
        due_time TEXT
      )
    `);

    migration.up(db);

    const addTask = db.prepare(`
      INSERT INTO tasks (
        id, user_id, title, item_type, status,
        notification, due_date, due_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    addTask.run(
      1, 10, "未完了タスク", "task", "active",
      "at_time", "2026-09-24", "10:00"
    );
    addTask.run(
      2, 10, "通知なし", "task", "active",
      "none", "2026-09-24", "10:00"
    );
    addTask.run(
      3, 10, "完了済み", "task", "completed",
      "at_time", "2026-09-24", "10:00"
    );
    addTask.run(
      4, 10, "予定", "event", "active",
      "at_time", "2026-09-24", "10:00"
    );
    addTask.run(
      5, 11, "別ユーザー", "task", "active",
      "at_time", "2026-09-24", "10:00"
    );

    const repository =
      createOverdueTaskReminderRepository(db);
    const now = new Date("2026-09-24T11:00:00+09:00");

    assert.deepEqual(
      repository.claimDueReminders(10, now).map(t => t.id),
      [1, 2],
      "通常の通知設定が「なし」のタスクも対象にする"
    );

    assert.deepEqual(
      repository.claimDueReminders(10, now),
      [],
      "同じ設定日時では重複通知しない"
    );

    db.prepare(`
      UPDATE tasks SET due_time = '12:00' WHERE id = 1
    `).run();

    assert.deepEqual(
      repository.claimDueReminders(
        10,
        new Date("2026-09-24T13:00:00+09:00")
      ).map(t => t.id),
      [1],
      "設定時刻を変更した場合は新しい日時で判定する"
    );

    assert.deepEqual(
      repository.claimDueReminders(10, now),
      [],
      "元の日時で再通知しない"
    );
  } finally {
    db.close();
  }
});

for (const scenario of [
  {
    name: "完了",
    update: "UPDATE tasks SET status = 'completed' WHERE id = 1",
  },
  {
    name: "日時変更",
    update: "UPDATE tasks SET due_time = '12:00' WHERE id = 1",
  },
]) {
  test(`対象取得直後に${scenario.name}になったら通知履歴を付けない`, () => {
    const db = new Database(":memory:");

    try {
      db.exec(`
        CREATE TABLE tasks (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          item_type TEXT NOT NULL,
          status TEXT NOT NULL,
          notification TEXT,
          due_date TEXT,
          due_time TEXT
        );

        INSERT INTO tasks (
          id, user_id, title, item_type, status,
          notification, due_date, due_time
        ) VALUES (
          1, 10, 'テストタスク', 'task', 'active',
          'at_time', '2026-09-24', '10:00'
        );
      `);

      migration.up(db);

      const wrappedDb = {
        prepare(sql) {
          const statement = db.prepare(sql);

          if (
            sql.includes("SELECT *") &&
            sql.includes("FROM tasks")
          ) {
            return {
              all(userId) {
                const tasks = statement.all(userId);
                db.prepare(scenario.update).run();
                return tasks;
              },
            };
          }

          return statement;
        },
      };

      const repository =
        createOverdueTaskReminderRepository(wrappedDb);

      const reminders = repository.claimDueReminders(
        10,
        new Date("2026-09-24T11:00:00+09:00")
      );

      assert.deepEqual(reminders, []);

      const logCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM overdue_task_reminder_logs
      `).get().count;

      assert.equal(logCount, 0);
    } finally {
      db.close();
    }
  });
}

test("対象取得直後に通知なしへ変更されても1回だけ通知対象になる", () => {
  const db = new Database(":memory:");

  try {
    db.exec(`
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        item_type TEXT NOT NULL,
        status TEXT NOT NULL,
        notification TEXT,
        due_date TEXT,
        due_time TEXT
      );

      INSERT INTO tasks (
        id, user_id, title, item_type, status,
        notification, due_date, due_time
      ) VALUES (
        1, 10, 'テストタスク', 'task', 'active',
        'at_time', '2026-09-24', '10:00'
      );
    `);

    migration.up(db);

    const wrappedDb = {
      prepare(sql) {
        const statement = db.prepare(sql);

        if (sql.includes("SELECT *") && sql.includes("FROM tasks")) {
          return {
            all(userId) {
              const tasks = statement.all(userId);
              db.prepare(
                "UPDATE tasks SET notification = 'none' WHERE id = 1"
              ).run();
              return tasks;
            },
          };
        }

        return statement;
      },
    };

    const repository =
      createOverdueTaskReminderRepository(wrappedDb);
    const now = new Date("2026-09-24T11:00:00+09:00");

    assert.deepEqual(
      repository.claimDueReminders(10, now).map(task => task.id),
      [1]
    );

    assert.equal(
      db.prepare(
        "SELECT COUNT(*) AS count FROM overdue_task_reminder_logs"
      ).get().count,
      1
    );

    assert.deepEqual(repository.claimDueReminders(10, now), []);
  } finally {
    db.close();
  }
});
