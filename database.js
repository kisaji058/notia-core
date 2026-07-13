const Database = require("better-sqlite3");

const db = new Database("notia.db");

// =====================
// conversations
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

// =====================
// tasks
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_time TEXT,
  priority TEXT DEFAULT 'normal',
  category TEXT DEFAULT 'other',
  notification TEXT DEFAULT 'none',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
)
`).run();

function getTableColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

function hasColumn(tableName, columnName) {
  return getTableColumns(tableName).some(
    (column) => column.name === columnName
  );
}

// 既存DB用マイグレーション
if (!hasColumn("tasks", "priority")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN priority TEXT DEFAULT 'normal'
  `).run();
}

if (!hasColumn("tasks", "category")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN category TEXT DEFAULT 'other'
  `).run();
}

if (!hasColumn("tasks", "due_time")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN due_time TEXT
  `).run();
}

if (!hasColumn("tasks", "notification")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN notification TEXT DEFAULT 'none'
  `).run();
}

function saveConversation(role, message) {
  db.prepare(`
    INSERT INTO conversations (role, message)
    VALUES (?, ?)
  `).run(role, message);
}

function getRecentConversations(limit = 10) {
  return db.prepare(`
    SELECT role, message
    FROM conversations
    ORDER BY id DESC
    LIMIT ?
  `).all(limit).reverse();
}

function addTask(
  title,
  description = "",
  dueDate = null,
  priority = "normal",
  category = "other",
  dueTime = null,
  notification = "none"
) {
  const result = db.prepare(`
    INSERT INTO tasks (
      title,
      description,
      due_date,
      due_time,
      priority,
      category,
      notification
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description,
    dueDate,
    dueTime,
    priority,
    category,
    notification
  );

  return result.lastInsertRowid;
}

function getActiveTasks() {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
    ORDER BY created_at DESC
  `).all();
}

function getTasksByDate(date) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
      AND due_date = ?
    ORDER BY
      CASE
        WHEN due_time IS NULL OR due_time = '' THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(date);
}

function getRecentlyCompletedTasks(limit = 5) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE status = 'completed'
    ORDER BY completed_at DESC, id DESC
    LIMIT ?
  `).all(limit);
}

function restoreTaskById(id) {
  const result = db.prepare(`
    UPDATE tasks
    SET status = 'active',
        completed_at = NULL
    WHERE id = ?
      AND status = 'completed'
  `).run(id);

  return result.changes > 0;
}

function getTaskById(id) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE id = ?
    LIMIT 1
  `).get(id);
}

function completeTask(id) {
  const result = db.prepare(`
    UPDATE tasks
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

function findActiveTasks(title = null) {
  if (title) {
    return db.prepare(`
      SELECT *
      FROM tasks
      WHERE status = 'active'
        AND title = ?
      ORDER BY id DESC
    `).all(title);
  }

  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
    ORDER BY id DESC
  `).all();
}

function completeTaskById(id) {
  const result = db.prepare(`
    UPDATE tasks
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

function updateTaskById(id, updates = {}) {
  const fields = [];
  const values = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }

  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }

if (updates.dueDate !== undefined) {
  fields.push("due_date = ?");
  values.push(updates.dueDate);
}

if (updates.dueTime !== undefined) {
  fields.push("due_time = ?");
  values.push(updates.dueTime);
}

if (updates.priority !== undefined) {
  fields.push("priority = ?");
  values.push(updates.priority);
}

if (updates.category !== undefined) {
  fields.push("category = ?");
  values.push(updates.category);
}

if (updates.notification !== undefined) {
  fields.push("notification = ?");
  values.push(updates.notification);
}

  if (fields.length === 0) {
    return false;
  }

  values.push(id);

  const result = db.prepare(`
    UPDATE tasks
    SET ${fields.join(", ")}
    WHERE id = ?
  `).run(...values);

  return result.changes > 0;
}

// =====================
// memories
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

function saveOrUpdateMemory(category, key, value) {
  const existing = db.prepare(`
    SELECT *
    FROM memories
    WHERE category = ?
      AND memory_key = ?
    LIMIT 1
  `).get(category, key);

  if (existing) {
    db.prepare(`
      UPDATE memories
      SET memory_value = ?
      WHERE id = ?
    `).run(value, existing.id);

    return {
      action: "updated",
      id: existing.id,
    };
  }

  const result = db.prepare(`
    INSERT INTO memories (
      category,
      memory_key,
      memory_value
    )
    VALUES (?, ?, ?)
  `).run(category, key, value);

  return {
    action: "created",
    id: result.lastInsertRowid,
  };
}

function getAllMemories() {
  return db.prepare(`
    SELECT *
    FROM memories
    ORDER BY created_at DESC
  `).all();
}

function deleteTaskById(id) {
  const result = db.prepare(`
    DELETE FROM tasks
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

module.exports = {
  saveConversation,
  getRecentConversations,

  addTask,
  getActiveTasks,
  getTaskById,
  completeTask,
  completeTaskById,
  findActiveTasks,
  updateTaskById,

  saveOrUpdateMemory,
  getAllMemories,
  deleteTaskById,
  getRecentlyCompletedTasks,
restoreTaskById,
getTasksByDate,
};



