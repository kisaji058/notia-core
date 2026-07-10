const test = require("node:test");
const assert = require("node:assert/strict");

const conversationContextBuilder = require(
  "../src/builders/ConversationContextBuilder"
);

test("会話履歴をcontextへ整形できる", () => {
  const conversations = [
    {
      role: "user",
      message: "こんにちは",
    },
    {
      role: "assistant",
      message: "こんにちは。今日はどうしましたか？",
    },
  ];

  const context = conversationContextBuilder.build({
    conversations,
  });

  assert.equal(
    context.history,
    [
      "user: こんにちは",
      "assistant: こんにちは。今日はどうしましたか？",
    ].join("\n")
  );
});

test("最新8件の会話だけを履歴に含める", () => {
  const conversations = Array.from({ length: 10 }, (_, index) => ({
    role: "user",
    message: `メッセージ${index + 1}`,
  }));

  const context = conversationContextBuilder.build({
    conversations,
  });

  assert.equal(context.history.includes("メッセージ1\n"), false);
  assert.equal(context.history.includes("メッセージ2\n"), false);
  assert.equal(context.history.includes("メッセージ3"), true);
  assert.equal(context.history.includes("メッセージ10"), true);
});

test("activeTasksをcontextへ含められる", () => {
  const activeTasks = [
    {
      id: 1,
      title: "資料を作る",
    },
  ];

  const context = conversationContextBuilder.build({
    activeTasks,
  });

  assert.deepEqual(context.activeTasks, activeTasks);
});

test("引数なしでも安全なcontextを返す", () => {
  const context = conversationContextBuilder.build();

  assert.deepEqual(context, {
    history: "",
    activeTasks: [],
    session: null,
    currentTopic: null,
    recentActions: [],
  });
});

test("不正な配列を渡しても安全に処理する", () => {
  const context = conversationContextBuilder.build({
    conversations: "invalid",
    activeTasks: "invalid",
  });

  assert.equal(context.history, "");
  assert.deepEqual(context.activeTasks, []);
});