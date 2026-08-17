const Database = require("better-sqlite3");

const db = new Database("notia.db");

// =====================
// users
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

// =====================
// auth_identities
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS auth_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(provider, provider_user_id),

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
)
`).run();

function getAllUsers() {
  return db.prepare(`
    SELECT
      id,
      email,
      display_name
    FROM users
    ORDER BY id ASC
  `).all();
}

function getUserById(userId) {
  return db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(userId);
}

function getUserByAuthIdentity(
  provider,
  providerUserId
) {
  return db.prepare(`
    SELECT users.*
    FROM auth_identities
    INNER JOIN users
      ON users.id = auth_identities.user_id
    WHERE auth_identities.provider = ?
      AND auth_identities.provider_user_id = ?
    LIMIT 1
  `).get(
    provider,
    providerUserId
  );
}

function createAuthIdentity(
  userId,
  {
    provider,
    providerUserId,
    email = null,
  }
) {
  db.prepare(`
    INSERT INTO auth_identities (
      user_id,
      provider,
      provider_user_id,
      email
    )
    VALUES (?, ?, ?, ?)
  `).run(
    userId,
    provider,
    providerUserId,
    email
  );

  return getUserById(userId);
}

function createUserWithAuthIdentity({
  provider,
  providerUserId,
  email,
  displayName = null,
}) {
  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO users (
        email,
        display_name
      )
      VALUES (?, ?)
    `).run(
      email,
      displayName
    );

    const userId =
      result.lastInsertRowid;

    db.prepare(`
      INSERT INTO auth_identities (
        user_id,
        provider,
        provider_user_id,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      userId,
      provider,
      providerUserId,
      email
    );

    return getUserById(userId);
  });

  return transaction();
}

// =====================
// conversations
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
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
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_time TEXT,
  location TEXT,
  priority TEXT DEFAULT 'normal',
  category TEXT DEFAULT 'other',
  notification TEXT DEFAULT 'none',
  item_type TEXT DEFAULT 'task',
  notified_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  days_of_week TEXT NOT NULL,
  routine_time TEXT,
  category TEXT DEFAULT 'other',
  google_calendar_enabled INTEGER DEFAULT 0,
  google_event_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  memo TEXT
)
`).run();

function getGoogleIntegration(userId) {
  return db.prepare(`
    SELECT
      provider,
      email,
      connected_at,
      last_sync_at
    FROM integrations
    WHERE user_id = ?
      AND provider = ?
    LIMIT 1
  `).get(
    userId,
    "google"
  );
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

if (!hasColumn("tasks", "location")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN location TEXT
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

if (!hasColumn("tasks", "item_type")) {
  db.prepare(`
    ALTER TABLE tasks
    ADD COLUMN item_type TEXT DEFAULT 'task'
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

if (!hasColumn("routines", "memo")) {
  db.exec(`
    ALTER TABLE routines
    ADD COLUMN memo TEXT
  `);
}

if (!hasColumn("routines", "days_of_week")) {
  db.exec(`
    ALTER TABLE routines
    ADD COLUMN days_of_week TEXT
  `);
}

// 既存の単一曜日データを複数曜日形式へ引き継ぐ。
db.prepare(`
  UPDATE routines
  SET days_of_week = CAST(day_of_week AS TEXT)
  WHERE days_of_week IS NULL
    OR TRIM(days_of_week) = ''
`).run();
// =====================
// integrations
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date INTEGER,
  scope TEXT,
  token_type TEXT,
  email TEXT,
  connected_at TEXT,
  last_sync_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, provider)
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

function saveConversation(
  userId,
  role,
  message
) {
  db.prepare(`
    INSERT INTO conversations (
      user_id,
      role,
      message
    )
    VALUES (?, ?, ?)
  `).run(
    userId,
    role,
    message
  );
}

function getRecentConversations(
  userId,
  limit = 10
) {
  return db.prepare(`
    SELECT
      role,
      message,
      created_at
    FROM conversations
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(
    userId,
    limit
  ).reverse();
}

function addTask(
  userId,
  title,
  description = "",
  dueDate = null,
  priority = "normal",
  category = "other",
  dueTime = null,
  notification = "none",
  itemType = "task",
  location = ""
) {
  const result = db.prepare(`
    INSERT INTO tasks (
    user_id,
      title,
      description,
      due_date,
      due_time,
      priority,
      category,
      notification,
      item_type,
      location
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    title,
    description,
    dueDate,
    dueTime,
    priority,
    category,
    notification,
    itemType,
    location
  );

  return result.lastInsertRowid;
}

function getActiveTasks(userId) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'active'
    ORDER BY created_at DESC
  `).all(userId);
}

function getTasksByDate(
  userId,
  date
) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'active'
      AND due_date = ?
    ORDER BY
      CASE
        WHEN due_time IS NULL
          OR due_time = ''
        THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(
    userId,
    date
  );
}

function getTasksByDateRange(
  userId,
  startDate,
  endDate
) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'active'
      AND due_date BETWEEN ? AND ?
    ORDER BY
      due_date ASC,
      CASE
        WHEN due_time IS NULL
          OR due_time = ''
        THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(
    userId,
    startDate,
    endDate
  );
}

function getCompletedTasksByDate(
  userId,
  date
) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'completed'
      AND due_date = ?
    ORDER BY
      CASE
        WHEN due_time IS NULL
          OR due_time = ''
        THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(
    userId,
    date
  );
}

function getCompletedTasksByDateRange(
  userId,
  startDate,
  endDate
) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'completed'
      AND due_date BETWEEN ? AND ?
    ORDER BY
      due_date ASC,
      CASE
        WHEN due_time IS NULL
          OR due_time = ''
        THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(
    userId,
    startDate,
    endDate
  );
}

function getNotificationTargets(
  userId,
  date
) {
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
    WHERE user_id = ?
      AND status = 'active'
      AND notified_at IS NULL
      AND (
        (
          notification = 'same_day'
          AND due_date = ?
        )
        OR
        (
          notification = 'day_before'
          AND due_date = ?
        )
        OR
        (
          notification IN (
            'at_time',
            '10_minutes_before',
            '30_minutes_before',
            '1_hour_before'
          )
          AND due_date IN (?, ?)
        )
      )
    ORDER BY
      CASE
        WHEN due_time IS NULL
          OR due_time = ''
        THEN 1
        ELSE 0
      END,
      due_time ASC,
      id ASC
  `).all(
    userId,
    date,
    tomorrowDate,
    date,
    tomorrowDate
  );
}

function getEventNotificationTargets(
  userId,
  date
) {
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
    SELECT
      *,
      event_date AS due_date,
      start_time AS due_time
    FROM events
    WHERE user_id = ?
      AND status = 'active'
      AND notified_at IS NULL
      AND (
        (
          notification = 'same_day'
          AND event_date = ?
        )
        OR
        (
          notification = 'day_before'
          AND event_date = ?
        )
        OR
        (
          notification IN (
            'at_time',
            '10_minutes_before',
            '30_minutes_before',
            '1_hour_before'
          )
          AND event_date IN (?, ?)
        )
      )
    ORDER BY
      CASE
        WHEN start_time IS NULL
          OR start_time = ''
        THEN 1
        ELSE 0
      END,
      start_time ASC,
      id ASC
  `).all(
    userId,
    date,
    tomorrowDate,
    date,
    tomorrowDate
  );
}

function getRecentlyCompletedTasks(
  userId,
  limit = 5
) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'completed'
    ORDER BY
      completed_at DESC,
      id DESC
    LIMIT ?
  `).all(
    userId,
    limit
  );
}

function restoreTaskById(
  userId,
  id
) {
  const result = db.prepare(`
    UPDATE tasks
    SET
      status = 'active',
      completed_at = NULL
    WHERE id = ?
      AND user_id = ?
      AND status = 'completed'
  `).run(
    id,
    userId
  );

  return result.changes > 0;
}

function getTaskById(
  userId,
  id
) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE id = ?
      AND user_id = ?
    LIMIT 1
  `).get(
    id,
    userId
  );
}

function completeTask(
  userId,
  id
) {
  const result = db.prepare(`
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND user_id = ?
  `).run(
    id,
    userId
  );

  return result.changes > 0;
}

function findActiveTasks(
  userId,
  title = null,
  dueDate = null,
  dueTime = null
) {
  if (title) {
  return db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
      AND status = 'active'
      AND title = ?
      AND (
        due_date = ?
        OR (
          due_date IS NULL
          AND ? IS NULL
        )
      )
      AND (
        due_time = ?
        OR (
          (
            due_time IS NULL
            OR due_time = ''
          )
          AND (
            ? IS NULL
            OR ? = ''
          )
        )
      )
    ORDER BY id DESC
  `).all(
    userId,
    title,
    dueDate,
    dueDate,
    dueTime,
    dueTime,
    dueTime
  );
}

  return db.prepare(`
  SELECT *
  FROM tasks
  WHERE user_id = ?
    AND status = 'active'
  ORDER BY id DESC
`).all(userId);
}

function completeTaskById(
  userId,
  id
) {
  const result = db.prepare(`
    UPDATE tasks
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
    AND user_id = ?
  `).run(id, userId);

  return result.changes > 0;
}

function updateTaskById(
  userId,
  id,
  updates = {}
) {
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

if (updates.location !== undefined) {
  fields.push("location = ?");
  values.push(updates.location);
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

if (updates.itemType !== undefined) {
  fields.push("item_type = ?");
  values.push(updates.itemType);
}

  if (fields.length === 0) {
    return false;
  }

  values.push(id);
  values.push(userId);

  const result = db.prepare(`
    UPDATE tasks
    SET ${fields.join(", ")}
    WHERE id = ?
    AND user_id = ?
  `).run(...values);

  return result.changes > 0;
}

// =====================
// external_calendar_events
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS external_calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
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

  UNIQUE(
    user_id,
    provider,
    external_event_id
  )
)
`).run();

// =====================
// events
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  priority TEXT DEFAULT 'normal',
  category TEXT DEFAULT 'other',
  notification TEXT DEFAULT 'none',
  notified_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

if (!hasColumn("events", "priority")) {
  db.prepare(`
    ALTER TABLE events
    ADD COLUMN priority TEXT DEFAULT 'normal'
  `).run();
}

if (!hasColumn("events", "category")) {
  db.prepare(`
    ALTER TABLE events
    ADD COLUMN category TEXT DEFAULT 'other'
  `).run();
}

if (!hasColumn("events", "notification")) {
  db.prepare(`
    ALTER TABLE events
    ADD COLUMN notification TEXT DEFAULT 'none'
  `).run();
}

if (!hasColumn("events", "notified_at")) {
  db.prepare(`
    ALTER TABLE events
    ADD COLUMN notified_at TEXT
  `).run();
}

// =====================
// task_calendar_links
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS task_calendar_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(
    user_id,
    task_id,
    provider
  ),

  FOREIGN KEY (task_id)
    REFERENCES tasks(id)
    ON DELETE CASCADE
)
`).run();

// =====================
// daily_notification_logs
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS daily_notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  notification_type TEXT NOT NULL,
  notification_date TEXT NOT NULL,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(
    user_id,
    notification_type,
    notification_date
  )
)
`).run();

function hasDailyNotificationBeenSent(
  userId,
  notificationType,
  notificationDate
) {
  const row = db.prepare(`
    SELECT id
    FROM daily_notification_logs
    WHERE user_id = ?
      AND notification_type = ?
      AND notification_date = ?
    LIMIT 1
  `).get(
    userId,
    notificationType,
    notificationDate
  );

  return Boolean(row);
}

function markDailyNotificationSent(
  userId,
  notificationType,
  notificationDate
) {
  return db.prepare(`
    INSERT OR IGNORE
    INTO daily_notification_logs (
      user_id,
      notification_type,
      notification_date
    )
    VALUES (?, ?, ?)
  `).run(
    userId,
    notificationType,
    notificationDate
  );
}

// =====================
// notification_settings
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  morning_enabled INTEGER DEFAULT 1,
  morning_time TEXT DEFAULT '08:00',
  evening_enabled INTEGER DEFAULT 1,
  evening_time TEXT DEFAULT '18:00',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

function ensureNotificationSettings(
  userId
) {
  db.prepare(`
    INSERT OR IGNORE
    INTO notification_settings (
      user_id,
      morning_enabled,
      morning_time,
      evening_enabled,
      evening_time
    )
    VALUES (
      ?,
      1,
      '08:00',
      1,
      '18:00'
    )
  `).run(userId);
}

function getNotificationSettings(
  userId
) {
  ensureNotificationSettings(userId);

  const settings = db.prepare(`
    SELECT
      morning_enabled,
      morning_time,
      evening_enabled,
      evening_time
    FROM notification_settings
    WHERE user_id = ?
    LIMIT 1
  `).get(userId);

  return {
    morningEnabled:
      Boolean(
        settings?.morning_enabled
      ),

    morningTime:
      settings?.morning_time ||
      "08:00",

    eveningEnabled:
      Boolean(
        settings?.evening_enabled
      ),

    eveningTime:
      settings?.evening_time ||
      "18:00",
  };
}

function updateNotificationSettings(
  userId,
  {
    morningEnabled,
    morningTime,
    eveningEnabled,
    eveningTime,
  }
) {
  ensureNotificationSettings(userId);

  return db.prepare(`
    UPDATE notification_settings
    SET
      morning_enabled = ?,
      morning_time = ?,
      evening_enabled = ?,
      evening_time = ?,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    morningEnabled ? 1 : 0,
    morningTime,
    eveningEnabled ? 1 : 0,
    eveningTime,
    userId
  );
}

// =====================
// memories
// =====================

db.prepare(`
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

function saveOrUpdateMemory(
  userId,
  category,
  key,
  value
) {
  const existing = db.prepare(`
    SELECT *
    FROM memories
    WHERE user_id = ?
      AND category = ?
      AND memory_key = ?
    LIMIT 1
  `).get(
    userId,
    category,
    key
  );

  if (existing) {
    db.prepare(`
      UPDATE memories
      SET memory_value = ?
      WHERE user_id = ?
        AND id = ?
    `).run(
      value,
      userId,
      existing.id
    );

    return {
      action: "updated",
      id: existing.id,
    };
  }

  const result = db.prepare(`
    INSERT INTO memories (
      user_id,
      category,
      memory_key,
      memory_value
    )
    VALUES (?, ?, ?, ?)
  `).run(
    userId,
    category,
    key,
    value
  );

  return {
    action: "created",
    id: result.lastInsertRowid,
  };
}

function getAllMemories(
  userId
) {
  return db.prepare(`
    SELECT *
    FROM memories
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}

function deleteTaskById(
  userId,
  id
) {
  const result = db.prepare(`
    DELETE FROM tasks
    WHERE id = ?
      AND user_id = ?
  `).run(
    id,
    userId
  );

  return result.changes > 0;
}

// =====================
// integrations functions
// =====================

function saveIntegrationTokens(
  userId,
  provider,
  tokens = {},
  email = null
) {
  db.prepare(`
    INSERT INTO integrations (
      user_id,
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
      ?, ?, ?, ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )

    ON CONFLICT(user_id, provider)
    DO UPDATE SET
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
    userId,
    provider,
    tokens.access_token ?? null,
    tokens.refresh_token ?? null,
    tokens.expiry_date ?? null,
    tokens.scope ?? null,
    tokens.token_type ?? null,
    email
  );
}

function getIntegrationTokens(
  userId,
  provider
) {
  const integration = db.prepare(`
    SELECT
      access_token,
      refresh_token,
      expiry_date,
      scope,
      token_type
    FROM integrations
    WHERE user_id = ?
      AND provider = ?
    LIMIT 1
  `).get(
    userId,
    provider
  );

  if (!integration) {
    return null;
  }

  return {
    access_token:
      integration.access_token,
    refresh_token:
      integration.refresh_token,
    expiry_date:
      integration.expiry_date,
    scope:
      integration.scope,
    token_type:
      integration.token_type,
  };
}

function deleteIntegration(
  userId,
  provider
) {
  const result = db.prepare(`
    DELETE FROM integrations
    WHERE user_id = ?
      AND provider = ?
  `).run(
    userId,
    provider
  );

  return result.changes > 0;
}

// =====================
// external calendar functions
// =====================

function saveExternalCalendarEvent(
  userId,
  provider,
  event = {}
) {
  db.prepare(`
    INSERT INTO external_calendar_events (
      user_id,
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
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP
    )

    ON CONFLICT(
      user_id,
      provider,
      external_event_id
    )
    DO UPDATE SET
      calendar_id =
        excluded.calendar_id,
      title =
        excluded.title,
      description =
        excluded.description,
      start_datetime =
        excluded.start_datetime,
      end_datetime =
        excluded.end_datetime,
      is_all_day =
        excluded.is_all_day,
      location =
        excluded.location,
      status =
        excluded.status,
      updated_at_external =
        excluded.updated_at_external,
      synced_at =
        CURRENT_TIMESTAMP
  `).run(
    userId,
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
  userId,
  provider,
  date
) {
  return db.prepare(`
    SELECT *
    FROM external_calendar_events
    WHERE user_id = ?
      AND provider = ?
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
    userId,
    provider,
    date,
    date,
    date
  );
}

function getExternalCalendarEventsByDateRange(
  userId,
  provider,
  startDate,
  endDate
) {
  return db.prepare(`
    SELECT *
    FROM external_calendar_events
    WHERE user_id = ?
      AND provider = ?
      AND (
        (
          is_all_day = 1
          AND substr(start_datetime, 1, 10) <= ?
          AND substr(end_datetime, 1, 10) > ?
        )
        OR (
          (
            is_all_day IS NULL
            OR is_all_day != 1
          )
          AND substr(start_datetime, 1, 10)
            BETWEEN ? AND ?
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
    userId,
    provider,
    endDate,
    startDate,
    startDate,
    endDate
  );
}

function deleteExternalCalendarEventsByProvider(
  userId,
  provider
) {
  const result = db.prepare(`
    DELETE FROM external_calendar_events
    WHERE user_id = ?
      AND provider = ?
  `).run(
    userId,
    provider
  );

  return result.changes;
}

// =====================
// task calendar link functions
// =====================

function saveTaskCalendarLink(
  userId,
  taskId,
  provider,
  externalEventId
) {
  db.prepare(`
    INSERT INTO task_calendar_links (
      user_id,
      task_id,
      provider,
      external_event_id,
      synced_at
    )
    VALUES (
      ?, ?, ?, ?,
      CURRENT_TIMESTAMP
    )

    ON CONFLICT(
      user_id,
      task_id,
      provider
    )
    DO UPDATE SET
      external_event_id =
        excluded.external_event_id,
      synced_at =
        CURRENT_TIMESTAMP
  `).run(
    userId,
    taskId,
    provider,
    externalEventId
  );
}

function getTaskCalendarLink(
  userId,
  taskId,
  provider
) {
  return db.prepare(`
    SELECT *
    FROM task_calendar_links
    WHERE user_id = ?
      AND task_id = ?
      AND provider = ?
    LIMIT 1
  `).get(
    userId,
    taskId,
    provider
  );
}

function getUnsyncedTimedTasks(
  userId,
  provider
) {
  return db.prepare(`
    SELECT tasks.*
    FROM tasks

    LEFT JOIN task_calendar_links
      ON task_calendar_links.task_id =
        tasks.id
      AND task_calendar_links.user_id =
        tasks.user_id
      AND task_calendar_links.provider = ?

    WHERE tasks.user_id = ?
      AND tasks.status = 'active'

      AND (
        tasks.item_type IS NULL
        OR tasks.item_type = 'task'
      )

      AND tasks.due_date IS NOT NULL
      AND tasks.due_date != ''

      AND task_calendar_links.id IS NULL

    ORDER BY
      tasks.due_date ASC,

      CASE
        WHEN tasks.due_time IS NULL
          OR tasks.due_time = ''
        THEN 1
        ELSE 0
      END,

      tasks.due_time ASC,
      tasks.id ASC
  `).all(
    provider,
    userId
  );
}

function updateIntegrationLastSync(
  userId,
  provider
) {
  const result = db.prepare(`
    UPDATE integrations
    SET
      last_sync_at =
        CURRENT_TIMESTAMP,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND provider = ?
  `).run(
    userId,
    provider
  );

  return result.changes > 0;
}

function normalizeDaysOfWeek(
  daysOfWeek,
  fallbackDayOfWeek = null
) {
  const source = Array.isArray(daysOfWeek)
    ? daysOfWeek
    : typeof daysOfWeek === "string"
      ? daysOfWeek.split(",")
      : [fallbackDayOfWeek];

  const normalized = [
    ...new Set(
      source
        .map((day) => Number(day))
        .filter(
          (day) =>
            Number.isInteger(day) &&
            day >= 0 &&
            day <= 6
        )
    ),
  ].sort((a, b) => a - b);

  if (normalized.length === 0) {
    throw new Error(
      "ルーティーンには曜日が1つ以上必要です。"
    );
  }

  return normalized;
}

function normalizeRoutineRow(routine) {
  if (!routine) {
    return routine;
  }

  const daysOfWeek = normalizeDaysOfWeek(
    routine.days_of_week,
    routine.day_of_week
  );

  return {
    ...routine,
    day_of_week: daysOfWeek[0],
    days_of_week: daysOfWeek,
  };
}

function createRoutine(
  userId,
  {
    title,
    dayOfWeek,
    daysOfWeek,
    routineTime = null,
    category = "other",
    googleCalendarEnabled = false,
    memo = "",
  }
) {
  const normalizedDays =
    normalizeDaysOfWeek(
      daysOfWeek,
      dayOfWeek
    );

  const result = db
    .prepare(`
      INSERT INTO routines (
        user_id,
        title,
        day_of_week,
        days_of_week,
        routine_time,
        category,
        google_calendar_enabled,
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      userId,
      title,
      normalizedDays[0],
      normalizedDays.join(","),
      routineTime,
      category,
      googleCalendarEnabled ? 1 : 0,
      memo
    );

  return getRoutineById(
    userId,
    result.lastInsertRowid
  );
}

function getRoutineById(
  userId,
  id
) {
  const routine = db.prepare(`
    SELECT *
    FROM routines
    WHERE user_id = ?
      AND id = ?
      AND status = 'active'
  `).get(
    userId,
    id
  );

  return normalizeRoutineRow(routine);
}

function getActiveRoutines(userId) {
  return db
    .prepare(`
      SELECT *
      FROM routines
      WHERE user_id = ?
        AND status = 'active'
      ORDER BY
        day_of_week ASC,
        CASE
          WHEN routine_time IS NULL THEN 1
          ELSE 0
        END ASC,
        routine_time ASC,
        created_at ASC
    `)
    .all(userId)
    .map(normalizeRoutineRow);
}

function getRoutinesByDayOfWeek(
  userId,
  dayOfWeek
) {
  return db
    .prepare(`
      SELECT *
      FROM routines
      WHERE user_id = ?
        AND status = 'active'
        AND (
          ',' || COALESCE(
            NULLIF(days_of_week, ''),
            CAST(day_of_week AS TEXT)
          ) || ','
        ) LIKE '%,' || ? || ',%'
      ORDER BY
        CASE
          WHEN routine_time IS NULL THEN 1
          ELSE 0
        END ASC,
        routine_time ASC,
        created_at ASC
    `)
    .all(
      userId,
      String(dayOfWeek)
    )
    .map(normalizeRoutineRow);
}

function archiveRoutineById(
  userId,
  id
) {
  const result = db
    .prepare(`
      UPDATE routines
      SET status = 'archived'
      WHERE user_id = ?
        AND id = ?
    `)
    .run(
      userId,
      id
    );

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

function getTodayRoutines(userId) {
  return getRoutinesByDayOfWeek(
    userId,
    getCurrentDayOfWeek()
  );
}

function updateRoutineById(
  userId,
  id,
  {
    title,
    dayOfWeek,
    daysOfWeek,
    routineTime,
    category,
    googleCalendarEnabled,
    memo = "",
  }
) {
  const normalizedDays =
    normalizeDaysOfWeek(
      daysOfWeek,
      dayOfWeek
    );

  return db
    .prepare(`
      UPDATE routines
      SET
        title = ?,
        day_of_week = ?,
        days_of_week = ?,
        routine_time = ?,
        category = ?,
        google_calendar_enabled = ?,
        memo = ?
      WHERE user_id = ?
        AND id = ?
    `)
    .run(
      title,
      normalizedDays[0],
      normalizedDays.join(","),
      routineTime,
      category,
      googleCalendarEnabled ? 1 : 0,
      memo,
      userId,
      id
    );
}

function deleteRoutineById(
  userId,
  id
) {
  return db
    .prepare(`
      DELETE FROM routines
      WHERE user_id = ?
        AND id = ?
    `)
    .run(
      userId,
      id
    );
}

function getUnsyncedGoogleRoutines(
  userId
) {
  return db.prepare(`
    SELECT *
    FROM routines
    WHERE user_id = ?
      AND status = 'active'
      AND google_calendar_enabled = 1
      AND google_event_id IS NULL
    ORDER BY
      day_of_week,
      routine_time,
      id
  `).all(userId)
    .map(normalizeRoutineRow);
}

function saveRoutineGoogleEventId(
  userId,
  routineId,
  googleEventId
) {
  return db.prepare(`
    UPDATE routines
    SET google_event_id = ?
    WHERE user_id = ?
      AND id = ?
  `).run(
    googleEventId,
    userId,
    routineId
  );
}

function markTaskNotified(
  userId,
  id
) {
  return db.prepare(`
    UPDATE tasks
    SET notified_at =
      CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND id = ?
  `).run(
    userId,
    id
  );
}

function markEventNotified(
  userId,
  id
) {
  return db.prepare(`
    UPDATE events
    SET notified_at =
      CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND id = ?
  `).run(
    userId,
    id
  );
}

function addEvent(
  userId,
  title,
  description = "",
  eventDate,
  startTime = null,
  endTime = null,
  location = "",
  priority = "normal",
  category = "other",
  notification = "none"
){
  const result = db.prepare(`
    INSERT INTO events (
  user_id,
  title,
  description,
  event_date,
  start_time,
  end_time,
  location,
  priority,
  category,
  notification
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
  userId,
  title,
  description,
  eventDate,
  startTime,
  endTime,
  location,
  priority,
  category,
  notification
);

  return result.lastInsertRowid;
}

function getEventById(
  userId,
  id
) {
  return db.prepare(`
    SELECT *
    FROM events
    WHERE id = ?
      AND user_id = ?
    LIMIT 1
  `).get(
    id,
    userId
  );
}

function updateEventById(
  userId,
  id,
  {
    title,
    description,
    event_date,
    start_time,
    end_time,
    location,
    priority,
    category,
    notification,
    status,
  }
) {
  const result = db.prepare(`
    UPDATE events
    SET
      title = ?,
      description = ?,
      event_date = ?,
      start_time = ?,
      end_time = ?,
      location = ?,
      priority = ?,
      category = ?,
      notification = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    AND user_id = ?
  `).run(
    title,
    description ?? null,
    event_date,
    start_time ?? null,
    end_time ?? null,
    location ?? null,
    priority ?? "normal",
    category ?? "other",
    notification ?? "none",
    status ?? "active",
    id,
    userId
  );

  return result.changes > 0;
}

function deleteEventById(
  userId,
  id
) {
  const result = db.prepare(`
    DELETE FROM events
    WHERE id = ?
      AND user_id = ?
  `).run(
    id,
    userId
  );

  return result.changes > 0;
}

function convertTaskToEvent(
  userId,
  taskId,
  eventData = {}
) {
  const convert = db.transaction(() => {
    const task =
  getTaskById(
    userId,
    taskId
  );

    if (!task) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    const eventDate =
      eventData.eventDate !== undefined
        ? eventData.eventDate
        : task.due_date;

    if (!eventDate) {
      return {
        ok: false,
        reason: "date_required",
      };
    }

    const eventId = addEvent(
      userId,
      eventData.title !== undefined
        ? eventData.title
        : task.title,
      eventData.description !== undefined
        ? eventData.description
        : task.description || "",
      eventDate,
      eventData.startTime !== undefined
        ? eventData.startTime
        : task.due_time,
      eventData.endTime !== undefined
        ? eventData.endTime
        : null,
      eventData.location !== undefined
  ? eventData.location
  : task.location || "",
      eventData.priority !== undefined
  ? eventData.priority
  : task.priority || "normal",

eventData.category !== undefined
  ? eventData.category
  : task.category || "other",

eventData.notification !== undefined
  ? eventData.notification
  : task.notification || "none"
    );

    const deleted =
      deleteTaskById(
  userId,
  taskId
);

    if (!deleted) {
      throw new Error(
        "変換元タスクの削除に失敗しました。"
      );
    }

    return {
      ok: true,
      eventId,
    };
  });

  return convert();
}

function convertEventToTask(
  userId,
  eventId,
  taskData = {}
) {
  const convert = db.transaction(() => {
    const event =
  getEventById(
    userId,
    eventId
  );

    if (!event) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    const dueDate =
      taskData.dueDate !== undefined
        ? taskData.dueDate
        : event.event_date;

    if (!dueDate) {
      return {
        ok: false,
        reason: "date_required",
      };
    }

    const taskId = addTask(
  userId,
  taskData.title !== undefined
    ? taskData.title
    : event.title,
      taskData.description !== undefined
        ? taskData.description
        : event.description || "",
      dueDate,
      taskData.priority !== undefined
  ? taskData.priority
  : event.priority || "normal",

taskData.category !== undefined
  ? taskData.category
  : event.category || "other",

taskData.dueTime !== undefined
  ? taskData.dueTime
  : event.start_time,

taskData.notification !== undefined
  ? taskData.notification
  : event.notification || "none",

"task",

taskData.location !== undefined
  ? taskData.location
  : event.location || ""
);

    const deleted =
      deleteEventById(
  userId,
  eventId
);

    if (!deleted) {
      throw new Error(
        "変換元予定の削除に失敗しました。"
      );
    }

    return {
      ok: true,
      taskId,
    };
  });

  return convert();
}

function getEventsByDate(
  userId,
  date
) {
  return db.prepare(`
    SELECT *
    FROM events
    WHERE user_id = ?
      AND status = 'active'
      AND event_date = ?
    ORDER BY
      CASE
        WHEN start_time IS NULL
          OR start_time = ''
        THEN 1
        ELSE 0
      END,
      start_time ASC,
      id ASC
  `).all(
    userId,
    date
  );
}

function getEventsByDateRange(
  userId,
  startDate,
  endDate
) {
  return db.prepare(`
    SELECT *
    FROM events
    WHERE user_id = ?
      AND status = 'active'
      AND event_date BETWEEN ? AND ?
    ORDER BY
      event_date ASC,
      CASE
        WHEN start_time IS NULL
          OR start_time = ''
        THEN 1
        ELSE 0
      END,
      start_time ASC,
      id ASC
  `).all(
    userId,
    startDate,
    endDate
  );
}

function getActiveEvents(
  userId
) {
  return db.prepare(`
    SELECT *
    FROM events
    WHERE user_id = ?
      AND status = 'active'
    ORDER BY
      event_date ASC,
      CASE
        WHEN start_time IS NULL
          OR start_time = ''
        THEN 1
        ELSE 0
      END,
      start_time ASC,
      id ASC
  `).all(
    userId
  );
}

module.exports = {
  getAllUsers,
  getUserById,
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
  getTasksByDateRange,
  getCompletedTasksByDate,
  getCompletedTasksByDateRange,

  saveIntegrationTokens,
  getIntegrationTokens,
  deleteIntegration,
    saveExternalCalendarEvent,
    getExternalCalendarEventsByDate,
  getExternalCalendarEventsByDateRange,
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
addEvent,
getEventById,
getEventsByDate,
getEventsByDateRange,
updateEventById,
deleteEventById,
getActiveEvents,
  convertTaskToEvent,
  convertEventToTask,
  getEventNotificationTargets,
markEventNotified,
hasDailyNotificationBeenSent,
markDailyNotificationSent,
getNotificationSettings,
updateNotificationSettings,
getUserByAuthIdentity,
createAuthIdentity,
createUserWithAuthIdentity,
};
