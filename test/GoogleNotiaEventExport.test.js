"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const providerPath = path.resolve(
  __dirname,
  "../src/calendar/providers/GoogleCalendarProvider.js"
);

let insertedBody = null;

const googleMock = {
  auth: {
    OAuth2: class {
      setCredentials() {}
      on() {}
    },
  },
  calendar: () => ({
    events: {
      insert: async ({ requestBody }) => {
        insertedBody = requestBody;
        return { data: { id: "mock-google-event" } };
      },
    },
  }),
};

const databaseMock = {
  getIntegrationTokens: () => ({
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
  }),
  saveIntegrationTokens: () => {},
  deleteIntegration: () => {},
};

const originalLoad = Module._load;
let createEventFromNotiaEvent;

try {
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === providerPath) {
      if (request === "googleapis") {
        return { google: googleMock };
      }
      if (request === "../../../database") {
        return databaseMock;
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  ({ createEventFromNotiaEvent } = require(providerPath));
} finally {
  Module._load = originalLoad;
}

async function exportMockEvent(changes) {
  insertedBody = null;

  const result = await createEventFromNotiaEvent(18, {
    id: 21,
    title: "部活の予定",
    event_date: "2026-09-22",
    end_date: "2026-09-22",
    start_time: null,
    end_time: null,
    ...changes,
  });

  assert.equal(result.id, "mock-google-event");
  assert.equal(insertedBody.summary, "部活の予定");
  assert.deepEqual(insertedBody.extendedProperties.private, {
    source: "notia",
    notiaEventId: "21",
  });

  return insertedBody;
}

test("時刻なしの1日予定は終日として登録する", async () => {
  const body = await exportMockEvent({});
  assert.deepEqual(body.start, { date: "2026-09-22" });
  assert.deepEqual(body.end, { date: "2026-09-23" });
});

test("時刻なしの複数日予定は最終日の翌日まで登録する", async () => {
  const body = await exportMockEvent({
    end_date: "2026-09-24",
  });
  assert.deepEqual(body.start, { date: "2026-09-22" });
  assert.deepEqual(body.end, { date: "2026-09-25" });
});

test("時刻ありの1日予定は指定時刻で登録する", async () => {
  const body = await exportMockEvent({
    start_time: "09:00",
    end_time: "11:30",
  });
  assert.equal(body.start.dateTime, "2026-09-22T00:00:00.000Z");
  assert.equal(body.end.dateTime, "2026-09-22T02:30:00.000Z");
});

test("時刻ありの複数日予定は終了日を維持する", async () => {
  const body = await exportMockEvent({
    end_date: "2026-09-24",
    start_time: "09:00",
    end_time: "17:00",
  });
  assert.equal(body.start.dateTime, "2026-09-22T00:00:00.000Z");
  assert.equal(body.end.dateTime, "2026-09-24T08:00:00.000Z");
});

test("終了時刻なしの複数日予定も終了日を維持する", async () => {
  const body = await exportMockEvent({
    end_date: "2026-09-24",
    start_time: "09:00",
  });
  assert.equal(body.start.dateTime, "2026-09-22T00:00:00.000Z");
  assert.equal(body.end.dateTime, "2026-09-24T01:00:00.000Z");
});
