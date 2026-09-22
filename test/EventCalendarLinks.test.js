"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const databasePath = path.resolve(__dirname, "../database.js");

test("予定の同期済みIDを保存し、次回の同期対象から外す", () => {
  const originalDirectory = process.cwd();
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "notia-event-sync-test-")
  );

  let database;

  try {
    // Macの開発用DBをコピーし、テストではコピーだけを使用する。
    const sourceDatabase = path.resolve(
      __dirname,
      "../notia.db"
    );
    const testDatabase = path.join(
      temporaryDirectory,
      "notia.db"
    );

    fs.copyFileSync(sourceDatabase, testDatabase);
    process.chdir(temporaryDirectory);
    database = require(databasePath);

    const userId = 900001;
    const eventId = database.addEvent(
      userId,
      "部活テスト予定",
      "",
      "2026-09-22",
      null,
      null,
      "",
      "normal",
      "club"
    );

    const before = database.getUnsyncedEvents(userId, "google");
    assert.deepEqual(before.map(event => event.id), [eventId]);

    database.saveEventCalendarLink(
      userId,
      eventId,
      "google",
      "mock-google-event-21"
    );

    const after = database.getUnsyncedEvents(userId, "google");
    assert.deepEqual(after, []);

    // 保存結果はテスト用DBを読み取り専用で開いて確認する。
    const Database = require("better-sqlite3");
    const verificationDb = new Database(
      path.join(temporaryDirectory, "notia.db"),
      { readonly: true, fileMustExist: true }
    );

    try {
      const link = verificationDb.prepare(`
        SELECT external_event_id
        FROM event_calendar_links
        WHERE user_id = ? AND event_id = ? AND provider = ?
      `).get(userId, eventId, "google");

      assert.equal(
        link.external_event_id,
        "mock-google-event-21"
      );
    } finally {
      verificationDb.close();
    }
  } catch (error) {
    console.error("DBテスト失敗箇所:", error.stack || error);
    throw error;
  } finally {
    process.chdir(originalDirectory);
    if (database?.db?.open) database.db.close();
    delete require.cache[databasePath];
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
