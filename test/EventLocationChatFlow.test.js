const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const runtimePath = path.resolve(__dirname, "../src/runtime/ChatRuntime.js");
const managerPath = path.resolve(__dirname, "../src/managers/TaskManager.js");
const originalLoad = Module._load;

const event = {
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

let saved = [];
let analyzerOptions = null;

const databaseMock = {
  saveConversation() {},
  getRecentConversations() { return []; },
  getActiveTasks() { return []; },
  getActiveEvents() { return [{ ...event }]; },
  getEventById(userId, id) {
    return userId === "test-user" && id === event.id
      ? { ...event }
      : null;
  },
  updateEventById(userId, id, values) {
    saved.push({ userId, id, values });
    return true;
  },
  updateTaskById() {
    throw new Error("タスクを更新してはいけません");
  },
};

let taskManager;
let handleChat;

try {
  Module._load = function (request, parent, isMain) {
    if (
      (parent?.filename === managerPath ||
       parent?.filename === runtimePath) &&
      request === "../../database"
    ) {
      return databaseMock;
    }

    if (parent?.filename === runtimePath) {
      if (request === "../managers/TaskManager") return taskManager;

      if (request === "../analyzer/ConversationAnalyzer") {
        return {
          async analyze(_message, options) {
            analyzerOptions = options;
            return {
              intent: "task_update",
              targetTaskId: null,
              targetEventId: 7,
              targetEventDate: "2026-09-24",
              targetTaskTitle: "会議",
              updates: { location: "第2会議室" },
            };
          },
        };
      }

      if (request === "../session/SessionManager") {
        return { get() { return { mode: "normal" }; } };
      }

      if (request === "../builders/ConversationContextBuilder") {
        return { build({ activeTasks }) { return {
          activeTasks,
          history: "",
        }; } };
      }

      if (request === "../resolvers/ConversationReferenceResolver") {
        return { resolve() { return null; } };
      }

      if (request === "../managers/ConversationManager") {
        return {
          async handle() { return { handled: false }; },
        };
      }

      if (request === "../managers/MemoryManager") {
        return {
          processMemory() {},
          resolve() { return { handled: false }; },
        };
      }

      if (request === "../managers/TaskListManager") {
        return { isTaskListRequest() { return false; } };
      }

      if (request === "../managers/ResponseManager") {
        return {
          createTaskResultReply(result) {
            return result.updated ? "予定を更新しました。" : null;
          },
        };
      }

      if (request === "../managers/PromptBuilder") {
        return {};
      }

      if (request === "../../openai") {
        return {
          chatWithNotia() {
            throw new Error("外部AIを呼び出してはいけません");
          },
        };
      }
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  taskManager = require(managerPath);
  ({ handleChat } = require(runtimePath));
} finally {
  Module._load = originalLoad;
}

test("通常チャットから既存予定の場所だけを更新する", async () => {
  saved = [];
  analyzerOptions = null;

  const result = await handleChat(
    "9月24日の会議の場所を第2会議室にして",
    "test-user"
  );

  assert.equal(analyzerOptions.activeEvents.length, 1);
  assert.equal(analyzerOptions.activeEvents[0].id, 7);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, "test-user");
  assert.equal(saved[0].id, 7);
  assert.equal(saved[0].values.location, "第2会議室");
  assert.equal(saved[0].values.event_date, event.event_date);
  assert.equal(saved[0].values.start_time, event.start_time);
  assert.equal(saved[0].values.notification, event.notification);
  assert.match(result.reply, /更新しました/);
});
