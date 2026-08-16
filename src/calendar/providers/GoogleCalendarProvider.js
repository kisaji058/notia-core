const { google } = require("googleapis");

const {
  getIntegrationTokens,
  saveIntegrationTokens,
  deleteIntegration,
} = require("../../../database");

const PROVIDER_NAME = "google";

const GOOGLE_WEEKDAYS = [
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// =====================
// OAuth
// =====================

function getAuthUrl() {
  const oauth2Client =
    createOAuth2Client();

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

function getAuthenticatedClient(userId) {
  if (!userId) {
    throw new Error(
      "GoogleCalendarProvider: userId is required"
    );
  }

  const tokens =
    getIntegrationTokens(
      userId,
      PROVIDER_NAME
    );

  if (!tokens) {
    throw new Error(
      "Google Calendarが未接続です。"
    );
  }

  const oauth2Client =
    createOAuth2Client();

  oauth2Client.setCredentials(tokens);

  oauth2Client.on(
    "tokens",
    (newTokens) => {
      try {
        saveIntegrationTokens(
          userId,
          PROVIDER_NAME,
          newTokens
        );
      } catch (error) {
        console.error(
          "Google token save error:",
          error
        );
      }
    }
  );

  return oauth2Client;
}

async function connect(
  userId,
  code
) {
  if (!userId) {
    throw new Error(
      "GoogleCalendarProvider: userId is required"
    );
  }

  if (!code) {
    throw new Error(
      "Google認証コードが指定されていません。"
    );
  }

  const oauth2Client =
    createOAuth2Client();

  const { tokens } =
    await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  const accountInfo =
    await getAccountInfo(
      oauth2Client
    );

  saveIntegrationTokens(
    userId,
    PROVIDER_NAME,
    tokens,
    accountInfo.email
  );

  return accountInfo;
}

function disconnect(userId) {
  return deleteIntegration(
    userId,
    PROVIDER_NAME
  );
}

// =====================
// Account
// =====================

async function getAccountInfo(
  oauth2Client
) {
  const oauth2 = google.oauth2({
    version: "v2",
    auth: oauth2Client,
  });

  const response =
    await oauth2.userinfo.get();

  return {
    provider: PROVIDER_NAME,
    email:
      response.data.email ?? null,
  };
}

// =====================
// Authentication check
// =====================

function isAuthenticated(userId) {
  return Boolean(
    getIntegrationTokens(
      userId,
      PROVIDER_NAME
    )
  );
}

function getAuthenticatedCalendar(
  userId
) {
  const oauth2Client =
    getAuthenticatedClient(userId);

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

// =====================
// Events
// =====================

async function listEvents(
  userId,
  {
    timeMin = new Date().toISOString(),
    timeMax = null,
    maxResults = 250,
  } = {}
) {
  const calendar =
    getAuthenticatedCalendar(userId);

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
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      routineTime
    )
  ) {
    throw new Error(
      "ルーティーンの時間が正しくありません。"
    );
  }

  const [hour, minute] =
    routineTime
      .split(":")
      .map(Number);

  const japanNowText =
    new Date().toLocaleString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
        hour12: false,
      }
    );

  const [dateText, timeText] =
    japanNowText.split(" ");

  const [year, month, day] =
    dateText
      .split("-")
      .map(Number);

  const [
    currentHour,
    currentMinute,
  ] =
    timeText
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

  const hasPassedToday =
    daysUntilRoutine === 0 &&
    (
      hour < currentHour ||
      (
        hour === currentHour &&
        minute <= currentMinute
      )
    );

  if (hasPassedToday) {
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

  return new Date(
    `${targetYear}-${targetMonth}-${targetDay}` +
    `T${routineTime}:00+09:00`
  );
}

async function createEventFromTask(
  userId,
  task
) {
  if (!task) {
    throw new Error(
      "同期するタスクが指定されていません。"
    );
  }

  if (!task.due_date) {
    throw new Error(
      "日付があるタスクだけ同期できます。"
    );
  }

  const calendar =
    getAuthenticatedCalendar(userId);

  let start;
  let end;

  // =====================
  // 時間あり
  // =====================

  if (task.due_time) {
    const startDateTime =
      `${task.due_date}T${task.due_time}:00+09:00`;

    const startDate =
      new Date(startDateTime);

    if (
      Number.isNaN(
        startDate.getTime()
      )
    ) {
      throw new Error(
        "タスクの日時形式が正しくありません。"
      );
    }

    const endDate =
      new Date(
        startDate.getTime() +
        60 * 60 * 1000
      );

    start = {
      dateTime:
        startDate.toISOString(),
      timeZone: "Asia/Tokyo",
    };

    end = {
      dateTime:
        endDate.toISOString(),
      timeZone: "Asia/Tokyo",
    };
  }

  // =====================
  // 時間なし → 終日予定
  // =====================

  else {
    const endDate =
      new Date(
        `${task.due_date}T00:00:00Z`
      );

    endDate.setUTCDate(
      endDate.getUTCDate() + 1
    );

    const nextDate =
      endDate
        .toISOString()
        .slice(0, 10);

    start = {
      date: task.due_date,
    };

    end = {
      date: nextDate,
    };
  }

  const response =
    await calendar.events.insert({
      calendarId: "primary",

      requestBody: {
        summary: task.title,

        description:
          task.description || "",

        start,

        end,

        extendedProperties: {
          private: {
            source: "notia",
            notiaTaskId:
              String(task.id),
          },
        },
      },
    });

  console.log(
    "Google event created:",
    {
      id: response.data.id,
      summary:
        response.data.summary,
      start:
        response.data.start,
      end:
        response.data.end,
      htmlLink:
        response.data.htmlLink,
      organizer:
        response.data.organizer,
    }
  );

  return response.data;
}

async function createRecurringEventFromRoutine(
  userId,
  routine
) {
  if (!routine) {
    throw new Error(
      "同期するルーティーンが指定されていません。"
    );
  }

  if (
    typeof routine.title !== "string" ||
    !routine.title.trim()
  ) {
    throw new Error(
      "ルーティーン名が設定されていません。"
    );
  }

  if (!routine.routine_time) {
    throw new Error(
      "時間が設定されているルーティーンのみ同期できます。"
    );
  }

  const dayOfWeek =
    Number(routine.day_of_week);

  const weekday =
    GOOGLE_WEEKDAYS[dayOfWeek];

  if (!weekday) {
    throw new Error(
      "ルーティーンの曜日が正しくありません。"
    );
  }

  const calendar =
    getAuthenticatedCalendar(userId);

  const start =
    getNextRoutineDateTime(
      dayOfWeek,
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

  const end =
    new Date(
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
      recurrence:
        response.data.recurrence,
      htmlLink:
        response.data.htmlLink,
    }
  );

  return response.data;
}

async function updateRecurringEventFromRoutine(
  userId,
  routine
) {
  if (!routine.google_event_id) {
    return null;
  }

  const calendar =
    getAuthenticatedCalendar(userId);

  const weekday =
    GOOGLE_WEEKDAYS[
      Number(routine.day_of_week)
    ];

  const start =
    getNextRoutineDateTime(
      routine.day_of_week,
      routine.routine_time
    );

  const end = new Date(
    start.getTime() +
      60 * 60 * 1000
  );

  const response =
    await calendar.events.update({
      calendarId: "primary",

      eventId:
        routine.google_event_id,

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
      },
    });
   

  return response.data;
}

 async function deleteRecurringEvent(
  userId,
  googleEventId
) {
  if (!googleEventId) {
    return;
  }

  const calendar =
    getAuthenticatedCalendar(userId);

  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
  });
}

// =====================
// Event conversion
// =====================

function isNotiaEvent(event) {
  return (
    event
      ?.extendedProperties
      ?.private
      ?.source === "notia"
  );
}

function normalizeEvent(event) {
  if (!event) {
    throw new Error(
      "変換するGoogle予定が指定されていません。"
    );
  }

  return {
    externalEventId: event.id,
    calendarId: "primary",
    title:
      event.summary ?? "無題の予定",
    description:
      event.description ?? null,

    startDateTime:
      event.start?.dateTime ??
      event.start?.date ??
      null,

    endDateTime:
      event.end?.dateTime ??
      event.end?.date ??
      null,

    isAllDay:
      Boolean(event.start?.date),

    location:
      event.location ?? null,

    status:
      event.status ?? null,

    updatedAtExternal:
      event.updated ?? null,
  };
}

module.exports = {
  name: PROVIDER_NAME,

  getAuthUrl,
  connect,
  disconnect,
  isAuthenticated,
  getAccountInfo,

  listEvents,

  createEventFromTask,
  createRecurringEventFromRoutine,
  updateRecurringEventFromRoutine,
  deleteRecurringEvent,

  isNotiaEvent,
  normalizeEvent,
};