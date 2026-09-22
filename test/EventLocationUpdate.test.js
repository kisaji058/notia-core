const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const managerPath = path.resolve(
  __dirname,
  "../src/managers/TaskManager.js"
);

const existingEvent = {
  id: 7,
  user_id: "test-user",
  title: "会議",
  description: "議題の確認",
  event_date: "2026-09-24",
  end_date: "2026-09-24",
  start_time: "15:00",
  end_time: "16:00",
  location: "第1会議室",
  items_to_bring: "資料",
  priority: "normal",
  category: "work",
  notification: "10_minutes_before",
  status: "active",
};

let activeEvents = [];
let savedUpdates = [];
const originalLoad = Module._load;

const databaseMock = {
  getActiveEvents() {
    return activeEvents;
  },
  getEventById(userId, id) {
    return userId === "test-user" && id === 7
      ? existingEvent
      : null;
  },
  updateEventById(userId, id, values) {
    savedUpdates.push({ userId, id, values });
    return true;
  },
  updateTaskById() {
    throw new Error("タスクを更新してはいけません");
  },
};

let taskManager;

try {
  Module._load = function (request, parent, isMain) {
    if (
      parent?.filename === managerPath &&
      request === "../../database"
    ) {
      return databaseMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  taskManager = require(managerPath);
} finally {
  Module._load = originalLoad;
}

function reset() {
  activeEvents = [{ ...existingEvent }];
  savedUpdates = [];
}

function locationChange(overrides = {}) {
  return {
    intent: "task_update",
    targetEventId: 7,
    targetTaskId: null,
    targetTaskTitle: "会議",
    updates: { location: "第2会議室" },
    ...overrides,
  };
}

test("既存予定の場所だけを変更し、ほかの項目を保持する", () => {
  reset();

  const result = taskManager.handle(
    locationChange(),
    "test-user"
  );

  assert.equal(result.updated, true);
  assert.equal(savedUpdates.length, 1);
  assert.equal(savedUpdates[0].id, 7);
  assert.deepEqual(savedUpdates[0].values, {
    title: existingEvent.title,
    description: existingEvent.description,
    event_date: existingEvent.event_date,
    end_date: existingEvent.end_date,
    start_time: existingEvent.start_time,
    end_time: existingEvent.end_time,
    location: "第2会議室",
    items_to_bring: existingEvent.items_to_bring,
    priority: existingEvent.priority,
    category: existingEvent.category,
    notification: existingEvent.notification,
    status: existingEvent.status,
  });
});

test("予定IDとタスクIDが両方指定されたら更新しない", () => {
  reset();

  const result = taskManager.handle(
    locationChange({ targetTaskId: 7 }),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(savedUpdates.length, 0);
});

test("同名の予定が複数あれば更新しない", () => {
  reset();
  activeEvents.push({
    ...existingEvent,
    id: 8,
    event_date: "2026-09-25",
    end_date: "2026-09-25",
  });

  const result = taskManager.handle(
    locationChange(),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(result.reason, "ambiguous event");
  assert.equal(savedUpdates.length, 0);
});

test("指定された予定名が一致しなければ更新しない", () => {
  reset();

  const result = taskManager.handle(
    locationChange({ targetTaskTitle: "別の予定" }),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(savedUpdates.length, 0);
});

test("同名の予定が別の日にあっても、対象日を指定すれば該当予定だけ更新する", () => {
  reset();
  activeEvents.push({
    ...existingEvent,
    id: 8,
    event_date: "2026-09-25",
    end_date: "2026-09-25",
  });

  const result = taskManager.handle(
    locationChange({ targetEventDate: "2026-09-24" }),
    "test-user"
  );

  assert.equal(result.updated, true);
  assert.equal(savedUpdates.length, 1);
  assert.equal(savedUpdates[0].id, 7);
  assert.equal(savedUpdates[0].values.location, "第2会議室");
});

test("対象日が予定の日付と一致しなければ更新しない", () => {
  reset();

  const result = taskManager.handle(
    locationChange({ targetEventDate: "2026-09-25" }),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(savedUpdates.length, 0);
});

test("同じ日付・同じ名前の予定が複数ある場合は更新しない", () => {
  reset();
  activeEvents.push({
    ...existingEvent,
    id: 8,
  });

  const result = taskManager.handle(
    locationChange({ targetEventDate: "2026-09-24" }),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(result.reason, "ambiguous event");
  assert.equal(savedUpdates.length, 0);
});

test("予定IDが取得できない場所変更ではタスクも予定も更新しない", () => {
  reset();

  const result = taskManager.handle(
    locationChange({
      targetEventId: null,
      targetTaskId: 7,
    }),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(result.reason, "ambiguous event");
  assert.equal(savedUpdates.length, 0);
});

test("場所と日時の変更指示が混在する場合は何も更新しない", () => {
  reset();

  const result = taskManager.handle(
    locationChange({
      updates: {
        location: "第2会議室",
        dueTime: "17:00",
      },
    }),
    "test-user"
  );

  assert.equal(result.updated, false);
  assert.equal(result.reason, "unsupported event update");
  assert.equal(savedUpdates.length, 0);
});
