"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const managerPath = path.resolve(
  __dirname,
  "../src/managers/CalendarSyncManager.js"
);

const tasks = [
  { id: 1, title: "仕事タスク", category: "work" },
  { id: 2, title: "私用タスク", category: "private" },
  { id: 3, title: "未分類タスク", category: null },
];

const routines = [
  { id: 11, title: "仕事ルーティーン", category: "work" },
  { id: 12, title: "私用ルーティーン", category: "private" },
];

const events = [
  { id: 21, title: "部活の予定1", category: "club" },
  { id: 22, title: "部活の予定2", category: "club" },
  { id: 23, title: "仕事の予定", category: "work" },
];

let sentEvents = [];
let savedEventLinks = [];
let linkedEventIds = new Set();

let sentTasks = [];
let sentRoutines = [];
let savedTaskLinks = [];
let savedRoutineLinks = [];

const databaseMock = {
  getUnsyncedTimedTasks: () => tasks,
  getUnsyncedEvents: () =>
    events.filter(event => !linkedEventIds.has(event.id)),
  saveEventCalendarLink: (_userId, eventId) => {
    savedEventLinks.push(eventId);
    linkedEventIds.add(eventId);
  },
  getUnsyncedGoogleRoutines: () => routines,
  saveExternalCalendarEvent: () => {
    throw new Error("予期しない予定取り込み");
  },
  saveTaskCalendarLink: (_userId, taskId) => {
    savedTaskLinks.push(taskId);
  },
  saveRoutineGoogleEventId: (_userId, routineId) => {
    savedRoutineLinks.push(routineId);
  },
  updateIntegrationLastSync: () => {},
};

const providerMock = {
  listEvents: async () => [],
  createEventFromNotiaEvent: async (_userId, event) => {
    sentEvents.push(event.id);
    return { id: `event-${event.id}` };
  },
  createEventFromTask: async (_userId, task) => {
    sentTasks.push(task.id);
    return { id: `task-${task.id}` };
  },
  createRecurringEventFromRoutine: async (_userId, routine) => {
    sentRoutines.push(routine.id);
    return { id: `routine-${routine.id}` };
  },
};

const originalLoad = Module._load;

let syncGoogleCalendar;

try {
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === managerPath) {
      if (request === "../../database") {
        return databaseMock;
      }

      if (
        request ===
        "../calendar/providers/GoogleCalendarProvider"
      ) {
        return providerMock;
      }
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  ({ syncGoogleCalendar } = require(managerPath));
} finally {
  Module._load = originalLoad;
}

function resetRecords() {
  sentEvents = [];
  savedEventLinks = [];
  linkedEventIds = new Set();
  sentTasks = [];
  sentRoutines = [];
  savedTaskLinks = [];
  savedRoutineLinks = [];
}

test("仕事だけを選ぶと仕事のタスク・ルーティーンだけ送る", async () => {
  resetRecords();

  const result = await syncGoogleCalendar(18, ["work"]);

  assert.deepEqual(sentTasks, [1]);
  assert.deepEqual(sentRoutines, [11]);
  assert.deepEqual(savedTaskLinks, [1]);
  assert.deepEqual(savedRoutineLinks, [11]);
  assert.equal(result.exportedTasks, 1);
  assert.equal(result.exportedRoutines, 1);
});

test("分類を指定しなければ従来どおり全件を送る", async () => {
  resetRecords();

  const result = await syncGoogleCalendar(18);

  assert.deepEqual(sentTasks, [1, 2, 3]);
  assert.deepEqual(sentRoutines, [11, 12]);
  assert.equal(result.exportedTasks, 3);
  assert.equal(result.exportedRoutines, 2);
});

test("選択分類に該当する項目がなければ送信しない", async () => {
  resetRecords();

  const result = await syncGoogleCalendar(18, ["school"]);

  assert.deepEqual(sentTasks, []);
  assert.deepEqual(sentRoutines, []);
  assert.deepEqual(savedTaskLinks, []);
  assert.deepEqual(savedRoutineLinks, []);
  assert.equal(result.exportedTasks, 0);
  assert.equal(result.exportedRoutines, 0);
});


test("部活だけを選ぶと部活の予定だけ送る", async () => {
  resetRecords();

  const result = await syncGoogleCalendar(18, ["club"]);

  assert.deepEqual(sentEvents, [21, 22]);
  assert.deepEqual(savedEventLinks, [21, 22]);
  assert.equal(result.exportedEvents, 2);
});

test("分類を指定しなければ予定も全件送る", async () => {
  resetRecords();

  const result = await syncGoogleCalendar(18);

  assert.deepEqual(sentEvents, [21, 22, 23]);
  assert.equal(result.exportedEvents, 3);
});

test("予定は2回同期しても重複送信しない", async () => {
  resetRecords();

  const first = await syncGoogleCalendar(18, ["club"]);
  const second = await syncGoogleCalendar(18, ["club"]);

  assert.equal(first.exportedEvents, 2);
  assert.equal(second.exportedEvents, 0);
  assert.deepEqual(sentEvents, [21, 22]);
  assert.deepEqual(savedEventLinks, [21, 22]);
});
