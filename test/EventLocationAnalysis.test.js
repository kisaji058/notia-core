const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const analyzerPath = path.resolve(
  __dirname,
  "../src/analyzer/ConversationAnalyzer.js"
);

const originalLoad = Module._load;
let analyzer;

try {
  Module._load = function (request, parent, isMain) {
    if (
      parent?.filename === analyzerPath &&
      request === "../../openai"
    ) {
      return {
        async chatWithNotia() {
          throw new Error("このテストでは外部AIを呼び出しません");
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  analyzer = require(analyzerPath);
} finally {
  Module._load = originalLoad;
}

test("通常チャットの新規予定登録で場所を保持する", () => {
  const result = analyzer.safeParse(JSON.stringify({
    intent: "task_create",
    tasks: [{
      title: "会議",
      dueDate: "2026-09-24",
      dueTime: "15:00",
      location: "第2会議室",
      itemType: "event",
    }],
  }));

  assert.equal(result.tasks[0].location, "第2会議室");
  assert.equal(result.tasks[0].itemType, "event");
});

test("既存予定の変更対象と変更後の場所を保持する", () => {
  const result = analyzer.safeParse(JSON.stringify({
    intent: "task_update",
    targetTaskId: null,
    targetEventId: 7,
    targetEventDate: "2026-09-24",
    targetTaskTitle: "会議",
    updates: {
      location: "第2会議室",
    },
  }));

  assert.equal(result.targetTaskId, null);
  assert.equal(result.targetEventId, 7);
  assert.equal(result.targetEventDate, "2026-09-24");
  assert.equal(result.targetTaskTitle, "会議");
  assert.equal(result.updates.location, "第2会議室");
  assert.equal(result.updates.dueDate, null);
});
