const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const runtimePath = path.resolve(
  __dirname,
  "../src/runtime/ChatRuntime.js"
);

const originalLoad = Module._load;

const sessions = new Map();
const conversations = [];
const createdTasks = [];

let analysisQueue = [];

const sessionManager = {
  get(userId) {
    if (!sessions.has(userId)) {
      sessions.set(userId, {
        mode: "normal",
        pendingTask: null,
      });
    }
    return sessions.get(userId);
  },

  set(userId, state) {
    const next = {
      ...this.get(userId),
      ...state,
    };
    sessions.set(userId, next);
    return next;
  },

  clear(userId) {
    sessions.set(userId, {
      mode: "normal",
      pendingTask: null,
    });
  },
};

const databaseMock = {
  saveConversation(userId, role, message) {
    conversations.push({ userId, role, message });
  },
  getRecentConversations() {
    return [];
  },
  getActiveTasks() {
    return [];
  },
};

const analyzerMock = {
  async analyzeQuickTask() {
    assert.ok(
      analysisQueue.length > 0,
      "解析結果が不足しています"
    );
    return analysisQueue.shift();
  },
  async analyze() {
    throw new Error(
      "専用モード中に通常の解析が呼ばれました"
    );
  },
};

const taskManagerMock = {
  handle(analysis, userId) {
    createdTasks.push({ analysis, userId });

    return {
      created: true,
      duplicated: false,
      createdTasks: analysis.tasks,
    };
  },
};

const mocks = {
  "../analyzer/ConversationAnalyzer": analyzerMock,
  "../managers/TaskManager": taskManagerMock,
  "../session/SessionManager": sessionManager,

  "../managers/ConversationManager": {},
  "../managers/TaskListManager": {},
  "../managers/ResponseManager": {},
  "../managers/PromptBuilder": {},
  "../managers/MemoryManager": {},
  "../builders/ConversationContextBuilder": {},
  "../resolvers/ConversationReferenceResolver": {},
  "../../openai": {
    chatWithNotia() {
      throw new Error(
        "テスト中にOpenAI APIが呼ばれました"
      );
    },
  },
  "../../database": databaseMock,
};

let handleChat;

try {
  Module._load = function(request, parent, isMain) {
    if (
      parent?.filename === runtimePath &&
      Object.prototype.hasOwnProperty.call(
        mocks,
        request
      )
    ) {
      return mocks[request];
    }

    return originalLoad.call(
      this,
      request,
      parent,
      isMain
    );
  };

  ({ handleChat } = require(runtimePath));
} finally {
  Module._load = originalLoad;
}

function reset() {
  sessions.clear();
  conversations.length = 0;
  createdTasks.length = 0;
  analysisQueue = [];
}

function start(userId) {
  sessionManager.set(userId, {
    mode: "quick_task_create",
    step: "waiting_title",
    pendingTask: null,
  });
}

function queue(result) {
  analysisQueue.push({
    title: null,
    dueDate: null,
    dueTime: null,
    notification: null,
    noDueDate: false,
    cancel: false,
    parseError: false,
    ...result,
  });
}

test("一括回答で登録できる", async () => {
  reset();
  start("test-user-1");

  queue({
    title: "ワークシートを作成",
    dueDate: "2026-09-21",
    dueTime: "17:00",
    notification: "same_day",
  });

  const result = await handleChat(
    "明日17時までにワークシートを作成。当日通知",
    "test-user-1"
  );

  assert.equal(createdTasks.length, 1);
  assert.equal(
    createdTasks[0].analysis.tasks[0].title,
    "ワークシートを作成"
  );
  assert.equal(
    createdTasks[0].analysis.tasks[0].dueTime,
    "17:00"
  );
  assert.equal(
    createdTasks[0].analysis.tasks[0].notification,
    "same_day"
  );
  assert.match(result.reply, /登録しました/);
  assert.equal(
    sessionManager.get("test-user-1").mode,
    "normal"
  );
});

test("不足項目を順番に質問する", async () => {
  reset();
  start("test-user-2");

  queue({
    title: "資料を作成",
  });

  const first = await handleChat(
    "資料を作成",
    "test-user-2"
  );

  assert.match(first.reply, /いつまで/);
  assert.equal(createdTasks.length, 0);

  queue({
    dueDate: "2026-09-22",
    dueTime: "15:00",
  });

  const second = await handleChat(
    "9月22日15時まで",
    "test-user-2"
  );

  assert.match(second.reply, /通知/);
  assert.equal(createdTasks.length, 0);

  queue({
    notification: "same_day",
  });

  const third = await handleChat(
    "当日",
    "test-user-2"
  );

  assert.match(third.reply, /登録しました/);
  assert.equal(createdTasks.length, 1);
  assert.equal(
    createdTasks[0].analysis.tasks[0].title,
    "資料を作成"
  );
});

test("期限なしで登録できる", async () => {
  reset();
  start("test-user-3");

  queue({
    title: "買い物",
  });

  await handleChat(
    "買い物",
    "test-user-3"
  );

  queue({
    noDueDate: true,
  });

  const second = await handleChat(
    "期限なし",
    "test-user-3"
  );

  assert.match(second.reply, /通知/);

  queue({
    notification: "none",
  });

  const third = await handleChat(
    "通知なし",
    "test-user-3"
  );

  assert.match(third.reply, /登録しました/);
  assert.equal(
    createdTasks[0].analysis.tasks[0].dueDate,
    null
  );
});

test("キャンセル時は保存しない", async () => {
  reset();
  start("test-user-4");

  queue({
    cancel: true,
  });

  const result = await handleChat(
    "やっぱりやめる",
    "test-user-4"
  );

  assert.match(result.reply, /中止しました/);
  assert.equal(createdTasks.length, 0);
  assert.equal(
    sessionManager.get("test-user-4").mode,
    "normal"
  );
});

test("時刻が必要な通知では時刻を確認してから登録する", async () => {
  reset();
  start("test-user-time");

  queue({ title: "テスト用資料を作成" });
  await handleChat("テスト用資料を作成", "test-user-time");

  queue({ dueDate: "2026-09-21" });
  await handleChat("明日まで", "test-user-time");

  queue({ notification: "1_hour_before" });
  const beforeTime = await handleChat(
    "1時間前に通知して",
    "test-user-time"
  );

  assert.match(beforeTime.reply, /時刻/);
  assert.equal(createdTasks.length, 0);
  assert.equal(
    sessionManager.get("test-user-time").step,
    "waiting_time"
  );

  queue({ dueTime: "17:00" });
  const completed = await handleChat(
    "17時まで",
    "test-user-time"
  );

  assert.match(completed.reply, /登録しました/);
  assert.equal(createdTasks.length, 1);
  assert.equal(
    createdTasks[0].analysis.tasks[0].dueDate,
    "2026-09-21"
  );
  assert.equal(
    createdTasks[0].analysis.tasks[0].dueTime,
    "17:00"
  );
  assert.equal(
    createdTasks[0].analysis.tasks[0].notification,
    "1_hour_before"
  );
});
