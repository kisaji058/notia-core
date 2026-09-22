"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getReminderKey,
  isReminderDue,
} = require("../src/managers/OverdueTaskReminder");

const task = {
  item_type: "task",
  status: "active",
  notification: "at_time",
  due_date: "2026-09-24",
  due_time: "10:00",
};

test("設定時刻から1時間後の未完了タスクが対象になる", () => {
  assert.equal(
    isReminderDue(task, new Date("2026-09-24T11:00:00+09:00")),
    true
  );
});

test("1時間前は対象外、1時間後から10分間だけ対象", () => {
  assert.equal(
    isReminderDue(task, new Date("2026-09-24T10:59:59+09:00")),
    false
  );
  assert.equal(
    isReminderDue(task, new Date("2026-09-24T11:09:59+09:00")),
    true
  );
  assert.equal(
    isReminderDue(task, new Date("2026-09-24T11:10:00+09:00")),
    false
  );
});

test("通知なし・完了済み・時刻なしは対象外", () => {
  assert.equal(isReminderDue(
    { ...task, notification: "none" },
    new Date("2026-09-24T11:00:00+09:00")
  ), false);
  assert.equal(isReminderDue(
    { ...task, status: "completed" },
    new Date("2026-09-24T11:00:00+09:00")
  ), false);
  assert.equal(isReminderDue(
    { ...task, due_time: null },
    new Date("2026-09-24T11:00:00+09:00")
  ), false);
});

test("予定・ルーティーンは対象外", () => {
  for (const itemType of ["event", "routine"]) {
    assert.equal(isReminderDue(
      { ...task, item_type: itemType },
      new Date("2026-09-24T11:00:00+09:00")
    ), false);
  }
});

test("設定日時の変更に応じて通知履歴用キーが変わる", () => {
  assert.notEqual(
    getReminderKey(task),
    getReminderKey({ ...task, due_time: "12:00" })
  );
});
