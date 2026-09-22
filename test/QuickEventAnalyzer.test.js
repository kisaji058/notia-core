const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const analyzerPath = path.resolve(
  __dirname,
  "../src/analyzer/ConversationAnalyzer.js"
);

const originalLoad = Module._load;
let aiResponse = "";

let analyzer;

try {
  Module._load = function (request, parent, isMain) {
    if (
      parent?.filename === analyzerPath &&
      request === "../../openai"
    ) {
      return {
        async chatWithNotia() {
          return aiResponse;
        },
      };
    }

    return originalLoad.call(
      this,
      request,
      parent,
      isMain
    );
  };

  analyzer = require(analyzerPath);
} finally {
  Module._load = originalLoad;
}

test("正しい日付と時刻を保持する", async () => {
  aiResponse = JSON.stringify({
    title: null,
    dueDate: "2026-09-21",
    dueTime: "15:00",
    endDate: null,
    endTime: "16:30",
    notification: "10_minutes_before",
    cancel: false,
  });

  const result = await analyzer.analyzeQuickEvent(
    "今日15時から16時半まで",
    { title: "テスト", dueDate: null }
  );

  assert.equal(result.parseError, false);
  assert.equal(result.dueDate, "2026-09-21");
  assert.equal(result.dueTime, "15:00");
  assert.equal(result.endTime, "16:30");
  assert.equal(
    result.notification,
    "10_minutes_before"
  );
});

test("不正な日付と時刻は受け付けない", async () => {
  aiResponse = JSON.stringify({
    title: "テスト",
    dueDate: "2026-02-30",
    dueTime: "25:99",
    endDate: null,
    endTime: null,
    notification: null,
    cancel: false,
  });

  const result = await analyzer.analyzeQuickEvent(
    "テスト",
    {}
  );

  assert.equal(result.parseError, false);
  assert.equal(result.dueDate, null);
  assert.equal(result.dueTime, null);
});

test("JSONの解析に失敗した場合は登録を進めない", async () => {
  aiResponse = "解析できませんでした";

  const result = await analyzer.analyzeQuickEvent(
    "今日",
    { title: "テスト" }
  );

  assert.equal(result.parseError, true);
});

test("指定した場所を返し、場所がなければnullを返す", async () => {
  aiResponse = JSON.stringify({
    title: "会議",
    dueDate: "2026-09-24",
    dueTime: "15:00",
    endDate: null,
    endTime: null,
    location: "第2会議室",
    notification: null,
    cancel: false,
  });

  const withLocation = await analyzer.analyzeQuickEvent(
    "会議の場所は第2会議室",
    { title: "会議" }
  );

  assert.equal(withLocation.parseError, false);
  assert.equal(withLocation.location, "第2会議室");

  aiResponse = JSON.stringify({
    title: null,
    dueDate: null,
    dueTime: null,
    endDate: null,
    endTime: null,
    location: null,
    notification: null,
    cancel: false,
  });

  const withoutLocation = await analyzer.analyzeQuickEvent(
    "通知なし",
    { title: "会議", location: "第2会議室" }
  );

  assert.equal(withoutLocation.location, null);
});
