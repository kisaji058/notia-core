const { google } = require("googleapis");

const {
  getIntegrationTokens,
  saveIntegrationTokens,
} = require("../../database");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
],
  });
}

function loadStoredCredentials() {
  const tokens = getIntegrationTokens("google");

  if (!tokens) {
    return false;
  }

  oauth2Client.setCredentials(tokens);

  return true;
}

// アクセストークン更新時にDBへ保存
oauth2Client.on("tokens", (tokens) => {
  try {
    saveIntegrationTokens("google", tokens);
  } catch (error) {
    console.error(
      "Google token save error:",
      error
    );
  }
});

// OAuth認証後にGoogleアカウントのメールアドレスを取得
async function getGoogleAccountEmail() {
  const oauth2 = google.oauth2({
    version: "v2",
    auth: oauth2Client,
  });

  const response = await oauth2.userinfo.get();

  return response.data.email ?? null;
}

function getAuthenticatedCalendar() {
  const isConnected = loadStoredCredentials();

  if (!isConnected) {
    throw new Error(
      "Google Calendarが未接続です。"
    );
  }

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

const GOOGLE_WEEKDAYS = [
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
];

function getNextRoutineDateTime(
  dayOfWeek,
  routineTime
) {
  const normalizedDayOfWeek =
    Number(dayOfWeek);

  if (
    !Number.isInteger(
      normalizedDayOfWeek
    ) ||
    normalizedDayOfWeek < 0 ||
    normalizedDayOfWeek > 6
  ) {
    throw new Error(
      "ルーティーンの曜日が正しくありません。"
    );
  }

  if (
    typeof routineTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(
      routineTime
    )
  ) {
    throw new Error(
      "ルーティーンの時間形式が正しくありません。"
    );
  }

  const [
    hour,
    minute,
  ] = routineTime
    .split(":")
    .map(Number);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      "ルーティーンの時間が正しくありません。"
    );
  }

  const now = new Date();

  const japanNowText =
    now.toLocaleString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
        hour12: false,
      }
    );

  const [
    japanDate,
    japanTime,
  ] = japanNowText.split(" ");

  const [
    year,
    month,
    day,
  ] = japanDate
    .split("-")
    .map(Number);

  const [
    currentHour,
    currentMinute,
  ] = japanTime
    .split(":")
    .slice(0, 2)
    .map(Number);

  const todayInJapan =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  const currentDayOfWeek =
    todayInJapan.getUTCDay();

  let daysUntilRoutine =
    (
      normalizedDayOfWeek -
      currentDayOfWeek +
      7
    ) % 7;

  const routineAlreadyPassedToday =
    daysUntilRoutine === 0 &&
    (
      hour < currentHour ||
      (
        hour === currentHour &&
        minute <= currentMinute
      )
    );

  if (routineAlreadyPassedToday) {
    daysUntilRoutine = 7;
  }

  const targetDate =
    new Date(todayInJapan);

  targetDate.setUTCDate(
    targetDate.getUTCDate() +
      daysUntilRoutine
  );

  const targetYear =
    targetDate.getUTCFullYear();

  const targetMonth =
    String(
      targetDate.getUTCMonth() + 1
    ).padStart(2, "0");

  const targetDay =
    String(
      targetDate.getUTCDate()
    ).padStart(2, "0");

  const dateText =
    `${targetYear}-${targetMonth}-${targetDay}`;

  return new Date(
    `${dateText}T${routineTime}:00+09:00`
  );
}

async function listEvents({
  timeMin = new Date().toISOString(),
  timeMax = null,
  maxResults = 250,
} = {}) {
  const calendar = getAuthenticatedCalendar();

  const params = {
    calendarId: "primary",
    timeMin,
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  };

  if (timeMax) {
    params.timeMax = timeMax;
  }

  const response =
    await calendar.events.list(params);

  return response.data.items ?? [];
}

async function createEventFromTask(task) {
  if (!task) {
    throw new Error(
      "同期するタスクが指定されていません。"
    );
  }

  if (!task.due_date || !task.due_time) {
    throw new Error(
      "日付と時間があるタスクだけ同期できます。"
    );
  }

  const calendar = getAuthenticatedCalendar();

  const startDateTime =
    `${task.due_date}T${task.due_time}:00+09:00`;

  const start = new Date(startDateTime);

  if (Number.isNaN(start.getTime())) {
    throw new Error(
      "タスクの日時形式が正しくありません。"
    );
  }

  const end = new Date(
    start.getTime() + 60 * 60 * 1000
  );

  const response =
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: task.title,
        description:
          task.description || "",
        start: {
          dateTime: start.toISOString(),
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Asia/Tokyo",
        },
        extendedProperties: {
          private: {
            source: "notia",
            notiaTaskId: String(task.id),
          },
        },
      },
    });

  console.log("Google event created:", {
    id: response.data.id,
    summary: response.data.summary,
    start: response.data.start,
    end: response.data.end,
    htmlLink: response.data.htmlLink,
    organizer: response.data.organizer,
  });

  return response.data;
}

async function createRecurringEventFromRoutine(
  routine
) {
  if (!routine) {
    throw new Error(
      "同期するルーティーンが指定されていません。"
    );
  }

  if (!routine.title?.trim()) {
    throw new Error(
      "ルーティーン名が設定されていません。"
    );
  }

  if (!routine.routine_time) {
    throw new Error(
      "時間が設定されているルーティーンのみ同期できます。"
    );
  }

  const weekday =
    GOOGLE_WEEKDAYS[
      Number(
        routine.day_of_week
      )
    ];

  if (!weekday) {
    throw new Error(
      "ルーティーンの曜日が正しくありません。"
    );
  }

  const calendar =
    getAuthenticatedCalendar();

  const start =
    getNextRoutineDateTime(
      routine.day_of_week,
      routine.routine_time
    );

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    throw new Error(
      "ルーティーンの開始日時を作成できませんでした。"
    );
  }

  const end = new Date(
    start.getTime() +
      60 * 60 * 1000
  );

  const response =
    await calendar.events.insert({
      calendarId: "primary",

      requestBody: {
        summary:
          routine.title.trim(),

        start: {
          dateTime:
            start.toISOString(),
          timeZone:
            "Asia/Tokyo",
        },

        end: {
          dateTime:
            end.toISOString(),
          timeZone:
            "Asia/Tokyo",
        },

        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${weekday}`,
        ],

        extendedProperties: {
          private: {
            source: "notia",
            notiaRoutineId:
              String(routine.id),
          },
        },
      },
    });

  console.log(
    "Google recurring event created:",
    {
      id:
        response.data.id,
      summary:
        response.data.summary,
      start:
        response.data.start,
      recurrence:
        response.data.recurrence,
      htmlLink:
        response.data.htmlLink,
    }
  );

  return response.data;
}

function clearGoogleCredentials() {
  oauth2Client.setCredentials({});
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  loadStoredCredentials,
  getGoogleAccountEmail,
  clearGoogleCredentials,
  listEvents,
  createEventFromTask,
  createRecurringEventFromRoutine,
};