const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizePriority,
  getPriorityRank,
  getPriorityIcon,
  sortTasks,
  createTaskListReply,
  formatTasksForApi,
} = require("../src/managers/TaskListManager");

test("優先度を正規化できる", () => {
  assert.equal(normalizePriority("high"), "high");
  assert.equal(normalizePriority("normal"), "normal");
  assert.equal(normalizePriority("low"), "low");

  assert.equal(normalizePriority(null), "normal");
  assert.equal(normalizePriority(undefined), "normal");
  assert.equal(normalizePriority("unknown"), "normal");
});

test("優先度ごとの順位を返せる", () => {
  assert.equal(getPriorityRank("high"), 1);
  assert.equal(getPriorityRank("normal"), 2);
  assert.equal(getPriorityRank("low"), 3);

  assert.equal(getPriorityRank(undefined), 2);
});

test("優先度ごとのアイコンを返せる", () => {
  assert.equal(getPriorityIcon("high"), "🔴");
  assert.equal(getPriorityIcon("normal"), "🟡");
  assert.equal(getPriorityIcon("low"), "🔵");

  assert.equal(getPriorityIcon(undefined), "🟡");
});

test("タスクを優先度順に並び替えられる", () => {
  const tasks = [
    {
      title: "低優先度タスク",
      priority: "low",
      due_date: null,
    },
    {
      title: "通常優先度タスク",
      priority: "normal",
      due_date: null,
    },
    {
      title: "高優先度タスク",
      priority: "high",
      due_date: null,
    },
  ];

  const sortedTasks = sortTasks(tasks);

  assert.deepEqual(
    sortedTasks.map((task) => task.title),
    [
      "高優先度タスク",
      "通常優先度タスク",
      "低優先度タスク",
    ]
  );
});

test("優先度が同じ場合は期限が近い順に並び替えられる", () => {
  const tasks = [
    {
      title: "期限が遅いタスク",
      priority: "normal",
      due_date: "2030-07-20",
    },
    {
      title: "期限なしタスク",
      priority: "normal",
      due_date: null,
    },
    {
      title: "期限が早いタスク",
      priority: "normal",
      due_date: "2030-07-15",
    },
  ];

  const sortedTasks = sortTasks(tasks);

  assert.deepEqual(
    sortedTasks.map((task) => task.title),
    [
      "期限が早いタスク",
      "期限が遅いタスク",
      "期限なしタスク",
    ]
  );
});

test("元のタスク配列を変更せずに並び替える", () => {
  const tasks = [
    {
      title: "低優先度タスク",
      priority: "low",
      due_date: null,
    },
    {
      title: "高優先度タスク",
      priority: "high",
      due_date: null,
    },
  ];

  const originalTasks = [...tasks];

  sortTasks(tasks);

  assert.deepEqual(tasks, originalTasks);
});

test("タスク一覧に優先度アイコンを表示できる", () => {
  const tasks = [
    {
      title: "重要なタスク",
      priority: "high",
      due_date: null,
    },
    {
      title: "通常のタスク",
      priority: "normal",
      due_date: null,
    },
    {
      title: "余裕のあるタスク",
      priority: "low",
      due_date: null,
    },
  ];

  const reply = createTaskListReply(tasks);

  assert.match(reply, /🔴 重要なタスク/);
  assert.match(reply, /🟡 通常のタスク/);
  assert.match(
  reply,
  /🔵 余裕のあるタスク/
);
});

test("タスク一覧では高優先度から順番に表示される", () => {
  const tasks = [
    {
      title: "低優先度タスク",
      priority: "low",
      due_date: null,
    },
    {
      title: "高優先度タスク",
      priority: "high",
      due_date: null,
    },
    {
      title: "通常優先度タスク",
      priority: "normal",
      due_date: null,
    },
  ];

  const reply = createTaskListReply(tasks);

  const highPosition = reply.indexOf("高優先度タスク");
  const normalPosition = reply.indexOf("通常優先度タスク");
  const lowPosition = reply.indexOf("低優先度タスク");

  assert.ok(highPosition < normalPosition);
  assert.ok(normalPosition < lowPosition);
});

test("API用タスクに優先度情報を追加できる", () => {
  const tasks = [
    {
      id: 1,
      title: "重要なタスク",
      priority: "high",
      due_date: null,
    },
    {
      id: 2,
      title: "優先度未設定タスク",
      due_date: null,
    },
  ];

  const formattedTasks = formatTasksForApi(tasks);

  const highTask = formattedTasks.find((task) => task.id === 1);
  const normalTask = formattedTasks.find((task) => task.id === 2);

  assert.equal(highTask.priority, "high");
  assert.equal(highTask.priority_icon, "🔴");
  assert.equal(highTask.priority_rank, 1);

  assert.equal(normalTask.priority, "normal");
  assert.equal(normalTask.priority_icon, "🟡");
  assert.equal(normalTask.priority_rank, 2);
});

test("タスクがない場合は未完了タスクなしと返す", () => {
  assert.equal(
    createTaskListReply([]),
    "現在、未完了のタスクはありません。"
  );
});