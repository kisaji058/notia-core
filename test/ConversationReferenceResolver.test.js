const test = require("node:test");
const assert = require("node:assert/strict");

const resolver = require("../src/resolvers/ConversationReferenceResolver");

test("「終わった」で直前に話したタスクを取得する", () => {
  const result = resolver.resolve("終わった", {
    conversations: [
      {
        role: "assistant",
        content: "「牛乳を買う」を期限なしで登録しました。",
      },
    ],
    activeTasks: [
      {
        id: 1,
        title: "牛乳を買う",
      },
    ],
  });

  assert.deepEqual(result, {
    type: "task",
    targetTaskId: 1,
    targetTaskTitle: "牛乳を買う",
    confidence: 0.9,
  });
});

test("アクティブタスクが1件なら、そのタスクを取得する", () => {
  const result = resolver.resolve("できた", {
    conversations: [],
    activeTasks: [
      {
        id: 2,
        title: "資料を作る",
      },
    ],
  });

  assert.equal(result.targetTaskId, 2);
  assert.equal(result.targetTaskTitle, "資料を作る");
});

test("対象タスクがない場合はnullを返す", () => {
  const result = resolver.resolve("終わった", {
    conversations: [],
    activeTasks: [],
  });

  assert.equal(result, null);
});

test("通常の雑談ではnullを返す", () => {
  const result = resolver.resolve("今日は暑いね", {
    conversations: [
      {
        role: "assistant",
        content: "「牛乳を買う」を登録しました。",
      },
    ],
    activeTasks: [
      {
        id: 1,
        title: "牛乳を買う",
      },
    ],
  });

  assert.equal(result, null);
});

test("「期限変えて」で直前のタスクを取得する", () => {
  const result = resolver.resolve("期限変えて", {
    conversations: [
      {
        role: "assistant",
        content: "「レポートを書く」を登録しました。",
      },
    ],
    activeTasks: [
      {
        id: 3,
        title: "レポートを書く",
      },
    ],
  });

  assert.equal(result.targetTaskId, 3);
  assert.equal(result.targetTaskTitle, "レポートを書く");
});