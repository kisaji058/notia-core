// Notia Calendar recovery build: restores day/week/month without routine-link changes.
const timeline = document.getElementById("timeline");
const unscheduledList = document.getElementById("unscheduledList");

const calendarTitle = document.getElementById("calendarTitle");

const prevDayButton = document.getElementById("prevDayButton");
const nextDayButton = document.getElementById("nextDayButton");
const datePicker = document.getElementById("datePicker");
const todayButton = document.getElementById("todayButton");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");

const monthView = document.getElementById("monthView");
const weekView = document.getElementById("weekView");
const dayView = document.getElementById("dayView");

const monthGrid = document.getElementById("monthGrid");
const monthWeekdays = document.getElementById("monthWeekdays");
const weekGrid = document.getElementById("weekGrid");
const weekSummary =
  document.getElementById("weekSummary") ||
  document.querySelector(".week-summary");

const viewButtons = document.querySelectorAll(
  "[data-calendar-view]"
);

const addEventButton =
  document.getElementById(
    "addEventButton"
  );

const eventSheetOverlay =
  document.getElementById(
    "eventSheetOverlay"
  );

const eventSheetModal =
  document.getElementById(
    "eventSheetModal"
  );

const eventSheetTitle =
  document.getElementById(
    "eventSheetTitle"
  );

const eventSheetContent =
  document.getElementById(
    "eventSheetContent"
  );

const closeEventSheetButton =
  document.getElementById(
    "closeEventSheetButton"
  );

const todayString = new Date().toLocaleDateString("sv-SE", {
  timeZone: "Asia/Tokyo",
});

let selectedDate = todayString;
let currentView = "day";

const calendarParams =
  new URLSearchParams(
    window.location.search
  );

const requestedDate =
  calendarParams.get("date");

if (
  requestedDate &&
  /^\d{4}-\d{2}-\d{2}$/.test(
    requestedDate
  )
) {
  selectedDate =
    requestedDate;
}

let pendingEventId =
  calendarParams.get("eventId");

function createTimeline() {
  timeline.innerHTML = "";

  for (let hour = 0; hour < 24; hour++) {
    const slot = document.createElement("div");

    slot.className = "time-slot";

    slot.innerHTML = `
      <div class="time-label">
        ${String(hour).padStart(2, "0")}:00
      </div>

      <div
        class="slot-content"
        id="hour-${hour}">
      </div>
    `;

    timeline.appendChild(slot);
  }
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+09:00`);

  date.setDate(date.getDate() + days);

  return date.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
}

function getWeekRange(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  const day = date.getDay();

  const daysFromMonday =
    day === 0
      ? -6
      : 1 - day;

  const startDate = addDays(
    dateString,
    daysFromMonday
  );

  return {
    startDate,
    endDate: addDays(startDate, 6),
  };
}

function getMonthRange(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);

  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(
    year,
    month,
    1
  ).toLocaleDateString("sv-SE");

  const lastDay = new Date(
    year,
    month + 1,
    0
  ).toLocaleDateString("sv-SE");

  const firstDate = new Date(
    `${firstDay}T00:00:00Z`
  );

  const startDate = addDays(
    firstDay,
    -firstDate.getUTCDay()
  );
  const lastDate = new Date(
    `${lastDay}T00:00:00Z`
  );

  const daysUntilSaturday =
    6 - lastDate.getUTCDay();

  return {
    startDate,
    endDate: addDays(
      lastDay,
      daysUntilSaturday
    ),
  };
}

function addMonths(dateString, months) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  const originalDay = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + months);

  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();

  date.setDate(
    Math.min(originalDay, lastDay)
  );

  return date.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
}

function updateViewPanels() {
  monthView.hidden =
    currentView !== "month";

  weekView.hidden =
    currentView !== "week";

  dayView.hidden =
    currentView !== "day";

  document.body.classList.toggle(
    "calendar-month-active",
    currentView === "month"
  );

  for (const button of viewButtons) {
    const isActive =
      button.dataset.calendarView ===
      currentView;

    button.classList.toggle(
      "active",
      isActive
    );

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  }
}

function updateHeader() {
  const date = new Date(
    `${selectedDate}T00:00:00+09:00`
  );

  if (currentView === "month") {
    calendarTitle.textContent =
      date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        timeZone: "Asia/Tokyo",
      });
  } else if (currentView === "week") {
    const { startDate, endDate } =
      getWeekRange(selectedDate);

    const start = new Date(
      `${startDate}T00:00:00+09:00`
    );

    const end = new Date(
      `${endDate}T00:00:00+09:00`
    );

    const startText =
      start.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        timeZone: "Asia/Tokyo",
      });

    const endText =
      end.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        timeZone: "Asia/Tokyo",
      });

    calendarTitle.textContent =
      `${startText} － ${endText}`;
  } else {
    calendarTitle.textContent =
      date.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: "Asia/Tokyo",
      });
  }

  datePicker.value = selectedDate;

  todayButton.style.display =
    selectedDate === todayString
      ? "none"
      : "block";
}

function renderCurrentTimeLine() {
  if (selectedDate !== todayString) {
    return;
  }

  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).formatToParts(now);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return;
  }

  const slot = document.getElementById(`hour-${hour}`);

  if (!slot) {
    return;
  }

  const line = document.createElement("div");

  line.className = "current-time-line";
  line.style.top = `${(minute / 60) * 100}%`;

  const label = document.createElement("span");

  label.className = "current-time-label";
  label.textContent =
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}`;

  line.appendChild(label);
  slot.appendChild(line);
}

function scrollToCurrentTime() {
  if (selectedDate !== todayString) {
    return;
  }

  const now = new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      }
    ).formatToParts(now);

  const hour = Number(
    parts.find(
      (part) =>
        part.type === "hour"
    )?.value
  );

  if (!Number.isInteger(hour)) {
    return;
  }

  const target =
    document.getElementById(
      `hour-${hour}`
    );

  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function getJapanTimeParts(dateTime) {
  if (!dateTime) {
    return null;
  }

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  return {
    hour,
    time:
      `${String(hour).padStart(2, "0")}:` +
      `${String(minute).padStart(2, "0")}`,
  };
}

function getExternalEventDate(event) {
  if (!event.start_datetime) {
    return null;
  }

  if (event.is_all_day === 1) {
    return event.start_datetime.slice(0, 10);
  }

  const date = new Date(event.start_datetime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
}

function normalizeCalendarTime(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 5);
}

function isExternalAllDay(event) {
  return (
    event.is_all_day === 1 ||
    event.is_all_day === true
  );
}

function attachCalendarItemAction(
  item,
  {
    taskId = null,
    eventItem = null,
    externalItem = null,
    routineId = null,
  } = {}
) {
  let activate = null;

  if (taskId !== null) {
    activate = () => {
      NotiaRuntime.navigate(
        `/tasks/${encodeURIComponent(
          taskId
        )}`
      );
    };
  } else if (eventItem?.id !== undefined) {
    activate = () => {
      openEventSheet(eventItem);
    };
  } else if (externalItem) {
    activate = () => {
      openExternalEventSheet(externalItem);
    };
  } else if (routineId !== null) {
    activate = () => {
      window.location.href =
        `/routine-edit.html?id=${encodeURIComponent(
          routineId
        )}`;
    };
  }

  if (!activate) {
    return;
  }

  item.classList.add("clickable");
  item.setAttribute("role", "button");
  item.tabIndex = 0;

  item.addEventListener("click", activate);

  item.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      event.preventDefault();
      activate();
    }
  );
}

function createWeekItem({
  title,
  timeText,
  source,
  taskId,
  eventItem,
  externalItem,
  routineId,
  completed,
  important,
}) {
  const item = document.createElement("div");

  item.className =
    `week-calendar-item ${source}-week-item`;

  if (completed) {
    item.classList.add("completed");
  }

  if (important) {
    item.classList.add(
      "week-calendar-item--important"
    );
  }

  const time = document.createElement("span");

  time.className =
    "week-calendar-item-time";
  time.textContent = timeText;

  const titleElement =
    document.createElement("span");

  titleElement.className =
    "week-calendar-item-title";
  titleElement.textContent = title;

  const titleWrap =
    document.createElement("span");

  titleWrap.className =
    "week-calendar-item-title-wrap";

  const weekIconSources = {
    notia:
      "/images/nav/task-selected.png",
    event:
      "/images/nav/point-selected.png",
    google:
      "/images/nav/point-selected.png",
    routine:
      "/images/nav/routine-icon-concept.png",
  };

  const iconSource =
    weekIconSources[source];

  if (iconSource) {
    const icon =
      document.createElement("img");

    icon.className =
      "week-calendar-item-icon";
    icon.src = iconSource;
    icon.alt = "";
    icon.setAttribute(
      "aria-hidden",
      "true"
    );

    titleWrap.appendChild(icon);
  }

  titleWrap.appendChild(titleElement);

  if (important) {
    const importantLabel =
      document.createElement("span");

    importantLabel.className =
      "week-calendar-item-important";
    importantLabel.textContent = "重要";

    titleWrap.appendChild(importantLabel);
  }

  item.appendChild(time);
  item.appendChild(titleWrap);

  attachCalendarItemAction(item, {
  taskId,
  eventItem,
  externalItem,
  routineId,
});

  return item;
}

function createDayCalendarItem({
  title,
  timeText,
  source,
  taskId,
  eventItem,
  externalItem,
  routineId,
  locationText,
}) {
  const item = document.createElement("div");

  item.className =
    `task-card calendar-entry-card ${source}-event-card`;

  const content = document.createElement("div");
  content.className = "calendar-entry-content";

  const time = document.createElement("strong");
  time.className = "calendar-entry-time";
  time.textContent = timeText;

  const titleElement = document.createElement("div");
  titleElement.className = "calendar-entry-title";
  titleElement.textContent = title;

  content.appendChild(time);
  content.appendChild(titleElement);

  if (locationText) {
    const locationRow = document.createElement("div");
    locationRow.className = "calendar-entry-location";

    locationRow.innerHTML = `
  <span
    class="calendar-entry-location-icon"
    aria-hidden="true"
  >
    <img
      src="/images/notia-pointer.PNG"
      alt=""
    >
  </span>

  <span
    class="calendar-entry-location-text"
  ></span>
`;

    locationRow.querySelector(
      ".calendar-entry-location-text"
    ).textContent = locationText;

    content.appendChild(locationRow);
  }

  item.appendChild(content);

  attachCalendarItemAction(item, {
    taskId,
    eventItem,
    externalItem,
    routineId,
  });

  return item;
}

function getWeekEntries(
  dateString,
  tasks,
  events,
  routines,
  externalEvents
) {
  const entries = [];

  for (const task of tasks) {
    if (task.due_date !== dateString) {
      continue;
    }

    const time =
      normalizeCalendarTime(task.due_time);

    entries.push({
      title: task.title,
      timeText: time || "時間未設定",
      sortTime: time || "99:99",
      source: "notia",
      taskId: task.id,
      taskItem: task,
      completed:
        task.status === "completed",
      important:
        String(
          task.priority || ""
        ).toLowerCase() === "important" ||
        String(
          task.priority || ""
        ).toLowerCase() === "high" ||
        task.is_important === true ||
        task.is_important === 1,
      sourceOrder: 1,
    });
  }

  for (const event of events) {
  if (event.event_date !== dateString) {
    continue;
  }

  const time =
    normalizeCalendarTime(
      event.start_time
    );

  entries.push({
    title: event.title,
    timeText: time || "終日",
    sortTime: time || "00:00",
    source: "event",
    taskId: null,
    eventItem: event,
    endTimeText:
      normalizeCalendarTime(
        event.end_time
      ),
    routineId: null,
    completed: false,
    sourceOrder: 2,
  });
}

  for (const routine of routines) {
    if (
      routine.routine_date !== dateString
    ) {
      continue;
    }

    const time =
      normalizeCalendarTime(
        routine.routine_time
      );

    entries.push({
      title: routine.title,
      timeText: time || "時間未設定",
      sortTime: time || "99:99",
      source: "routine",
      taskId: null,
      routineId: routine.id,
      routineItem: routine,
      completed: false,
      sourceOrder: 3,
    });
  }

  for (const event of externalEvents) {
    if (
      getExternalEventDate(event) !==
      dateString
    ) {
      continue;
    }

    const allDay =
      isExternalAllDay(event);

    const timeParts = allDay
      ? null
      : getJapanTimeParts(
          event.start_datetime
        );

    entries.push({
      title: event.title,
      timeText: allDay
        ? "終日"
        : timeParts?.time || "予定",
      sortTime: allDay
        ? "00:00"
        : timeParts?.time || "99:99",
      source: "google",
      externalItem: event,
      taskId: null,
      completed: false,
      sourceOrder: 2,
    });
  }

  return entries.sort((a, b) => {
    const timeResult =
      a.sortTime.localeCompare(b.sortTime);

    if (timeResult !== 0) {
      return timeResult;
    }

    return a.sourceOrder - b.sourceOrder;
  });
}

function openWeekDate(dateString) {
  selectedDate = dateString;
  currentView = "day";

  updateViewPanels();
  loadCalendar();
}

function renderWeekSummary(
  startDate,
  tasks,
  events,
  routines,
  externalEvents
) {
  if (!weekSummary) {
    return;
  }

  weekSummary.innerHTML = "";

  for (let index = 0; index < 7; index++) {
    const dateString =
      addDays(startDate, index);

    const date = new Date(
      `${dateString}T00:00:00+09:00`
    );

    const entries = getWeekEntries(
      dateString,
      tasks,
      events,
      routines,
      externalEvents
    ).filter(
      (entry) => !entry.completed
    );

    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "week-summary-day";

    if (dateString === todayString) {
      button.classList.add("is-today");
    }

    if (dateString === selectedDate) {
      button.classList.add("is-selected");
    }

    const weekday =
      document.createElement("span");

    weekday.className =
      "week-summary-weekday";
    weekday.textContent =
      date.toLocaleDateString("ja-JP", {
        weekday: "short",
        timeZone: "Asia/Tokyo",
      });

    const dots =
      document.createElement("span");

    dots.className = "week-summary-dots";

    const visibleDotCount =
      Math.min(entries.length, 3);

    for (
      let dotIndex = 0;
      dotIndex < visibleDotCount;
      dotIndex++
    ) {
      const dot =
        document.createElement("span");

      dot.className = "week-summary-dot";
      dots.appendChild(dot);
    }

    if (entries.length > visibleDotCount) {
      const more =
        document.createElement("span");

      more.className = "week-summary-more";
      more.textContent =
        `+${entries.length - visibleDotCount}`;

      dots.appendChild(more);
    }

    button.appendChild(weekday);
    button.appendChild(dots);

    button.addEventListener("click", () => {
      openWeekDate(dateString);
    });

    weekSummary.appendChild(button);
  }
}

function renderWeek(
  tasks,
  events,
  routines,
  externalEvents
) {
  const { startDate } =
    getWeekRange(selectedDate);

  weekGrid.innerHTML = "";

  renderWeekSummary(
    startDate,
    tasks,
    events,
    routines,
    externalEvents
  );

  for (
    let index = 0;
    index < 7;
    index++
  ) {
    const dateString =
      addDays(startDate, index);

    const date = new Date(
      `${dateString}T00:00:00+09:00`
    );

    const row =
      document.createElement("article");

    row.className = "week-day-row";

    if (dateString === todayString) {
      row.classList.add("is-today");
    }

    const dayButton =
      document.createElement("button");

    dayButton.className =
      "week-day-heading";
    dayButton.type = "button";

    const weekday =
      date.toLocaleDateString("ja-JP", {
        weekday: "short",
        timeZone: "Asia/Tokyo",
      });

    const dayNumber =
      date.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
        timeZone: "Asia/Tokyo",
      });

    dayButton.innerHTML = `
      <span class="week-day-weekday">
        ${weekday}
      </span>

      <span class="week-day-date">
        ${dayNumber}
      </span>
    `;

    dayButton.addEventListener(
      "click",
      () => {
        openWeekDate(dateString);
      }
    );

    const contents =
      document.createElement("div");

    contents.className =
      "week-day-contents";

    const entries = getWeekEntries(
      dateString,
      tasks,
      events,
      routines,
      externalEvents
    ).filter(
      (entry) => !entry.completed
    );

    const visibleEntries =
      [...entries]
        .sort((a, b) => {
          return Number(Boolean(a.completed)) -
            Number(Boolean(b.completed));
        })
        .slice(0, 2);

    for (const entry of visibleEntries) {
      contents.appendChild(
        createWeekItem(entry)
      );
    }

    if (entries.length > visibleEntries.length) {
      const more =
        document.createElement("button");

      more.type = "button";
      more.className = "week-day-more";
      more.textContent =
        `ほか${entries.length - visibleEntries.length}件`;

      more.addEventListener("click", () => {
        openWeekDate(dateString);
      });

      contents.appendChild(more);
    }

    if (entries.length === 0) {
      const empty =
        document.createElement("p");

      empty.className = "week-day-empty";
      empty.textContent =
        "予定はありません";

      contents.appendChild(empty);
    }

    row.appendChild(dayButton);
    row.appendChild(contents);

    weekGrid.appendChild(row);
  }
}

function createMonthItem(entry) {
  const item =
    document.createElement(
      entry.taskId ? "button" : "div"
    );

  item.className =
    `month-calendar-item ${entry.source}-month-item`;

  if (item.tagName === "BUTTON") {
  item.type = "button";
}

attachCalendarItemAction(item, {
  taskId: entry.taskId,
  eventItem: entry.eventItem,
  externalItem: entry.externalItem,
  routineId: entry.routineId,
});

  if (entry.completed) {
    item.classList.add("completed");
  }

  if (entry.important) {
    item.classList.add(
      "month-calendar-item--important"
    );
  }

  const title =
  document.createElement("span");

title.className =
  "month-calendar-item-title";
title.textContent = entry.title;

item.appendChild(title);

  return item;
}

function formatMonthDetailDate(
  dateString
) {
  const date = new Date(
    `${dateString}T00:00:00+09:00`
  );

  return date.toLocaleDateString(
    "ja-JP",
    {
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: "Asia/Tokyo",
    }
  );
}

function getMonthDetailTime(entry) {
  if (
    entry.source === "event" &&
    entry.endTimeText
  ) {
    return `${entry.timeText} – ${entry.endTimeText}`;
  }

  if (
    entry.source === "google" &&
    !isExternalAllDay(
      entry.externalItem || {}
    )
  ) {
    const endTime = getJapanTimeParts(
      entry.externalItem?.end_datetime
    )?.time;

    if (endTime) {
      return `${entry.timeText} – ${endTime}`;
    }
  }

  return entry.timeText;
}

function getMonthDetailMeta(entry) {
  if (entry.source === "routine") {
    const days =
      entry.routineItem?.days_of_week ||
      entry.routineItem?.weekdays ||
      entry.routineItem?.days;

    if (Array.isArray(days) && days.length) {
      return `毎週 ${days.join("・")}`;
    }

    return "繰り返しルーティーン";
  }

  if (entry.source === "event") {
    return (
      entry.eventItem?.location ||
      entry.eventItem?.description ||
      "Notiaの予定"
    );
  }

  if (entry.source === "google") {
    return (
      entry.externalItem?.location ||
      "Google予定"
    );
  }

  if (entry.important) {
    return "重要タスク";
  }

  return "Notiaタスク";
}

function getMonthDetailLabel(entry) {
  if (entry.source === "routine") {
    return "ルーティーン";
  }

  if (entry.source === "notia") {
    return entry.important
      ? "重要"
      : "タスク";
  }

  if (entry.source === "google") {
    return "Google";
  }

  return "予定";
}

function createMonthDetailItem(entry) {
  const item =
    document.createElement("article");

  item.className =
    `month-detail-item ${entry.source}-month-detail-item`;

  if (entry.important) {
    item.classList.add(
      "month-detail-item--important"
    );
  }

  const marker =
  document.createElement("span");

marker.className =
  "month-detail-marker";

const markerIconSources = {
  notia:
    "/images/nav/task-selected.png",

  event:
    "/images/nav/point-selected.png",

  google:
    "/images/nav/point-selected.png",

  routine:
    "/images/nav/routine-icon-concept.png",
};

const markerIconSource =
  markerIconSources[entry.source];

if (markerIconSource) {
  const icon =
    document.createElement("img");

  icon.src =
    markerIconSource;

  icon.alt = "";

  icon.setAttribute(
    "aria-hidden",
    "true"
  );

  marker.appendChild(icon);
}

  const body =
    document.createElement("div");

  body.className =
    "month-detail-item-body";

  const time =
    document.createElement("strong");

  time.className =
    "month-detail-item-time";
  time.textContent =
    getMonthDetailTime(entry);

  const title =
    document.createElement("div");

  title.className =
    "month-detail-item-title";
  title.textContent = entry.title;

  const meta =
    document.createElement("div");

  meta.className =
    "month-detail-item-meta";
  meta.textContent =
    getMonthDetailMeta(entry);

  body.appendChild(time);
  body.appendChild(title);
  body.appendChild(meta);

  const label =
    document.createElement("span");

  label.className =
    "month-detail-item-label";
  label.textContent =
    getMonthDetailLabel(entry);

  item.appendChild(marker);
  item.appendChild(body);
  item.appendChild(label);

  attachCalendarItemAction(item, {
    taskId: entry.taskId,
    eventItem: entry.eventItem,
    externalItem: entry.externalItem,
    routineId: entry.routineId,
  });

  return item;
}

function getMonthDetailPanel() {
  let panel =
    document.getElementById(
      "monthDetailPanel"
    );

  if (panel) {
    return panel;
  }

  panel =
    document.createElement("section");
  panel.id = "monthDetailPanel";
  panel.className = "month-detail-panel";

  monthView.appendChild(panel);

  return panel;
}

function renderMonthDetail(entries) {
  const panel = getMonthDetailPanel();
  const visibleEntries = entries.filter(
    (entry) => !entry.completed
  );

  panel.innerHTML = "";

  const header =
    document.createElement("div");
  header.className =
    "month-detail-header";

  const heading =
    document.createElement("h2");
  heading.textContent =
    formatMonthDetailDate(selectedDate);

  const count =
    document.createElement("span");
  count.className =
    "month-detail-count";
  count.textContent =
    `${visibleEntries.length}件`;

  const toggle =
    document.createElement("button");
  toggle.type = "button";
  toggle.className =
    "month-detail-toggle";
  toggle.setAttribute(
    "aria-label",
    "選択日の予定を折りたたむ"
  );
  toggle.setAttribute(
    "aria-expanded",
    "true"
  );
  toggle.textContent = "⌃";

  header.appendChild(heading);
  header.appendChild(count);
  header.appendChild(toggle);

  const content =
    document.createElement("div");
  content.className =
    "month-detail-content";

  const list =
    document.createElement("div");
  list.className =
    "month-detail-list";

  if (visibleEntries.length) {
    for (const entry of visibleEntries) {
      list.appendChild(
        createMonthDetailItem(entry)
      );
    }
  } else {
    const empty =
      document.createElement("p");
    empty.className =
      "month-detail-empty";
    empty.textContent =
      "この日の予定はありません";
    list.appendChild(empty);
  }

  content.appendChild(list);

  toggle.addEventListener(
    "click",
    () => {
      const collapsed =
        panel.classList.toggle(
          "is-collapsed"
        );

      content.hidden = collapsed;
      toggle.textContent =
        collapsed ? "⌄" : "⌃";
      toggle.setAttribute(
        "aria-expanded",
        String(!collapsed)
      );
      toggle.setAttribute(
        "aria-label",
        collapsed
          ? "選択日の予定を展開する"
          : "選択日の予定を折りたたむ"
      );
    }
  );

  panel.appendChild(header);
  panel.appendChild(content);
}

function renderMonth(
  tasks,
  events,
  routines,
  externalEvents
) {
  const weekdays = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土",
  ];

  monthWeekdays.innerHTML = "";
  monthGrid.innerHTML = "";

  for (const weekday of weekdays) {
    const label =
      document.createElement("div");

    label.className =
      "month-weekday-label";
    label.textContent = weekday;

    monthWeekdays.appendChild(label);
  }

  const monthStart =
    `${selectedDate.slice(0, 7)}-01`;

  const startDate = new Date(
    `${monthStart}T00:00:00Z`
  );

  const year =
    startDate.getUTCFullYear();

  const month =
    startDate.getUTCMonth();

  const firstWeekday =
    startDate.getUTCDay();

  const daysInMonth =
    new Date(
      Date.UTC(year, month + 1, 0)
    ).getUTCDate();

  const gridStart = addDays(
    monthStart,
    -firstWeekday
  );

  const totalUsedCells =
    firstWeekday + daysInMonth;

  const cellCount =
    totalUsedCells <= 35 ? 35 : 42;

  for (
    let index = 0;
    index < cellCount;
    index++
  ) {
    const dateString = addDays(
      gridStart,
      index
    );

    const cellDate = new Date(
      `${dateString}T00:00:00Z`
    );

    const day = cellDate.getUTCDate();
    const isCurrentMonth =
      cellDate.getUTCFullYear() === year &&
      cellDate.getUTCMonth() === month;

    const cell =
      document.createElement("article");

    cell.className = "month-day-cell";
    cell.dataset.date = dateString;

    if (!isCurrentMonth) {
      cell.classList.add(
        "is-outside-month"
      );
    }

    if (dateString === todayString) {
      cell.classList.add("is-today");
    }

    if (dateString === selectedDate) {
      cell.classList.add("is-selected");
    }

    const dayButton =
      document.createElement("button");

    dayButton.type = "button";
    dayButton.className =
      "month-day-number";
    dayButton.textContent = String(day);
    dayButton.setAttribute(
      "aria-label",
      formatMonthDetailDate(dateString)
    );
    dayButton.setAttribute(
      "aria-pressed",
      String(dateString === selectedDate)
    );

    dayButton.addEventListener(
  "click",
  () => {
    selectedDate = dateString;
    currentView = "day";

    updateViewPanels();
    loadCalendar();
  }
);

    const contents =
      document.createElement("div");

    contents.className =
      "month-day-contents";

    const entries = getWeekEntries(
      dateString,
      tasks,
      events,
      routines,
      externalEvents
    );

    const visibleEntries =
      entries.filter(
        (entry) => !entry.completed
      );

    for (const entry of
      visibleEntries.slice(0, 2)) {
      contents.appendChild(
        createMonthItem(entry)
      );
    }

    if (visibleEntries.length > 2) {
      const more =
        document.createElement("button");

      more.type = "button";
      more.className =
        "month-day-more";
      more.textContent =
        `ほか${visibleEntries.length - 2}件`;

      more.addEventListener(
        "click",
        () => {
          selectedDate = dateString;

          if (!isCurrentMonth) {
            loadCalendar();
            return;
          }

          updateHeader();
          renderMonth(
            tasks,
            events,
            routines,
            externalEvents
          );
        }
      );

      contents.appendChild(more);
    }

    cell.appendChild(dayButton);
    cell.appendChild(contents);

    monthGrid.appendChild(cell);
  }

  const selectedEntries =
    getWeekEntries(
      selectedDate,
      tasks,
      events,
      routines,
      externalEvents
    );

  renderMonthDetail(selectedEntries);
}

function appendDayItem(
  item,
  time,
  unscheduledText
) {
  const normalizedTime =
    normalizeCalendarTime(time);

  if (!normalizedTime) {
    const timeElement =
      item.querySelector("strong");

    if (timeElement) {
      timeElement.textContent =
        unscheduledText;
    }

    unscheduledList.appendChild(item);
    return;
  }

  const hour = Number(
    normalizedTime.split(":")[0]
  );

  const slot =
    document.getElementById(
      `hour-${hour}`
    );

  if (!slot) {
    return;
  }

  slot.appendChild(item);
}

function addDayItemTypeIcon(
  card,
  type
) {
  const iconSources = {
    task:
      "/images/nav/task-selected.png",
    calendar:
      "/images/nav/point-selected.png",
    routine:
      "/images/nav/routine-icon-concept.png",
  };

  const iconSource =
    iconSources[type];

  if (!card || !iconSource) {
    return;
  }

  const iconWrap =
    document.createElement("span");

  iconWrap.className =
    `day-item-type-icon ` +
    `day-item-type-icon--${type}`;

  iconWrap.setAttribute(
    "aria-hidden",
    "true"
  );

  const icon =
    document.createElement("img");

  icon.src = iconSource;
  icon.alt = "";

  iconWrap.appendChild(icon);

  card.classList.add(
    "day-item-with-type-icon"
  );

  card.prepend(iconWrap);
}

function markImportantDayTask(
  card,
  task
) {
  const priority = String(
    task?.priority || ""
  ).toLowerCase();

  const isImportant =
    priority === "important" ||
    priority === "high" ||
    task?.is_important === true ||
    task?.is_important === 1;

  if (isImportant) {
    card.classList.add(
      "day-item--important"
    );
  }
}

function renderCalendar(
  tasks,
  events,
  routines,
  externalEvents
) {
  createTimeline();
  unscheduledList.innerHTML = "";

  // =====================
// Notiaタスク
// =====================

for (const task of tasks) {
  const dueTime =
    normalizeCalendarTime(
      task.due_time
    );

  if (!dueTime) {
    const item =
  createDayCalendarItem({
    title: task.title,
    timeText: "時間未設定",
    source: "task",
    taskId: task.id,
    locationText:
      task.location || "",
  });

    addDayItemTypeIcon(
      item,
      "task"
    );

    markImportantDayTask(
      item,
      task
    );

    if (
      task.status === "completed"
    ) {
      item.classList.add(
        "completed"
      );
    }

    unscheduledList.appendChild(
      item
    );

    continue;
  }

  const card =
  createDayCalendarItem({
    title: task.title,
    timeText: dueTime,
    source: "task",
    taskId: task.id,
    locationText:
      task.location || "",
  });

  addDayItemTypeIcon(
    card,
    "task"
  );

  markImportantDayTask(
    card,
    task
  );

  if (
    task.status === "completed"
  ) {
    card.classList.add(
      "completed"
    );
  }

  appendDayItem(
    card,
    dueTime,
    "時間未設定"
  );
}

  // =====================
  // Notia予定
  // =====================

  for (const event of events) {
    const startTime =
      normalizeCalendarTime(
        event.start_time
      );

    const card = createDayCalendarItem({
  title: event.title,
  timeText: startTime || "終日",
  source: "notia",
  eventItem: event,
  locationText: event.location || "",
});
    addDayItemTypeIcon(
  card,
  "calendar"
);

    appendDayItem(
      card,
      startTime,
      "終日"
    );
  }

  // =====================
  // ルーティーン
  // =====================

  for (const routine of routines) {
    const routineTime =
      normalizeCalendarTime(
        routine.routine_time
      );

    const card =
      createDayCalendarItem({
        title: routine.title,
        timeText:
          routineTime ||
          "時間未設定",
        source: "routine",
        routineId: routine.id,
      });

    addDayItemTypeIcon(
  card,
  "routine"
);

    appendDayItem(
      card,
      routineTime,
      "時間未設定"
    );
  }

  // =====================
  // Google Calendar予定
  // =====================

  for (const event of externalEvents) {
    if (isExternalAllDay(event)) {
  const item =
    createDayCalendarItem({
      title: event.title,
      timeText: "終日",
      source: "google",
      externalItem: event,
      locationText:
        event.location || "",
    });

  addDayItemTypeIcon(
    item,
    "calendar"
  );

  unscheduledList.appendChild(item);
  continue;
}

    const timeParts =
      getJapanTimeParts(
        event.start_datetime
      );

    if (!timeParts) {
      continue;
    }

    const card = createDayCalendarItem({
  title: event.title,
  timeText: timeParts.time,
  source: "google",
  externalItem: event,
  locationText: event.location || "",
});
    addDayItemTypeIcon(
  card,
  "calendar"
);

    appendDayItem(
      card,
      timeParts.time,
      "予定"
    );
  }

  renderCurrentTimeLine();
}

function escapeEventSheetValue(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function openExternalEventSheet(externalItem) {
  if (
    !eventSheetOverlay ||
    !eventSheetModal ||
    !eventSheetTitle ||
    !eventSheetContent
  ) {
    return;
  }

  const allDay =
    isExternalAllDay(externalItem);

  const startTime = allDay
    ? ""
    : getJapanTimeParts(
        externalItem.start_datetime
      )?.time || "";

  const endTime = allDay
    ? ""
    : getJapanTimeParts(
        externalItem.end_datetime
      )?.time || "";

  eventSheetTitle.textContent =
    "Google予定";

  eventSheetContent.innerHTML = `
    <div class="event-sheet-form">
      <p class="sheet-help-text">
        Googleから同期された予定です。編集はGoogleカレンダーで行ってください。
      </p>

      <label class="sheet-label" for="externalEventTitle">
        タイトル
      </label>
      <input
        id="externalEventTitle"
        class="sheet-input"
        type="text"
        value="${escapeEventSheetValue(
          externalItem.title
        )}"
        readonly
      />

      <label class="sheet-label" for="externalEventDate">
        日付
      </label>
      <input
        id="externalEventDate"
        class="sheet-input"
        type="date"
        value="${escapeEventSheetValue(
          getExternalEventDate(externalItem)
        )}"
        readonly
      />

      <div class="event-time-fields">
        <div>
          <label class="sheet-label" for="externalEventStartTime">
            開始
          </label>
          <input
            id="externalEventStartTime"
            class="sheet-input"
            type="time"
            value="${escapeEventSheetValue(startTime)}"
            readonly
          />
        </div>

        <div>
          <label class="sheet-label" for="externalEventEndTime">
            終了
          </label>
          <input
            id="externalEventEndTime"
            class="sheet-input"
            type="time"
            value="${escapeEventSheetValue(endTime)}"
            readonly
          />
        </div>
      </div>

      ${
        allDay
          ? '<p class="sheet-help-text">終日予定</p>'
          : ""
      }

      <label class="sheet-label" for="externalEventLocation">
        場所
      </label>
      <input
        id="externalEventLocation"
        class="sheet-input"
        type="text"
        value="${escapeEventSheetValue(
          externalItem.location
        )}"
        readonly
      />

      <label class="sheet-label" for="externalEventDescription">
        メモ
      </label>
      <textarea
        id="externalEventDescription"
        class="sheet-input sheet-textarea"
        readonly
      >${escapeEventSheetValue(
        externalItem.description
      )}</textarea>
    </div>
  `;

  eventSheetOverlay.hidden = false;
  eventSheetModal.hidden = false;

  document.body.classList.add(
    "calendar-sheet-open"
  );

  document
    .getElementById("externalEventTitle")
    .focus({
      preventScroll: true,
    });
}

function normalizeEventSheetTime(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, 5);
}

function closeEventSheet() {
  if (
    !eventSheetOverlay ||
    !eventSheetModal ||
    !eventSheetContent
  ) {
    return;
  }

  eventSheetOverlay.hidden = true;
  eventSheetModal.hidden = true;
  eventSheetContent.innerHTML = "";

  document.body.classList.remove(
    "calendar-sheet-open"
  );
}

if (closeEventSheetButton) {
  closeEventSheetButton.addEventListener(
    "click",
    closeEventSheet
  );
}

if (eventSheetOverlay) {
  eventSheetOverlay.addEventListener(
    "click",
    closeEventSheet
  );
}

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      eventSheetModal &&
      !eventSheetModal.hidden
    ) {
      closeEventSheet();
    }
  }
);

function openEventSheet(eventItem = null) {
  if (
    !eventSheetOverlay ||
    !eventSheetModal ||
    !eventSheetTitle ||
    !eventSheetContent
  ) {
    return;
  }

  const isEdit =
    eventItem !== null;

  eventSheetTitle.textContent =
    isEdit
      ? "予定を編集"
      : "予定を追加";

  eventSheetContent.innerHTML = `
    <form
      id="eventForm"
      class="event-sheet-form"
    >

${
  isEdit
    ? `
      <div class="event-type-switch">
        <label class="event-type-option">
          <input
            id="eventTypeTask"
            type="radio"
            name="eventItemType"
            value="task"
          >
          <span>タスク</span>
        </label>

        <label class="event-type-option">
          <input
            id="eventTypeEvent"
            type="radio"
            name="eventItemType"
            value="event"
            checked
          >
          <span>予定</span>
        </label>
      </div>
    `
    : ""
}

      <label
        class="sheet-label"
        for="eventTitle"
      >
        タイトル
      </label>

      <input
        id="eventTitle"
        class="sheet-input"
        type="text"
        value="${escapeEventSheetValue(
          eventItem?.title
        )}"
        placeholder="例：打ち合わせ"
        required
      />

      <label
        class="sheet-label"
        for="eventDate"
      >
        日付
      </label>

      <input
        id="eventDate"
        class="sheet-input"
        type="date"
        value="${escapeEventSheetValue(
          eventItem?.event_date ??
          selectedDate
        )}"
        required
      />

      <div class="event-time-fields">
        <div>
          <label
            class="sheet-label"
            for="eventStartTime"
          >
            開始
          </label>

          <input
            id="eventStartTime"
            class="sheet-input"
            type="time"
            value="${escapeEventSheetValue(
              normalizeEventSheetTime(
                eventItem?.start_time
              )
            )}"
          />
        </div>

        <div>
          <label
            class="sheet-label"
            for="eventEndTime"
          >
            終了
          </label>

          <input
            id="eventEndTime"
            class="sheet-input"
            type="time"
            value="${escapeEventSheetValue(
              normalizeEventSheetTime(
                eventItem?.end_time
              )
            )}"
          />
        </div>
      </div>

      <p class="sheet-help-text">
        時間を空欄にすると終日予定になります。
      </p>

      <section class="event-organize-card">
  <h2 class="event-card-title">
    整理
  </h2>

  <div class="event-organize-list">

    <label class="event-organize-item">
      <svg
        class="event-organize-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M20 13 11 22 2 13V3h10l8 8a1.4 1.4 0 0 1 0 2Z" />
        <circle cx="7" cy="8" r="1.5" />
      </svg>

      <span class="event-organize-label">
        分類
      </span>

      <select
        id="eventCategory"
        class="event-organize-control"
      >
        <option
          value="work"
          ${eventItem?.category === "work" ? "selected" : ""}
        >
          仕事
        </option>

        <option
          value="school"
          ${eventItem?.category === "school" ? "selected" : ""}
        >
          学校
        </option>

        <option
          value="shopping"
          ${eventItem?.category === "shopping" ? "selected" : ""}
        >
          買い物
        </option>

        <option
          value="private"
          ${eventItem?.category === "private" ? "selected" : ""}
        >
          プライベート
        </option>

        <option
          value="other"
          ${
            !eventItem?.category ||
            eventItem?.category === "other"
              ? "selected"
              : ""
          }
        >
          その他
        </option>
      </select>

      <span
        class="event-organize-chevron"
        aria-hidden="true"
      >
        ›
      </span>
    </label>

    <div
      class="event-organize-item event-priority-item"
    >
      <svg
        class="event-organize-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M5 21V4" />
        <path d="M5 5c4-3 7 3 13 0v9c-6 3-9-3-13 0" />
      </svg>

      <span class="event-organize-label">
        優先度
      </span>

      <div
        class="event-priority-switch"
        role="radiogroup"
        aria-label="優先度"
      >
        <label class="event-priority-option">
          <input
            id="eventPriorityNormal"
            type="radio"
            name="eventPriority"
            value="normal"
            ${
              eventItem?.priority !== "important"
                ? "checked"
                : ""
            }
          >
          <span>通常</span>
        </label>

        <label class="event-priority-option">
          <input
            id="eventPriorityImportant"
            type="radio"
            name="eventPriority"
            value="important"
            ${
              eventItem?.priority === "important"
                ? "checked"
                : ""
            }
          >
          <span>重要</span>
        </label>
      </div>
    </div>

    <label class="event-organize-item">
      <svg
        class="event-organize-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>

      <span class="event-organize-label">
        通知
      </span>

      <select
        id="eventNotification"
        class="event-organize-control"
      >
        <option
          value="none"
          ${!eventItem?.notification || eventItem?.notification === "none" ? "selected" : ""}
        >
          通知なし
        </option>

        <option
          value="at_time"
          ${eventItem?.notification === "at_time" ? "selected" : ""}
        >
          予定時刻
        </option>

        <option
          value="10_minutes_before"
          ${eventItem?.notification === "10_minutes_before" ? "selected" : ""}
        >
          10分前
        </option>

        <option
          value="30_minutes_before"
          ${eventItem?.notification === "30_minutes_before" ? "selected" : ""}
        >
          30分前
        </option>

        <option
          value="1_hour_before"
          ${eventItem?.notification === "1_hour_before" ? "selected" : ""}
        >
          1時間前
        </option>

        <option
          value="day_before"
          ${eventItem?.notification === "day_before" ? "selected" : ""}
        >
          前日
        </option>
      </select>

      <span
        class="event-organize-chevron"
        aria-hidden="true"
      >
        ›
      </span>
    </label>

  </div>
</section>

      <label
        class="sheet-label"
        for="eventLocation"
      >
        場所
      </label>

      <input
        id="eventLocation"
        class="sheet-input"
        type="text"
        value="${escapeEventSheetValue(
          eventItem?.location
        )}"
        placeholder="任意"
      />

      <label
        class="sheet-label"
        for="eventDescription"
      >
        メモ
      </label>

      <textarea
        id="eventDescription"
        class="sheet-input sheet-textarea"
        placeholder="任意"
      >${escapeEventSheetValue(
        eventItem?.description
      )}</textarea>

      <p
        id="eventFormMessage"
        class="sheet-form-message"
        aria-live="polite"
      ></p>

      <button
        id="saveEventButton"
        class="sheet-submit-button"
        type="submit"
      >
        ${isEdit ? "保存" : "登録"}
      </button>

      ${
        isEdit
          ? `
            <button
              id="deleteEventButton"
              class="sheet-delete-button"
              type="button"
            >
              予定を削除
            </button>
          `
          : ""
      }
    </form>
  `;

  const eventForm =
    document.getElementById(
      "eventForm"
    );

    const eventStartTime =
  document.getElementById(
    "eventStartTime"
  );

const eventNotification =
  document.getElementById(
    "eventNotification"
  );

function updateEventNotificationOptions() {
  if (
    !eventStartTime ||
    !eventNotification
  ) {
    return;
  }

  const hasStartTime =
    Boolean(
      eventStartTime.value
    );

  const requiresTimeValues = [
    "at_time",
    "10_minutes_before",
    "30_minutes_before",
    "1_hour_before",
  ];

  for (
    const option of eventNotification.options
  ) {
    option.disabled =
      requiresTimeValues.includes(
        option.value
      ) &&
      !hasStartTime;
  }

  if (
    !hasStartTime &&
    requiresTimeValues.includes(
      eventNotification.value
    )
  ) {
    eventNotification.value =
      "none";
  }
}

eventStartTime.addEventListener(
  "change",
  updateEventNotificationOptions
);

updateEventNotificationOptions();

  eventForm.addEventListener(
    "submit",
    (submitEvent) => {
      submitCalendarEvent(
        submitEvent,
        eventItem
      );
    }
  );

  

  if (isEdit) {
    const deleteEventButton =
      document.getElementById(
        "deleteEventButton"
      );

    deleteEventButton.addEventListener(
      "click",
      () => {
        deleteCalendarEvent(
          eventItem
        );
      }
    );
  }

  eventSheetOverlay.hidden = false;
eventSheetModal.hidden = false;

document.body.classList.add(
  "calendar-sheet-open"
);

document
  .getElementById("eventTitle")
  .focus({
    preventScroll: true,
  });
}

if (addEventButton) {
  addEventButton.addEventListener(
    "click",
    () => {
      openEventSheet();
    }
  );
}

async function submitCalendarEvent(
  submitEvent,
  eventItem
) {
  submitEvent.preventDefault();

  const isEdit =
    eventItem !== null;

  const saveButton =
    document.getElementById(
      "saveEventButton"
    );

  const message =
    document.getElementById(
      "eventFormMessage"
    );

  const payload = {
    title:
      document
        .getElementById("eventTitle")
        .value.trim(),

    eventDate:
      document
        .getElementById("eventDate")
        .value,

    startTime:
      document
        .getElementById("eventStartTime")
        .value || null,

    endTime:
      document
        .getElementById("eventEndTime")
        .value || null,

    location:
      document
        .getElementById("eventLocation")
        .value.trim(),

    description:
      document
        .getElementById("eventDescription")
        .value.trim(),
    
    category:
  document
    .getElementById("eventCategory")
    .value,

priority:
  document
    .getElementById(
      "eventPriorityImportant"
    )
    .checked
      ? "important"
      : "normal",

notification:
  document
    .getElementById(
      "eventNotification"
    )
    .value,
  };

  const isConvertingToTask =
  isEdit &&
  document.getElementById(
    "eventTypeTask"
  )?.checked;

  try {
    saveButton.disabled = true;
    saveButton.textContent =
      isEdit
        ? "保存中..."
        : "登録中...";

    message.textContent = "";

    let endpoint;
let method;
let requestBody;

if (isConvertingToTask) {
  endpoint =
    `/api/events/${eventItem.id}/convert-to-task`;

  method = "POST";

  requestBody = {
  title: payload.title,
  description: payload.description,
  eventDate: payload.eventDate,
  startTime: payload.startTime,
  priority: payload.priority,
  category: payload.category,
  notification: payload.notification,
};
} else {
  endpoint =
    isEdit
      ? `/api/events/${eventItem.id}`
      : "/api/events";

  method =
    isEdit
      ? "PUT"
      : "POST";

  requestBody = payload;
}

const response =
  await fetch(
    endpoint,
    {
      method,

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          requestBody
        ),
    }
  );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "予定の保存に失敗しました。"
      );
    }

    closeEventSheet();

if (isConvertingToTask) {
  NotiaRuntime.navigate("/tasks");
  return;
}

await loadCalendar();
  } catch (error) {
    console.error(
      "予定保存エラー:",
      error
    );

    message.textContent =
      error.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent =
      isEdit ? "保存" : "登録";
  }
}

async function deleteCalendarEvent(
  eventItem
) {
  const confirmed =
    window.confirm(
      `「${eventItem.title}」を削除しますか？`
    );

  if (!confirmed) {
    return;
  }

  const deleteButton =
    document.getElementById(
      "deleteEventButton"
    );

  const message =
    document.getElementById(
      "eventFormMessage"
    );

  try {
    deleteButton.disabled = true;
    deleteButton.textContent =
      "削除中...";

    message.textContent = "";

    const response = await fetch(
      `/api/events/${eventItem.id}`,
      {
        method: "DELETE",
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "予定の削除に失敗しました。"
      );
    }

    closeEventSheet();
    await loadCalendar();
  } catch (error) {
    console.error(
      "予定削除エラー:",
      error
    );

    message.textContent =
      error.message;

    deleteButton.disabled = false;
    deleteButton.textContent =
      "予定を削除";
  }
}

async function loadCalendar() {
  try {
    updateHeader();

    let apiUrl;

    if (currentView === "day") {
      apiUrl =
        `/api/calendar?date=` +
        encodeURIComponent(
          selectedDate
        );
    } else {
      const range =
        currentView === "week"
          ? getWeekRange(selectedDate)
          : getMonthRange(selectedDate);

      apiUrl =
        `/api/calendar?startDate=` +
        encodeURIComponent(
          range.startDate
        ) +
        `&endDate=` +
        encodeURIComponent(
          range.endDate
        );
    }

    const res = await fetch(apiUrl);

    if (!res.ok) {
      throw new Error(
        `カレンダー取得失敗: ${res.status}`
      );
    }

    const data = await res.json();

    const tasks =
      data.tasks ?? [];

    const events =
      data.events ?? [];

    const routines =
      data.routines ?? [];

    const externalEvents =
      data.externalEvents ?? [];

    if (currentView === "day") {
  renderCalendar(
    tasks,
    events,
    routines,
    externalEvents
  );

  if (pendingEventId !== null) {
    const targetEvent =
      events.find(
        (event) =>
          String(event.id) ===
          String(pendingEventId)
      );

    if (targetEvent) {
      pendingEventId = null;

      openEventSheet(
        targetEvent
      );
    }
  }

  setTimeout(() => {
    scrollToCurrentTime();
  }, 50);

  return;
}

    if (currentView === "week") {
      renderWeek(
        tasks,
        events,
        routines,
        externalEvents
      );

      return;
    }

    renderMonth(
      tasks,
      events,
      routines,
      externalEvents
    );
  } catch (error) {
    console.error(error);
  }
}

async function syncCalendar() {
  if (!syncButton) {
    return;
  }

  try {
    syncButton.disabled = true;
    syncButton.textContent = "同期中...";

    if (syncStatus) {
      syncStatus.textContent = "";
    }

    const res = await fetch("/api/calendar/sync", {
      method: "POST",
    });

    const result = await res.json();

    if (
      res.status === 403 &&
      result?.code ===
        "SUBSCRIPTION_REQUIRED"
    ) {
      if (syncStatus) {
        syncStatus.textContent = "";
      }

      window.NotiaPaywall?.open({
        reason: "google-sync",
      });

      return;
    }

    if (!res.ok || !result.success) {
      throw new Error(
        result.error ||
        result.message ||
        "Google予定との同期に失敗しました。"
      );
    }

    if (syncStatus) {
      syncStatus.textContent =
        `Google予定 ${result.importedEvents}件更新 / ` +
        `Notiaタスク ${result.exportedTasks}件送信`;
    }

    await loadCalendar();
  } catch (error) {
    console.error("Calendar sync error:", error);

    if (syncStatus) {
      syncStatus.textContent =
        "Google予定との同期に失敗しました。";
    }
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = "↻ 同期";
  }
}

prevDayButton.addEventListener("click", () => {
  if (currentView === "month") {
    selectedDate =
      addMonths(selectedDate, -1);
  } else {
    selectedDate = addDays(
      selectedDate,
      currentView === "week" ? -7 : -1
    );
  }

  loadCalendar();
});

nextDayButton.addEventListener("click", () => {
  if (currentView === "month") {
    selectedDate =
      addMonths(selectedDate, 1);
  } else {
    selectedDate = addDays(
      selectedDate,
      currentView === "week" ? 7 : 1
    );
  }

  loadCalendar();
});

datePicker.addEventListener("change", () => {
  if (!datePicker.value) {
    return;
  }

  selectedDate = datePicker.value;
  loadCalendar();
});

todayButton.addEventListener("click", () => {
  selectedDate = todayString;
  loadCalendar();
});

if (syncButton) {
  syncButton.addEventListener("click", syncCalendar);
}

for (const button of viewButtons) {
  button.addEventListener("click", () => {
    const nextView =
      button.dataset.calendarView;

    if (
      !["month", "week", "day"].includes(
        nextView
      )
    ) {
      return;
    }

    currentView = nextView;

    updateViewPanels();
    loadCalendar();
  });
}

updateViewPanels();
loadCalendar();
