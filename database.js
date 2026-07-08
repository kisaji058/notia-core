const Database = require("better-sqlite3");

const db = new Database("notia.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
)
`).run();

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

function addTask(title, description = "", dueDate = null) {
  db.prepare(`
    INSERT INTO tasks (title, description, due_date)
    VALUES (?, ?, ?)
  `).run(title, description, dueDate);
}

function getActiveTasks() {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
    ORDER BY created_at DESC
  `).all();
}

function completeTask(id) {
  db.prepare(`
    UPDATE tasks
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
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
  db.prepare(`
    UPDATE tasks
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
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

    return { action: "updated", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO memories (category, memory_key, memory_value)
    VALUES (?, ?, ?)
  `).run(category, key, value);

  return { action: "created", id: result.lastInsertRowid };
}

function getAllMemories() {
  return db.prepare(`
    SELECT *
    FROM memories
    ORDER BY created_at DESC
  `).all();
}

function updateTaskById(id, updates) {
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

module.exports = {
  saveConversation,
  getRecentConversations,

  addTask,
  getActiveTasks,
  completeTask,
  completeTaskById,
  findActiveTasks,

  saveOrUpdateMemory,
  getAllMemories,
  updateTaskById,
};



