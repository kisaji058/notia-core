const Database = require("better-sqlite3");

const db = new Database("notia.db");

// =====================
// conversations
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
  notified_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
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

db.prepare(`
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  routine_time TEXT,
  category TEXT DEFAULT 'other',
  google_calendar_enabled INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

function getGoogleIntegration() {
  return db.prepare(`
    SELECT
      provider,
      email,
      connected_at,
      last_sync_at
    FROM integrations
    WHERE provider = ?
    LIMIT 1
  `).get("google");
}

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

if (!hasColumn("tasks", "notified_at")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN notified_at TEXT
  `).run();
}

if (!hasColumn("routines", "google_event_id")) {
  db.prepare(`
    ALTER TABLE routines
    ADD COLUMN google_event_id TEXT
  `).run();
}
// =====================
// integrations
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date INTEGER,
  scope TEXT,
  token_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

if (!hasColumn("integrations", "email")) {
  db.prepare(`
    ALTER TABLE integrations
    ADD COLUMN email TEXT
  `).run();
}

if (!hasColumn("integrations", "connected_at")) {
  db.prepare(`
    ALTER TABLE integrations
    ADD COLUMN connected_at TEXT
  `).run();
}

if (!hasColumn("integrations", "last_sync_at")) {
  db.prepare(`
    ALTER TABLE integrations
    ADD COLUMN last_sync_at TEXT
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
    SELECT
      role,
      message,
      created_at
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

function getNotificationTargets(date) {
  const tomorrow = new Date(
  `${date}T00:00:00+09:00`
);

tomorrow.setDate(
  tomorrow.getDate() + 1
);

const tomorrowDate =
  tomorrow.toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
  AND notified_at IS NULL
  AND (
    (notification = 'same_day'
      AND due_date = ?)
    OR
    (notification = 'day_before'
      AND due_date = ?)
  )
    ORDER BY
      CASE
        WHEN due_time IS NULL OR due_time = '' THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(date, tomorrowDate);
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

function findActiveTasks(
  title = null,
  dueDate = null
) {
  if (title) {
    return db.prepare(`
      SELECT *
FROM tasks
WHERE status = 'active'
  AND title = ?
  AND (
    due_date = ?
    OR (
      due_date IS NULL
      AND ? IS NULL
    )
  )
ORDER BY id DESC
    `).all(
  title,
  dueDate,
  dueDate
);

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
// external_calendar_events
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS external_calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  title TEXT NOT NULL,
  description TEXT,
  start_datetime TEXT,
  end_datetime TEXT,
  is_all_day INTEGER DEFAULT 0,
  location TEXT,
  status TEXT,
  updated_at_external TEXT,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(provider, external_event_id)
)
`).run();

// =====================
// task_calendar_links
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS task_calendar_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(task_id, provider),

  FOREIGN KEY (task_id)
    REFERENCES tasks(id)
    ON DELETE CASCADE
)
`).run();

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

// =====================
// integrations functions
// =====================

function saveIntegrationTokens(
  provider,
  tokens = {},
  email = null
) {
  db.prepare(`
    INSERT INTO integrations (
      provider,
      access_token,
      refresh_token,
      expiry_date,
      scope,
      token_type,
      email,
      connected_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )

    ON CONFLICT(provider) DO UPDATE SET
      access_token = COALESCE(
        excluded.access_token,
        integrations.access_token
      ),
      refresh_token = COALESCE(
        excluded.refresh_token,
        integrations.refresh_token
      ),
      expiry_date = COALESCE(
        excluded.expiry_date,
        integrations.expiry_date
      ),
      scope = COALESCE(
        excluded.scope,
        integrations.scope
      ),
      token_type = COALESCE(
        excluded.token_type,
        integrations.token_type
      ),
      email = COALESCE(
        excluded.email,
        integrations.email
      ),
      connected_at = COALESCE(
        integrations.connected_at,
        CURRENT_TIMESTAMP
      ),
      updated_at = CURRENT_TIMESTAMP
  `).run(
    provider,
    tokens.access_token ?? null,
    tokens.refresh_token ?? null,
    tokens.expiry_date ?? null,
    tokens.scope ?? null,
    tokens.token_type ?? null,
    email
  );
}

function getIntegrationTokens(provider) {
  const integration = db.prepare(`
    SELECT
      access_token,
      refresh_token,
      expiry_date,
      scope,
      token_type
    FROM integrations
    WHERE provider = ?
    LIMIT 1
  `).get(provider);

  if (!integration) {
    return null;
  }

  return {
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.expiry_date,
    scope: integration.scope,
    token_type: integration.token_type,
  };
}

function deleteIntegration(provider) {
  const result = db.prepare(`
    DELETE FROM integrations
    WHERE provider = ?
  `).run(provider);

  return result.changes > 0;
}

// =====================
// external calendar functions
// =====================

function saveExternalCalendarEvent(
  provider,
  event = {}
) {
  db.prepare(`
    INSERT INTO external_calendar_events (
      provider,
      external_event_id,
      calendar_id,
      title,
      description,
      start_datetime,
      end_datetime,
      is_all_day,
      location,
      status,
      updated_at_external,
      synced_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

    ON CONFLICT(provider, external_event_id)
    DO UPDATE SET
      calendar_id = excluded.calendar_id,
      title = excluded.title,
      description = excluded.description,
      start_datetime = excluded.start_datetime,
      end_datetime = excluded.end_datetime,
      is_all_day = excluded.is_all_day,
      location = excluded.location,
      status = excluded.status,
      updated_at_external = excluded.updated_at_external,
      synced_at = CURRENT_TIMESTAMP
  `).run(
    provider,
    event.externalEventId,
    event.calendarId ?? "primary",
    event.title ?? "無題の予定",
    event.description ?? null,
    event.startDateTime ?? null,
    event.endDateTime ?? null,
    event.isAllDay ? 1 : 0,
    event.location ?? null,
    event.status ?? null,
    event.updatedAtExternal ?? null
  );
}

function getExternalCalendarEventsByDate(
  provider,
  date
) {
  return db.prepare(`
    SELECT *
    FROM external_calendar_events
    WHERE provider = ?
      AND (
        substr(start_datetime, 1, 10) = ?
        OR (
          is_all_day = 1
          AND substr(start_datetime, 1, 10) <= ?
          AND substr(end_datetime, 1, 10) > ?
        )
      )
      AND (
        status IS NULL
        OR status != 'cancelled'
      )
    ORDER BY
      CASE
        WHEN is_all_day = 1 THEN 0
        ELSE 1
      END,
      start_datetime ASC
  `).all(
    provider,
    date,
    date,
    date
  );
}

function deleteExternalCalendarEventsByProvider(
  provider
) {
  const result = db.prepare(`
    DELETE FROM external_calendar_events
    WHERE provider = ?
  `).run(provider);

  return result.changes;
}

// =====================
// task calendar link functions
// =====================

function saveTaskCalendarLink(
  taskId,
  provider,
  externalEventId
) {
  db.prepare(`
    INSERT INTO task_calendar_links (
      task_id,
      provider,
      external_event_id,
      synced_at
    )
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)

    ON CONFLICT(task_id, provider)
    DO UPDATE SET
      external_event_id = excluded.external_event_id,
      synced_at = CURRENT_TIMESTAMP
  `).run(
    taskId,
    provider,
    externalEventId
  );
}

function getTaskCalendarLink(
  taskId,
  provider
) {
  return db.prepare(`
    SELECT *
    FROM task_calendar_links
    WHERE task_id = ?
      AND provider = ?
    LIMIT 1
  `).get(
    taskId,
    provider
  );
}

function getUnsyncedTimedTasks(provider) {
  return db.prepare(`
    SELECT tasks.*
    FROM tasks
    LEFT JOIN task_calendar_links
      ON task_calendar_links.task_id = tasks.id
      AND task_calendar_links.provider = ?
    WHERE tasks.status = 'active'
      AND tasks.due_date IS NOT NULL
      AND tasks.due_date != ''
      AND tasks.due_time IS NOT NULL
      AND tasks.due_time != ''
      AND task_calendar_links.id IS NULL
    ORDER BY
      tasks.due_date ASC,
      tasks.due_time ASC,
      tasks.id ASC
  `).all(provider);
}

function updateIntegrationLastSync(provider) {
  const result = db.prepare(`
    UPDATE integrations
    SET
      last_sync_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE provider = ?
  `).run(provider);

  return result.changes > 0;
}

function createRoutine({
  title,
  dayOfWeek,
  routineTime = null,
  category = "other",
  googleCalendarEnabled = false,
}) {
  const result = db
    .prepare(`
      INSERT INTO routines (
        title,
        day_of_week,
        routine_time,
        category,
        google_calendar_enabled
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      title,
      dayOfWeek,
      routineTime,
      category,
      googleCalendarEnabled ? 1 : 0
    );

  return getRoutineById(result.lastInsertRowid);
}

function getRoutineById(id) {
  return db.prepare(`
    SELECT *
    FROM routines
    WHERE id = ?
      AND status = 'active'
  `).get(id);
}

function getActiveRoutines() {
  return db
    .prepare(`
      SELECT *
      FROM routines
      WHERE status = 'active'
      ORDER BY
        day_of_week ASC,
        CASE
          WHEN routine_time IS NULL THEN 1
          ELSE 0
        END ASC,
        routine_time ASC,
        created_at ASC
    `)
    .all();
}

function getRoutinesByDayOfWeek(dayOfWeek) {
  return db
    .prepare(`
      SELECT *
      FROM routines
      WHERE
        day_of_week = ?
        AND status = 'active'
      ORDER BY
        CASE
          WHEN routine_time IS NULL THEN 1
          ELSE 0
        END ASC,
        routine_time ASC,
        created_at ASC
    `)
    .all(dayOfWeek);
}

function archiveRoutineById(id) {
  const result = db
    .prepare(`
      UPDATE routines
      SET status = 'archived'
      WHERE id = ?
    `)
    .run(id);

  return result.changes > 0;
}

function getCurrentDayOfWeek() {
  const dateText = new Date().toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );

  return new Date(
    `${dateText}T00:00:00+09:00`
  ).getDay();
}

function getTodayRoutines() {
  const today = new Date();

  const dayOfWeek =
    today.getDay();

  return db
    .prepare(`
      SELECT *
      FROM routines
      WHERE
        status='active'
      AND
        day_of_week=?
      ORDER BY
        routine_time ASC,
        id ASC
    `)
    .all(dayOfWeek);
}

function updateRoutineById(
  id,
  {
    title,
    dayOfWeek,
    routineTime,
    category,
    googleCalendarEnabled,
  }
) {
  return db
    .prepare(`
      UPDATE routines
      SET
        title = ?,
        day_of_week = ?,
        routine_time = ?,
        category = ?,
        google_calendar_enabled = ?
      WHERE id = ?
    `)
    .run(
      title,
      dayOfWeek,
      routineTime,
      category,
      googleCalendarEnabled ? 1 : 0,
      id
    );
}

function deleteRoutineById(id) {
  return db
    .prepare(`
      DELETE FROM routines
      WHERE id = ?
    `)
    .run(id);
}

function getUnsyncedGoogleRoutines() {
  return db.prepare(`
    SELECT *
    FROM routines
    WHERE
      status = 'active'
      AND google_calendar_enabled = 1
      AND google_event_id IS NULL
    ORDER BY
      day_of_week,
      routine_time,
      id
  `).all();
}

function saveRoutineGoogleEventId(
  routineId,
  googleEventId
) {
  return db.prepare(`
    UPDATE routines
    SET google_event_id = ?
    WHERE id = ?
  `).run(
    googleEventId,
    routineId
  );
}

function markTaskNotified(id) {
  return db
    .prepare(`
      UPDATE tasks
      SET notified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(id);
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

  saveIntegrationTokens,
  getIntegrationTokens,
  deleteIntegration,
    saveExternalCalendarEvent,
  getExternalCalendarEventsByDate,
  deleteExternalCalendarEventsByProvider,
  saveTaskCalendarLink,
  getTaskCalendarLink,
  getUnsyncedTimedTasks,
  getGoogleIntegration,
  updateIntegrationLastSync,
  createRoutine,
  getRoutineById,
  getActiveRoutines,
  getRoutinesByDayOfWeek,
  getTodayRoutines,
  archiveRoutineById,
  getTodayRoutines,
  updateRoutineById,
  deleteRoutineById,
  getUnsyncedGoogleRoutines,
saveRoutineGoogleEventId,
getRoutineById,
getNotificationTargets,
markTaskNotified,
};



