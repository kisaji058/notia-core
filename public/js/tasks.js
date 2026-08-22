const taskPageParams =
  new URLSearchParams(
    window.location.search
  );

const requestedFilter =
  taskPageParams.get("filter");

const taskList =
  document.getElementById("taskList");

const planTaskSection =
  document.getElementById(
    "planTaskSection"
  );

const planEventSection =
  document.getElementById(
    "planEventSection"
  );

const planRoutineSection =
  document.getElementById(
    "planRoutineSection"
  );

const planSegmentButtons =
  document.querySelectorAll(
    ".plan-segment-button"
  );

let allTasks = [];
let allEvents = [];
let allRoutines = [];

let currentCreateType = "task";

let recentCompletedTasks = [];

let currentPlanType =
  requestedFilter
    ? "tasks"
    : "all";

let currentFilter =
  requestedFilter === "overdue"
    ? "overdue"
    : "all";

let taskGroupSequence = 0;

const PLAN_PREVIEW_LIMIT = 2;

async function loadTasks() {
  try {
    taskList.innerHTML = `<p class="task-status">読み込み中...</p>`;

    const res = await fetch("/api/tasks");

    if (!res.ok) {
      throw new Error(`タスク取得失敗: ${res.status}`);
    }

    const tasks = await res.json();

    allTasks = tasks;

  } catch (error) {
    console.error(error);

    taskList.innerHTML = `
      <div class="error-state">
        <p>タスクを読み込めませんでした。</p>
        <button type="button" id="retryButton">再読み込み</button>
      </div>
    `;

    document
      .getElementById("retryButton")
      .addEventListener("click", loadTasks);
  }
}

async function loadEvents() {
  try {
    const res = await fetch("/api/events");

    if (!res.ok) {
      throw new Error(
        `予定取得失敗: ${res.status}`
      );
    }

    const events = await res.json();

    allEvents = Array.isArray(events)
      ? events
      : [];
  } catch (error) {
    console.error(
      "予定取得エラー:",
      error
    );

    allEvents = [];
  }
}

async function loadRoutines() {
  try {
    const response =
      await fetch("/api/routines");

    if (!response.ok) {
      throw new Error(
        `ルーティーン取得失敗: ${response.status}`
      );
    }

    const routines =
      await response.json();

    allRoutines =
      Array.isArray(routines)
        ? routines
        : [];
  } catch (error) {
    console.error(
      "ルーティーン取得エラー:",
      error
    );

    allRoutines = [];
  }
}

function isOverdueTask(task) {
  const today =
    new Date().toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  return (
    task.status === "active" &&
    task.due_date &&
    task.due_date < today
  );
}

function getFilteredTasks(tasks) {
  if (currentFilter === "all") {
    return tasks;
  }

  if (currentFilter === "overdue") {
    return tasks.filter(
      isOverdueTask
    );
  }

  if (currentFilter === "important") {
    return tasks.filter((task) => {
      return (
        task.priority === "important" ||
        task.priority === "high"
      );
    });
  }

  return tasks.filter((task) => {
    return (
      task.category === currentFilter
    );
  });
}

function refreshTaskList() {
  const filteredTasks =
    getFilteredTasks(allTasks);

  renderTaskList(filteredTasks);
}

function updatePlanCounts() {
  const activeTasks =
    allTasks.filter(
      (task) =>
        task.status === "active"
    );

  const activeEvents =
  allEvents.filter(
    (event) =>
      event.status === "active" &&
      !isPastPlanEvent(event)
  );

  const taskCount =
    activeTasks.length;

  const eventCount =
    activeEvents.length;

  const routineCount =
    allRoutines.length;


  const planTaskCount =
    document.getElementById(
      "planTaskCount"
    );

  const planTaskSectionCount =
    document.getElementById(
      "planTaskSectionCount"
    );

  const planEventCount =
    document.getElementById(
      "planEventCount"
    );

  const planEventSectionCount =
    document.getElementById(
      "planEventSectionCount"
    );

  const planRoutineCount =
    document.getElementById(
      "planRoutineCount"
    );

  const planRoutineSectionCount =
    document.getElementById(
      "planRoutineSectionCount"
    );


  if (planTaskCount) {
    planTaskCount.textContent =
      taskCount;
  }

  if (planTaskSectionCount) {
    planTaskSectionCount.textContent =
      taskCount;
  }

  if (planEventCount) {
    planEventCount.textContent =
      eventCount;
  }

  if (planEventSectionCount) {
    planEventSectionCount.textContent =
      eventCount;
  }

  if (planRoutineCount) {
    planRoutineCount.textContent =
      routineCount;
  }

  if (planRoutineSectionCount) {
    planRoutineSectionCount.textContent =
      routineCount;
  }
}

async function loadRecentCompletedTasks() {
  try {
    const res =
      await fetch(
        "/api/tasks/completed/recent"
      );

    if (!res.ok) {
      throw new Error(
        `完了済みタスク取得失敗: ${res.status}`
      );
    }

    const tasks =
      await res.json();

    recentCompletedTasks =
      Array.isArray(tasks)
        ? tasks
        : [];
  } catch (error) {
    console.error(
      "完了済みタスク取得エラー:",
      error
    );

    recentCompletedTasks = [];
  }
}

const PLAN_DAY_SHORT_LABELS = [
  "日",
  "月",
  "火",
  "水",
  "木",
  "金",
  "土",
];

function getPlanRoutineDays(
  routine
) {
  const source =
    Array.isArray(
      routine.days_of_week
    )
      ? routine.days_of_week
      : typeof routine.days_of_week ===
        "string"
        ? routine.days_of_week.split(",")
        : [routine.day_of_week];

  return [
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
  ].sort(
    (a, b) => a - b
  );
}

function getPlanRoutineDayLabel(
  routine
) {
  const days =
    getPlanRoutineDays(routine);

  if (days.length === 0) {
    return "曜日未設定";
  }

  if (
    days.length === 5 &&
    days.join(",") ===
      "1,2,3,4,5"
  ) {
    return "平日";
  }

  if (
    days.length === 2 &&
    days.join(",") ===
      "0,6"
  ) {
    return "土日";
  }

  return days
    .map(
      (day) =>
        PLAN_DAY_SHORT_LABELS[day]
    )
    .join("・");
}

function comparePlanRoutines(
  a,
  b
) {
  const firstDayA =
    getPlanRoutineDays(a)[0] ?? 7;

  const firstDayB =
    getPlanRoutineDays(b)[0] ?? 7;

  if (firstDayA !== firstDayB) {
    return firstDayA - firstDayB;
  }

  const timeA =
    a.routine_time || "99:99";

  const timeB =
    b.routine_time || "99:99";

  return timeA.localeCompare(
    timeB
  );
}

function setPlanType(type) {
  currentPlanType = type;

  planSegmentButtons.forEach(
    (button) => {
      const isActive =
        button.dataset.planType ===
        type;

      button.classList.toggle(
        "active",
        isActive
      );

      button.setAttribute(
        "aria-selected",
        String(isActive)
      );
    }
  );

  renderPlanView();
}

function renderPlanView() {
  if (!planTaskSection) {
    return;
  }

  const taskHeading =
    document.getElementById(
      "planTaskSectionButton"
    );

  const eventHeading =
    document.getElementById(
      "planEventSectionButton"
    );

  const routineHeading =
    document.getElementById(
      "planRoutineSectionButton"
    );


  planTaskSection.hidden = true;

  if (planEventSection) {
    planEventSection.hidden = true;
  }

  if (planRoutineSection) {
    planRoutineSection.hidden = true;
  }


  // 初期状態では見出しを隠す

  if (taskHeading) {
    taskHeading.hidden = true;
  }

  if (eventHeading) {
    eventHeading.hidden = true;
  }

  if (routineHeading) {
    routineHeading.hidden = true;
  }


  // =========================
  // すべて
  // =========================

  if (
    currentPlanType === "all"
  ) {
    planTaskSection.hidden = false;

    if (planEventSection) {
      planEventSection.hidden = false;
    }

    if (planRoutineSection) {
      planRoutineSection.hidden = false;
    }

    // 「すべて」だけ見出し表示

    if (taskHeading) {
      taskHeading.hidden = false;
    }

    if (eventHeading) {
      eventHeading.hidden = false;
    }

    if (routineHeading) {
      routineHeading.hidden = false;
    }

    renderTaskPreview();
    renderEventPreview();
    renderRoutinePreview();

    return;
  }


  // =========================
  // タスク
  // =========================

  if (
    currentPlanType === "tasks"
  ) {
    planTaskSection.hidden = false;

    refreshTaskList();

    return;
  }


  // =========================
  // 予定
  // =========================

  if (
    currentPlanType === "events"
  ) {
    if (planEventSection) {
      planEventSection.hidden = false;
    }

    renderEventList();

    return;
  }


  // =========================
  // ルーティーン
  // =========================

  if (
    currentPlanType ===
    "routines"
  ) {
    if (planRoutineSection) {
      planRoutineSection.hidden = false;
    }

    renderRoutineList();

    return;
  }
}

function renderEventList() {
  const eventList =
    document.getElementById(
      "eventList"
    );

  if (!eventList) {
    return;
  }

  eventList.innerHTML = "";

  const events =
    allEvents
      .filter(
        (event) =>
          event.status ===
            "active" &&
          !isPastPlanEvent(
            event
          )
      )
      .sort(
        comparePlanEvents
      );

  if (events.length === 0) {
    eventList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">
          予定はありません。
        </p>
      </div>
    `;

    return;
  }

  const groups =
    new Map();

  events.forEach(
    (event) => {
      const key =
        getPlanEventMonthKey(
          event
        );

      if (!groups.has(key)) {
        groups.set(
          key,
          []
        );
      }

      groups
        .get(key)
        .push(event);
    }
  );

  [...groups.keys()]
    .sort()
    .forEach(
      (key) => {
        const items =
          groups.get(key);

        const list =
          createPlanGroup(
            eventList,
            formatPlanEventMonthLabel(
              key
            ),
            items.length,
            {
              iconType:
                "calendar",
            }
          );

        items.forEach(
          (event) => {
            renderPlanEventCard(
              event,
              list
            );
          }
        );
      }
    );
}

function renderRoutineList() {
  const routineList =
    document.getElementById(
      "routineList"
    );

  if (!routineList) {
    return;
  }

  routineList.innerHTML = "";

  const routines =
    [...allRoutines].sort(
      comparePlanRoutines
    );

  if (routines.length === 0) {
    routineList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">
          ルーティーンはありません。
        </p>
      </div>
    `;

    return;
  }

  PLAN_ROUTINE_GROUPS.forEach(
    ({ day, label }) => {
      const items =
        routines.filter(
          (routine) =>
            getPlanRoutineDays(
              routine
            ).includes(day)
        );

      if (
        items.length === 0
      ) {
        return;
      }

      const list =
        createPlanGroup(
          routineList,
          label,
          items.length,
          {
            iconType:
              "repeat",
          }
        );

      items.forEach(
        (routine) => {
          renderPlanRoutineCard(
            routine,
            list
          );
        }
      );
    }
  );

  const noDayRoutines =
    routines.filter(
      (routine) =>
        getPlanRoutineDays(
          routine
        ).length === 0
    );

  if (
    noDayRoutines.length > 0
  ) {
    const list =
      createPlanGroup(
        routineList,
        "曜日未設定",
        noDayRoutines.length,
        {
          iconType:
            "repeat",
        }
      );

    noDayRoutines.forEach(
      (routine) => {
        renderPlanRoutineCard(
          routine,
          list
        );
      }
    );
  }
}

function renderTaskPreview() {
  taskList.innerHTML = "";

  const activeTasks =
    allTasks.filter(
      (task) =>
        task.status === "active"
    );

  if (activeTasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">
          タスクはありません。
        </p>
      </div>
    `;

    return;
  }

  const previewTasks =
    [...activeTasks]
      .sort(comparePlanPreviewTasks)
      .slice(
        0,
        PLAN_PREVIEW_LIMIT
      );

  previewTasks.forEach(
    (task) => {
      renderTaskCard(
  task,
  taskList,
  {
    showComplete: true,
    showDelete: false,
    showChevron: true,
  }
);
    }
  );
}

function comparePlanPreviewTasks(
  a,
  b
) {
  const dateA =
    a.due_date || "9999-12-31";

  const dateB =
    b.due_date || "9999-12-31";

  if (dateA !== dateB) {
    return dateA.localeCompare(
      dateB
    );
  }

  const timeA =
    a.due_time || "99:99";

  const timeB =
    b.due_time || "99:99";

  return timeA.localeCompare(
    timeB
  );
}

function renderPlanRoutineCard(
  routine,
  container
) {
  const dayLabel =
    getPlanRoutineDayLabel(
      routine
    );

  const timeText =
    routine.routine_time
      ? String(
          routine.routine_time
        ).slice(0, 5)
      : "時間未設定";

  const categoryLabel =
    typeof getCategoryLabel ===
    "function"
      ? getCategoryLabel(
          routine.category
        )
      : "その他";

  const card =
  createRoutineCard(
    routine,
    {
      variant: "plan",

      dayLabel,
      categoryLabel,
      timeText,

      onClick: () => {
          location.href =
            `/routine-edit.html?id=${encodeURIComponent(
              routine.id
            )}`;
        },
      }
    );

  card.setAttribute(
    "role",
    "button"
  );

  card.setAttribute(
    "tabindex",
    "0"
  );

  card.setAttribute(
    "aria-label",
    `${routine.title}を編集`
  );

  card.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        location.href =
          `/routine-edit.html?id=${encodeURIComponent(
            routine.id
          )}`;
      }
    }
  );

  container.appendChild(card);
}

function renderRoutinePreview() {
  const routineList =
    document.getElementById(
      "routineList"
    );

  if (!routineList) {
    return;
  }

  routineList.innerHTML = "";

  const routines =
    [...allRoutines]
      .sort(comparePlanRoutines);

  if (routines.length === 0) {
    routineList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">
          ルーティーンはありません。
        </p>
      </div>
    `;

    return;
  }

  routines
    .slice(
      0,
      PLAN_PREVIEW_LIMIT
    )
    .forEach(
      (routine) => {
        renderPlanRoutineCard(
          routine,
          routineList
        );
      }
    );
}

function isPastPlanEvent(event) {
  if (!event?.event_date) {
    return false;
  }

  const now = new Date();

  const today =
    now.toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  // 昨日以前
  if (event.event_date < today) {
    return true;
  }

  // 明日以降
  if (event.event_date > today) {
    return false;
  }

  // 今日の終日予定は残す
  if (
    !event.start_time &&
    !event.end_time
  ) {
    return false;
  }

  const currentTime =
    now.toLocaleTimeString(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );

  const comparisonTime =
    event.end_time ||
    event.start_time;

  if (!comparisonTime) {
    return false;
  }

  return (
    String(comparisonTime)
      .slice(0, 5) <
    currentTime
  );
}

function formatPlanEventDate(event) {
  if (!event?.event_date) {
    return "日付未設定";
  }

  const date = new Date(
    `${event.event_date}T00:00:00+09:00`
  );

  return date.toLocaleDateString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }
  );
}

function formatPlanEventTime(event) {
  const startTime =
    event.start_time
      ? String(event.start_time).slice(0, 5)
      : "";

  const endTime =
    event.end_time
      ? String(event.end_time).slice(0, 5)
      : "";

  if (startTime && endTime) {
    return `${startTime}〜${endTime}`;
  }

  if (startTime) {
    return startTime;
  }

  return "時間未設定";
}

let planGroupSequence = 0;

function createPlanGroup(
  container,
  title,
  count,
  options = {}
) {
  planGroupSequence += 1;

  const {
    iconType = "calendar",
  } = options;

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "plan-item-group";

  const button =
    document.createElement(
      "button"
    );

  button.type = "button";

  button.className =
    "plan-item-group-heading";

  const listId =
    `plan-group-${planGroupSequence}`;

  button.setAttribute(
    "aria-expanded",
    "true"
  );

  button.setAttribute(
    "aria-controls",
    listId
  );


  // アイコン

  const icon =
    document.createElement(
      "span"
    );

  icon.className =
    `plan-item-group-icon plan-item-group-icon--${iconType}`;

  if (iconType === "calendar") {
    icon.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="5"
          width="16"
          height="15"
          rx="2"
        ></rect>

        <path
          d="M8 3v4M16 3v4M4 9h16"
        ></path>
      </svg>
    `;
  }

  if (iconType === "repeat") {
  icon.innerHTML = `
    <img
      src="/images/nav/routine-icon-concept.png"
      alt=""
      class="plan-item-group-icon-image"
      aria-hidden="true"
    >
  `;
}


  const titleElement =
    document.createElement(
      "span"
    );

  titleElement.className =
    "plan-item-group-title";

  titleElement.textContent =
    title;


  const countElement =
    document.createElement(
      "span"
    );

  countElement.className =
    "plan-item-group-count";

  countElement.textContent =
    `${count}件`;


  const chevron =
    document.createElement(
      "span"
    );

  chevron.className =
    "plan-item-group-chevron";

  chevron.setAttribute(
    "aria-hidden",
    "true"
  );

  chevron.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path
        d="M6 9l6 6 6-6"
      ></path>
    </svg>
  `;


  const list =
    document.createElement(
      "div"
    );

  list.id = listId;

  list.className =
    "plan-item-group-list";


  button.appendChild(icon);
  button.appendChild(
    titleElement
  );

  button.appendChild(
    countElement
  );

  button.appendChild(
    chevron
  );


  section.appendChild(button);
  section.appendChild(list);

  container.appendChild(
    section
  );


  button.addEventListener(
    "click",
    () => {
      const expanded =
        button.getAttribute(
          "aria-expanded"
        ) === "true";

      button.setAttribute(
        "aria-expanded",
        String(!expanded)
      );

      list.hidden =
        expanded;

      section.classList.toggle(
        "is-collapsed",
        expanded
      );
    }
  );

  return list;
}

function getPlanEventMonthKey(
  event
) {
  if (!event?.event_date) {
    return "unscheduled";
  }

  return String(
    event.event_date
  ).slice(0, 7);
}

function formatPlanEventMonthLabel(
  key
) {
  if (key === "unscheduled") {
    return "日付未設定";
  }

  const [
    year,
    month,
  ] = key.split("-");

  const currentYear =
    new Date()
      .toLocaleDateString(
        "sv-SE",
        {
          timeZone:
            "Asia/Tokyo",
        }
      )
      .slice(0, 4);

  if (year === currentYear) {
    return `${Number(month)}月`;
  }

  return `${year}年${Number(
    month
  )}月`;
}

const PLAN_ROUTINE_GROUPS = [
  {
    day: 0,
    label: "日曜日",
  },
  {
    day: 1,
    label: "月曜日",
  },
  {
    day: 2,
    label: "火曜日",
  },
  {
    day: 3,
    label: "水曜日",
  },
  {
    day: 4,
    label: "木曜日",
  },
  {
    day: 5,
    label: "金曜日",
  },
  {
    day: 6,
    label: "土曜日",
  },
];

function comparePlanEvents(a, b) {
  const dateA =
    a.event_date || "9999-12-31";

  const dateB =
    b.event_date || "9999-12-31";

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  const timeA =
    a.start_time || "99:99";

  const timeB =
    b.start_time || "99:99";

  return timeA.localeCompare(timeB);
}

function renderPlanEventCard(
  event,
  container
) {
  const card =
    document.createElement("article");

  card.className =
    "plan-event-card";

  const dateText =
    formatPlanEventDate(event);

  const timeText =
    formatPlanEventTime(event);

  card.innerHTML = `
    <div
      class="plan-event-info"
      role="button"
      tabindex="0"
    >
      <div class="plan-event-title">
        ${escapeCardHtml(event.title)}
      </div>

      <div class="plan-event-meta">
        <span class="plan-event-date">
          ${escapeCardHtml(dateText)}
        </span>

        <span class="plan-event-time">
          ${escapeCardHtml(timeText)}
        </span>
      </div>
    </div>

    <span
      class="plan-event-chevron"
      aria-hidden="true"
    >
      ›
    </span>
  `;

  const openEvent = () => {
  openPlanEventEditSheet(event);
};

  const info =
    card.querySelector(
      ".plan-event-info"
    );

  info.addEventListener(
    "click",
    openEvent
  );

  info.addEventListener(
    "keydown",
    (keyboardEvent) => {
      if (
        keyboardEvent.key === "Enter" ||
        keyboardEvent.key === " "
      ) {
        keyboardEvent.preventDefault();
        openEvent();
      }
    }
  );

  container.appendChild(card);
}

function renderEventPreview() {
  const eventList =
    document.getElementById(
      "eventList"
    );

  if (!eventList) {
    return;
  }

  eventList.innerHTML = "";

  const activeEvents =
  allEvents
    .filter(
      (event) =>
        event.status === "active" &&
        !isPastPlanEvent(event)
    )
    .sort(comparePlanEvents);

  if (activeEvents.length === 0) {
    eventList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">
          予定はありません。
        </p>
      </div>
    `;

    return;
  }

  activeEvents
    .slice(0, PLAN_PREVIEW_LIMIT)
    .forEach((event) => {
      renderPlanEventCard(
        event,
        eventList
      );
    });
}

function renderTaskCard(
  task,
  container = taskList,
  options = {}
) {
  const {
  showComplete = true,
  showDelete = false,
  showChevron = true,
} = options;
  const isImportant =
    task.priority === "important" ||
    task.priority === "high";

  const isOverdue =
    isOverdueTask(task);

  const card = createTaskCard(task, {
    priorityIcon: isImportant
      ? "●"
      : "",

    dueDateText: isOverdue
      ? formatTaskSectionDate(
          task.due_date
        )
      : "",

    timeText: task.due_time
      ? String(task.due_time).slice(0, 5)
      : "",

    categoryText:
      getCategoryLabel(
        task.category
      ),

    overdueDate: isOverdue,
    showComplete,
showDelete,
showChevron,
  });

  if (isImportant) {
    card.classList.add(
      "task-card--important"
    );
  }

  const taskInfo =
    card.querySelector(".task-info");

  const completeButton =
    card.querySelector(
      ".complete-button"
    );

  const deleteButton =
    card.querySelector(
      ".delete-button"
    );

  taskInfo.addEventListener(
    "click",
    () => {
      NotiaRuntime.navigate(
        `/tasks/${task.id}`
      );
    }
  );

  taskInfo.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        NotiaRuntime.navigate(
          `/tasks/${task.id}`
        );
      }
    }
  );

  if (completeButton) {
  completeButton.addEventListener(
    "click",
    async () => {
      await completeTask(
        task.id,
        completeButton
      );
    }
  );
}

if (deleteButton) {
  deleteButton.addEventListener(
    "click",
    async () => {
      await deleteTask(
        task,
        deleteButton
      );
    }
  );
}

  container.appendChild(card);
}

function getTodayDateString() {
  return new Date().toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );
}

function formatTaskSectionDate(dateString) {
  const date = new Date(
    `${dateString}T00:00:00+09:00`
  );

  return date.toLocaleDateString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }
  );
}

function getTaskGroupIcon(iconType) {
  const icons = {
    overdue: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7.5v6"></path>
        <circle
          cx="12"
          cy="17"
          r="0.9"
          class="task-group-icon-dot"
        ></circle>
      </svg>
    `,

    today: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M14.8 9.2l-1.9 3.7-3.7 1.9 1.9-3.7z"></path>
      </svg>
    `,

    calendar: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="4"
          y="5"
          width="16"
          height="15"
          rx="2"
        ></rect>
        <path d="M8 3v4M16 3v4M4 9h16"></path>
      </svg>
    `,

    unscheduled: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="12" r="1"></circle>
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="18" cy="12" r="1"></circle>
      </svg>
    `,
  };

  return icons[iconType] || icons.calendar;
}

function createTaskGroup(
  title,
  tasks,
  options = {}
) {
  if (tasks.length === 0) {
    return;
  }

  taskGroupSequence += 1;

  const section =
    document.createElement("section");

  section.className =
    "task-date-group";

  if (options.overdue) {
    section.classList.add(
      "task-date-group--overdue"
    );
  }

  const header =
    document.createElement("div");

  header.className =
    "task-date-group-header";

  const toggleButton =
    document.createElement("button");

  toggleButton.type = "button";
  toggleButton.className =
    "task-date-group-toggle";

  const cardsId =
    `task-group-${taskGroupSequence}`;

  toggleButton.setAttribute(
    "aria-expanded",
    "true"
  );

  toggleButton.setAttribute(
    "aria-controls",
    cardsId
  );

  const iconType =
    options.iconType || "calendar";

  const icon =
    document.createElement("span");

  icon.className =
    `task-date-group-icon task-date-group-icon--${iconType}`;

  icon.innerHTML =
    getTaskGroupIcon(iconType);

  const heading =
    document.createElement("span");

  heading.className =
    "task-date-group-title";

  heading.textContent = title;

  const count =
    document.createElement("span");

  count.className =
    "task-date-group-count";

  count.textContent =
    `${tasks.length}件`;

  const chevron =
    document.createElement("span");

  chevron.className =
    "task-date-group-chevron";

  chevron.setAttribute(
    "aria-hidden",
    "true"
  );

  chevron.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M6 9l6 6 6-6"></path>
    </svg>
  `;

  const cards =
    document.createElement("div");

  cards.id = cardsId;
  cards.className =
    "task-date-group-list";

  toggleButton.appendChild(icon);
  toggleButton.appendChild(heading);
  toggleButton.appendChild(count);
  toggleButton.appendChild(chevron);

  header.appendChild(toggleButton);

  section.appendChild(header);
  section.appendChild(cards);

  taskList.appendChild(section);

  const sortedTasks = [...tasks].sort(
  (taskA, taskB) => {
    const timeA = taskA.due_time;
    const timeB = taskB.due_time;

    if (!timeA && !timeB) {
      return 0;
    }

    if (!timeA) {
      return 1;
    }

    if (!timeB) {
      return -1;
    }

    return timeA.localeCompare(timeB);
  }
);

sortedTasks.forEach((task) => {
  renderTaskCard(task, cards);
});

  toggleButton.addEventListener(
    "click",
    () => {
      const isExpanded =
        toggleButton.getAttribute(
          "aria-expanded"
        ) === "true";

      toggleButton.setAttribute(
        "aria-expanded",
        String(!isExpanded)
      );

      cards.hidden = isExpanded;

      section.classList.toggle(
        "task-date-group--collapsed",
        isExpanded
      );
    }
  );
}

function renderTaskList(tasks) {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">
          未完了タスクはありません。
        </p>

        <p class="empty-message">
          チャットで話しかけると、
          Notiaがタスクを登録します。
        </p>
      </div>
    `;

    return;
  }

  const today = getTodayDateString();

  const overdueTasks = [];
  const todayTasks = [];
  const futureTaskGroups = new Map();
  const unscheduledTasks = [];

  tasks.forEach((task) => {
    if (!task.due_date) {
      unscheduledTasks.push(task);
      return;
    }

    if (task.due_date < today) {
      overdueTasks.push(task);
      return;
    }

    if (task.due_date === today) {
      todayTasks.push(task);
      return;
    }

    if (
      !futureTaskGroups.has(
        task.due_date
      )
    ) {
      futureTaskGroups.set(
        task.due_date,
        []
      );
    }

    futureTaskGroups
      .get(task.due_date)
      .push(task);
  });

  createTaskGroup(
  "期限超過",
  overdueTasks,
  {
    overdue: true,
    iconType: "overdue",
  }
);

createTaskGroup(
  "今日",
  todayTasks,
  {
    iconType: "today",
  }
);

  const futureDates = [
    ...futureTaskGroups.keys(),
  ].sort();

  futureDates.forEach((dateString) => {
    createTaskGroup(
      formatTaskSectionDate(dateString),
      futureTaskGroups.get(dateString)
    );
  });

  createTaskGroup(
  "期限未設定",
  unscheduledTasks,
  {
    iconType: "unscheduled",
  }
);

createCompletedTaskHistoryGroup();
}

async function completeTask(
  taskId,
  button
) {
  try {
    button.disabled = true;

    const res =
      await fetch(
        `/api/tasks/${taskId}/complete`,
        {
          method: "POST",
        }
      );

    if (!res.ok) {
      throw new Error(
        `タスク完了失敗: ${res.status}`
      );
    }

    await loadTasks();

    updatePlanCounts();

    renderPlanView();

  } catch (error) {
    console.error(error);

    button.disabled = false;

    alert(
      "タスクを完了できませんでした。"
    );
  }
}

async function deleteTask(task, button) {
  const confirmed = confirm(`「${task.title}」を削除しますか？`);

  if (!confirmed) {
    return;
  }

  try {
    button.disabled = true;

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(`タスク削除失敗: ${res.status}`);
    }

    await loadTasks();

updatePlanCounts();

renderPlanView();
  } catch (error) {
    console.error(error);
    button.disabled = false;
    alert("タスクを削除できませんでした。");
  }
}

async function loadTaskPage() {
  await Promise.all([
  loadTasks(),
  loadEvents(),
  loadRoutines(),
  loadRecentCompletedTasks(),
]);

  updatePlanCounts();
  setPlanType(currentPlanType);
}

loadTaskPage();

planSegmentButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        setPlanType(
          button.dataset.planType
        );
      }
    );
  }
);

const addTaskButton =
  document.getElementById(
    "addTaskButton"
  );

const sheetOverlay =
  document.getElementById("sheetOverlay");

const sheetModal =
  document.getElementById("sheetModal");

const sheetTitle =
  document.getElementById("sheetTitle");

const sheetContent =
  document.getElementById("sheetContent");

const closeSheetButton =
  document.getElementById("closeSheetButton");

function openSheet(title, html) {
  sheetTitle.textContent = title;
  sheetContent.innerHTML = html;

  sheetOverlay.hidden = false;
  sheetModal.hidden = false;

  sheetModal.scrollTop = 0;
  sheetContent.scrollTop = 0;
}

function createCompletedTaskHistoryGroup() {
  if (
    recentCompletedTasks.length === 0
  ) {
    return;
  }

  taskGroupSequence += 1;

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "task-date-group task-history-group";

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "task-date-group-header";

  const toggleButton =
    document.createElement(
      "button"
    );

  toggleButton.type = "button";

  toggleButton.className =
    "task-date-group-toggle";

  const cardsId =
    `task-history-${taskGroupSequence}`;

  toggleButton.setAttribute(
    "aria-expanded",
    "false"
  );

  toggleButton.setAttribute(
    "aria-controls",
    cardsId
  );

  const icon =
    document.createElement(
      "span"
    );

  icon.className =
    "task-date-group-icon";

  icon.innerHTML = `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M3 12a9 9 0 1 0 3-6.7"
      ></path>

      <path
        d="M3 4v5h5"
      ></path>

      <path
        d="M12 7v5l3 2"
      ></path>
    </svg>
  `;

  const heading =
    document.createElement(
      "span"
    );

  heading.className =
    "task-date-group-title";

  heading.textContent =
    "過去のタスク";

  const count =
    document.createElement(
      "span"
    );

  count.className =
    "task-date-group-count";

  count.textContent =
    `${recentCompletedTasks.length}件`;

  const chevron =
    document.createElement(
      "span"
    );

  chevron.className =
    "task-date-group-chevron";

  chevron.setAttribute(
    "aria-hidden",
    "true"
  );

  chevron.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path
        d="M6 9l6 6 6-6"
      ></path>
    </svg>
  `;

  const cards =
    document.createElement(
      "div"
    );

  cards.id = cardsId;

  cards.className =
    "task-date-group-list";

  cards.hidden = true;

  toggleButton.appendChild(icon);
  toggleButton.appendChild(heading);
  toggleButton.appendChild(count);
  toggleButton.appendChild(chevron);

  header.appendChild(
    toggleButton
  );

  section.appendChild(header);
  section.appendChild(cards);

  taskList.appendChild(section);

  recentCompletedTasks.forEach(
    (task) => {
      const card =
        createTaskCard(
          task,
          {
            variant:
              "completed",

            priorityIcon:
              task.priority ===
                "important" ||
              task.priority ===
                "high"
                ? "●"
                : "",

            dueDateText:
              task.due_date
                ? formatTaskSectionDate(
                    task.due_date
                  )
                : "期限未設定",

            categoryText:
              getCategoryLabel(
                task.category
              ),
          }
        );

      const restoreButton =
        card.querySelector(
          ".restore-button"
        );

      if (restoreButton) {
        restoreButton.addEventListener(
          "click",
          async () => {
            await restorePastTask(
              task.id,
              restoreButton
            );
          }
        );
      }

      cards.appendChild(card);
    }
  );

  toggleButton.addEventListener(
    "click",
    () => {
      const expanded =
        toggleButton.getAttribute(
          "aria-expanded"
        ) === "true";

      toggleButton.setAttribute(
        "aria-expanded",
        String(!expanded)
      );

      cards.hidden =
        expanded;

      section.classList.toggle(
        "task-date-group--collapsed",
        expanded
      );
    }
  );
}

async function restorePastTask(
  taskId,
  button
) {
  try {
    button.disabled = true;

    const res =
      await fetch(
        `/api/tasks/${taskId}/restore`,
        {
          method: "POST",
        }
      );

    if (!res.ok) {
      throw new Error(
        `タスク復元失敗: ${res.status}`
      );
    }

    await Promise.all([
      loadTasks(),
      loadRecentCompletedTasks(),
    ]);

    updatePlanCounts();
    renderPlanView();
  } catch (error) {
    console.error(error);

    button.disabled = false;

    alert(
      "タスクを復元できませんでした。"
    );
  }
}


function closeSheet() {
  sheetOverlay.hidden = true;
  sheetModal.hidden = true;
}

function renderTaskCreateForm() {
  return `
    <form
      id="addTaskForm"
      class="task-create-form"
    >
      <label
        class="task-create-label"
        for="newTaskTitle"
      >
        タイトル
      </label>

      <input
        id="newTaskTitle"
        class="task-create-input"
        name="title"
        type="text"
        maxlength="100"
        placeholder="例：書類提出"
        autocomplete="off"
        required
      >

      <label
        class="task-create-label"
        for="newTaskDueDate"
      >
        期限
      </label>

      <input
        id="newTaskDueDate"
        class="task-create-input"
        name="due_date"
        type="date"
      >

      <label
        class="task-create-label"
        for="newTaskDueTime"
      >
        時間
      </label>

      <input
        id="newTaskDueTime"
        class="task-create-input"
        name="due_time"
        type="time"
      >

      <section
        class="task-create-organize-card"
      >
        <h3
          class="task-create-organize-title"
        >
          整理
        </h3>

        <div
          class="task-create-organize-row"
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M20 13 11 22 2 13V3h10l8 8a1.4 1.4 0 0 1 0 2Z"
            />
            <circle
              cx="7"
              cy="8"
              r="1.5"
            />
          </svg>

          <span
            class="task-create-organize-label"
          >
            分類
          </span>

          <select
            class="task-create-organize-select"
            name="category"
          >
            <option value="work">
              仕事
            </option>

            <option value="school">
              学校
            </option>

            <option value="shopping">
              買い物
            </option>

            <option value="private">
              プライベート
            </option>

            <option
              value="other"
              selected
            >
              その他
            </option>
          </select>

          <span
            class="task-create-organize-chevron"
            aria-hidden="true"
          >
            ›
          </span>
        </div>

        <div
          class="
            task-create-organize-row
            task-create-priority-row
          "
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 21V4" />
            <path
              d="M5 5c4-3 7 3 13 0v9c-6 3-9-3-13 0"
            />
          </svg>

          <span
            class="task-create-organize-label"
          >
            優先度
          </span>

          <div
            class="task-create-priority-switch"
          >
            <label>
              <input
                type="radio"
                name="priority"
                value="normal"
                checked
              >
              <span>通常</span>
            </label>

            <label>
              <input
                type="radio"
                name="priority"
                value="important"
              >
              <span>重要</span>
            </label>
          </div>
        </div>

        <div
          class="task-create-organize-row"
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            />
            <path d="M10 21h4" />
          </svg>

          <span
            class="task-create-organize-label"
          >
            通知
          </span>

          <select
            id="newTaskNotification"
            class="task-create-organize-select"
            name="notification"
          >
            <option value="none">
              通知なし
            </option>

            <option value="same_day">
              当日
            </option>

            <option value="at_time">
              予定時刻
            </option>

            <option value="10_minutes_before">
              10分前
            </option>

            <option value="30_minutes_before">
              30分前
            </option>

            <option value="1_hour_before">
              1時間前
            </option>

            <option value="day_before">
              前日
            </option>
          </select>

          <span
            class="task-create-organize-chevron"
            aria-hidden="true"
          >
            ›
          </span>
        </div>
      </section>

      <label
        class="task-create-label"
        for="newTaskLocation"
      >
        場所
      </label>

      <input
        id="newTaskLocation"
        class="task-create-input"
        name="location"
        type="text"
        maxlength="200"
        placeholder="任意"
        autocomplete="off"
      >

      <label
        class="task-create-label"
        for="newTaskDescription"
      >
        メモ
      </label>

      <textarea
        id="newTaskDescription"
        class="
          task-create-input
          task-create-textarea
        "
        name="description"
        placeholder="任意"
      ></textarea>

      <p
        id="taskCreateError"
        class="task-create-error"
        hidden
      ></p>

      <button
        id="saveNewTaskButton"
        class="task-create-submit"
        type="submit"
      >
        タスクを追加
      </button>
    </form>
  `;
}

function bindTaskCreateForm() {
  const form =
    document.getElementById(
      "addTaskForm"
    );

  if (!form) {
    return;
  }

  const titleInput =
    document.getElementById(
      "newTaskTitle"
    );

  const errorMessage =
    document.getElementById(
      "taskCreateError"
    );

  const saveButton =
    document.getElementById(
      "saveNewTaskButton"
    );

  titleInput.focus();

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const formData =
        new FormData(form);

      const title =
        String(
          formData.get("title") ||
          ""
        ).trim();

      if (!title) {
        titleInput.focus();
        return;
      }

      const taskData = {
        title,

        description:
          String(
            formData.get(
              "description"
            ) || ""
          ).trim(),

        due_date:
          formData.get(
            "due_date"
          ) || null,

        due_time:
          formData.get(
            "due_time"
          ) || null,

        location:
          String(
            formData.get(
              "location"
            ) || ""
          ).trim(),

        priority:
          formData.get(
            "priority"
          ) || "normal",

        category:
          formData.get(
            "category"
          ) || "other",

        notification:
          formData.get(
            "notification"
          ) || "none",
      };

      try {
        saveButton.disabled = true;

        saveButton.textContent =
          "追加中...";

        errorMessage.hidden =
          true;

        const res =
          await fetch(
            "/api/tasks",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  taskData
                ),
            }
          );

        const result =
          await res
            .json()
            .catch(
              () => ({})
            );

        if (!res.ok) {
          throw new Error(
            result.error ||
              `登録失敗: ${res.status}`
          );
        }

        closeSheet();

        await Promise.all([
          loadTasks(),
          loadEvents(),
          loadRoutines(),
        ]);

        updatePlanCounts();
        setPlanType(
          currentPlanType
        );
      } catch (error) {
        console.error(
          "Task creation error:",
          error
        );

        errorMessage.textContent =
          error.message ||
          "タスクを追加できませんでした。";

        errorMessage.hidden =
          false;

        saveButton.disabled =
          false;

        saveButton.textContent =
          "タスクを追加";
      }
    }
  );
}

function openPlanEventEditSheet(
  eventItem
) {
  currentCreateType = "event";

  openSheet(
    "予定を編集",
    `
      <div
        class="plan-create-content"
      >
        ${renderEventEditForm(
          eventItem
        )}
      </div>
    `
  );

  bindEventEditForm(
    eventItem
  );
}

function renderEventEditForm(
  eventItem
) {
  const eventDate =
    eventItem.event_date || "";

  const startTime =
    eventItem.start_time
      ? String(
          eventItem.start_time
        ).slice(0, 5)
      : "";

  const endTime =
    eventItem.end_time
      ? String(
          eventItem.end_time
        ).slice(0, 5)
      : "";

  const priority =
    eventItem.priority ===
    "important"
      ? "important"
      : "normal";

  const category =
    eventItem.category ||
    "other";

  const notification =
    eventItem.notification ||
    "none";

  return `
    <form
      id="editEventForm"
      class="task-create-form event-create-form"
    >
      <label
        class="task-create-label"
        for="editEventTitle"
      >
        タイトル
      </label>

      <input
        id="editEventTitle"
        class="task-create-input"
        type="text"
        maxlength="100"
        value="${escapeCardHtml(
          eventItem.title || ""
        )}"
        required
      >

      <label
        class="task-create-label"
        for="editEventDate"
      >
        日付
      </label>

      <input
        id="editEventDate"
        class="task-create-input"
        type="date"
        value="${escapeCardHtml(
          eventDate
        )}"
        required
      >

      <div class="plan-event-time-fields">
        <div>
          <label
            class="task-create-label"
            for="editEventStartTime"
          >
            開始
          </label>

          <input
            id="editEventStartTime"
            class="task-create-input"
            type="time"
            value="${escapeCardHtml(
              startTime
            )}"
          >
        </div>

        <div>
          <label
            class="task-create-label"
            for="editEventEndTime"
          >
            終了
          </label>

          <input
            id="editEventEndTime"
            class="task-create-input"
            type="time"
            value="${escapeCardHtml(
              endTime
            )}"
          >
        </div>
      </div>

      <p class="plan-create-help">
        時間を空欄にすると終日予定になります。
      </p>

      <section
        class="task-create-organize-card"
      >
        <h3
          class="task-create-organize-title"
        >
          整理
        </h3>

        <div
  class="task-create-organize-row"
>
  <svg
    class="task-create-organize-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M20 13 11 22 2 13V3h10l8 8a1.4 1.4 0 0 1 0 2Z"
    />
    <circle
      cx="7"
      cy="8"
      r="1.5"
    />
  </svg>

  <span
    class="task-create-organize-label"
  >
    分類
  </span>

  <select
    id="editEventCategory"
    class="task-create-organize-select"
  >
    <option value="work"
      ${category === "work" ? "selected" : ""}
    >
      仕事
    </option>

    <option value="school"
      ${category === "school" ? "selected" : ""}
    >
      学校
    </option>

    <option value="shopping"
      ${category === "shopping" ? "selected" : ""}
    >
      買い物
    </option>

    <option value="private"
      ${category === "private" ? "selected" : ""}
    >
      プライベート
    </option>

    <option value="other"
      ${category === "other" ? "selected" : ""}
    >
      その他
    </option>
  </select>

  <span
    class="task-create-organize-chevron"
    aria-hidden="true"
  >
    ›
  </span>
</div>

        <div
          class="
            task-create-organize-row
            task-create-priority-row
          "
        >

        <svg
  class="task-create-organize-icon"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <path d="M5 21V4" />
  <path
    d="M5 5c4-3 7 3 13 0v9c-6 3-9-3-13 0"
  />
</svg>

          <span
            class="task-create-organize-label"
          >
            優先度
          </span>

          <div
            class="task-create-priority-switch"
          >
            <label>
              <input
                id="editEventPriorityNormal"
                type="radio"
                name="editEventPriority"
                value="normal"
                ${
                  priority ===
                  "normal"
                    ? "checked"
                    : ""
                }
              >
              <span>通常</span>
            </label>

            <label>
              <input
                id="editEventPriorityImportant"
                type="radio"
                name="editEventPriority"
                value="important"
                ${
                  priority ===
                  "important"
                    ? "checked"
                    : ""
                }
              >
              <span>重要</span>
            </label>
          </div>
        </div>

        <div
          class="task-create-organize-row"
        >

        <svg
  class="task-create-organize-icon"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <path
    d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
  />
  <path d="M10 21h4" />
</svg>

          <span
            class="task-create-organize-label"
          >
            通知
          </span>

          <select
            id="editEventNotification"
            class="task-create-organize-select"
          >
            <option
              value="none"
              ${
                notification ===
                "none"
                  ? "selected"
                  : ""
              }
            >
              通知なし
            </option>

            <option
              value="at_time"
              ${
                notification ===
                "at_time"
                  ? "selected"
                  : ""
              }
            >
              予定時刻
            </option>

            <option
              value="10_minutes_before"
              ${
                notification ===
                "10_minutes_before"
                  ? "selected"
                  : ""
              }
            >
              10分前
            </option>

            <option
              value="30_minutes_before"
              ${
                notification ===
                "30_minutes_before"
                  ? "selected"
                  : ""
              }
            >
              30分前
            </option>

            <option
              value="1_hour_before"
              ${
                notification ===
                "1_hour_before"
                  ? "selected"
                  : ""
              }
            >
              1時間前
            </option>

            <option
              value="day_before"
              ${
                notification ===
                "day_before"
                  ? "selected"
                  : ""
              }
            >
              前日
            </option>
                    </select>

          <span
            class="task-create-organize-chevron"
            aria-hidden="true"
          >
            ›
          </span>
        </div>
      </section>

      <label
        class="task-create-label"
        for="editEventLocation"
      >
        場所
      </label>

      <input
        id="editEventLocation"
        class="task-create-input"
        type="text"
        value="${escapeCardHtml(
          eventItem.location || ""
        )}"
        placeholder="任意"
      >

      <label
        class="task-create-label"
        for="editEventDescription"
      >
        メモ
      </label>

      <textarea
        id="editEventDescription"
        class="
          task-create-input
          task-create-textarea
        "
        placeholder="任意"
      >${escapeCardHtml(
        eventItem.description || ""
      )}</textarea>

      <p
        id="eventEditError"
        class="task-create-error"
        hidden
      ></p>

      <button
        id="saveEventEditButton"
        class="task-create-submit"
        type="submit"
      >
        変更を保存
      </button>

      <button
        id="deleteEventEditButton"
        class="sheet-delete-button"
        type="button"
      >
        予定を削除
      </button>
    </form>
  `;
}

function hasInvalidEventTimeRange(
  startTime,
  endTime
) {
  return Boolean(
    startTime &&
    endTime &&
    endTime <= startTime
  );
}

function syncEventNotificationAvailability(
  startTimeInput,
  notificationInput
) {
  const timeDependentNotifications = [
    "at_time",
    "10_minutes_before",
    "30_minutes_before",
    "1_hour_before",
  ];

  const hasStartTime =
    Boolean(startTimeInput.value);

  for (
    const option
    of notificationInput.options
  ) {
    option.disabled =
      timeDependentNotifications.includes(
        option.value
      ) &&
      !hasStartTime;
  }

  if (
    !hasStartTime &&
    timeDependentNotifications.includes(
      notificationInput.value
    )
  ) {
    notificationInput.value =
      "none";
  }
}

function bindEventEditForm(
  eventItem
) {
  const form =
    document.getElementById(
      "editEventForm"
    );

  if (!form) {
    return;
  }

  const startTimeInput =
    document.getElementById(
      "editEventStartTime"
    );

  const notificationInput =
    document.getElementById(
      "editEventNotification"
    );

  const saveButton =
    document.getElementById(
      "saveEventEditButton"
    );

  const deleteButton =
    document.getElementById(
      "deleteEventEditButton"
    );

  const errorMessage =
    document.getElementById(
      "eventEditError"
    );
  const syncNotificationState = () => {
    syncEventNotificationAvailability(
      startTimeInput,
      notificationInput
    );
  };

  startTimeInput.addEventListener(
    "change",
    syncNotificationState
  );

  syncNotificationState();

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const startTime =
        startTimeInput.value ||
        null;

      const endTime =
        document
          .getElementById(
            "editEventEndTime"
          )
          .value || null;

      if (
        hasInvalidEventTimeRange(
          startTime,
          endTime
        )
      ) {
        errorMessage.textContent =
          "終了時刻は開始時刻より後にしてください。";

        errorMessage.hidden =
          false;

        return;
      }

      const payload = {
        title:
          document
            .getElementById(
              "editEventTitle"
            )
            .value
            .trim(),

        eventDate:
          document
            .getElementById(
              "editEventDate"
            )
            .value,

        startTime,

        endTime,

        location:
          document
            .getElementById(
              "editEventLocation"
            )
            .value
            .trim(),

        description:
          document
            .getElementById(
              "editEventDescription"
            )
            .value
            .trim(),

        category:
          document
            .getElementById(
              "editEventCategory"
            )
            .value,

        priority:
          document
            .getElementById(
              "editEventPriorityImportant"
            )
            .checked
              ? "important"
              : "normal",

        notification:
          notificationInput.value,
      };

      try {
        saveButton.disabled = true;
        saveButton.textContent =
          "保存中...";

        errorMessage.hidden =
          true;

        const response =
          await fetch(
            `/api/events/${eventItem.id}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          throw new Error(
            result.error ||
              "予定を更新できませんでした。"
          );
        }

        closeSheet();

        await Promise.all([
          loadTasks(),
          loadEvents(),
          loadRoutines(),
        ]);

        updatePlanCounts();
        setPlanType(
          currentPlanType
        );
      } catch (error) {
        console.error(
          "Event update error:",
          error
        );

        errorMessage.textContent =
          error.message;

        errorMessage.hidden =
          false;

        saveButton.disabled =
          false;

        saveButton.textContent =
          "変更を保存";
      }
    }
  );

  deleteButton.addEventListener(
    "click",
    async () => {
      const confirmed =
        confirm(
          `「${eventItem.title}」を削除しますか？`
        );

      if (!confirmed) {
        return;
      }

      try {
        deleteButton.disabled =
          true;

        deleteButton.textContent =
          "削除中...";

        const response =
          await fetch(
            `/api/events/${eventItem.id}`,
            {
              method: "DELETE",
            }
          );

        if (!response.ok) {
          throw new Error(
            "予定を削除できませんでした。"
          );
        }

        closeSheet();

        await Promise.all([
          loadTasks(),
          loadEvents(),
          loadRoutines(),
        ]);

        updatePlanCounts();
        setPlanType(
          currentPlanType
        );
      } catch (error) {
        console.error(
          "Event delete error:",
          error
        );

        alert(
          error.message
        );

        deleteButton.disabled =
          false;

        deleteButton.textContent =
          "予定を削除";
      }
    }
  );
}

function renderEventCreateForm() {
  const today =
    new Date().toLocaleDateString(
      "sv-SE",
      {
        timeZone: "Asia/Tokyo",
      }
    );

  return `
    <form
      id="addEventForm"
      class="task-create-form event-create-form"
    >
      <label
        class="task-create-label"
        for="newEventTitle"
      >
        タイトル
      </label>

      <input
        id="newEventTitle"
        class="task-create-input"
        type="text"
        maxlength="100"
        placeholder="例：打ち合わせ"
        autocomplete="off"
        required
      >

      <label
        class="task-create-label"
        for="newEventDate"
      >
        日付
      </label>

      <input
        id="newEventDate"
        class="task-create-input"
        type="date"
        value="${today}"
        required
      >

      <div class="plan-event-time-fields">
        <div>
          <label
            class="task-create-label"
            for="newEventStartTime"
          >
            開始
          </label>

          <input
            id="newEventStartTime"
            class="task-create-input"
            type="time"
          >
        </div>

        <div>
          <label
            class="task-create-label"
            for="newEventEndTime"
          >
            終了
          </label>

          <input
            id="newEventEndTime"
            class="task-create-input"
            type="time"
          >
        </div>
      </div>

      <p class="plan-create-help">
        時間を空欄にすると終日予定になります。
      </p>

      <section
        class="task-create-organize-card"
      >
        <h3
          class="task-create-organize-title"
        >
          整理
        </h3>

        <div
          class="task-create-organize-row"
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M20 13 11 22 2 13V3h10l8 8a1.4 1.4 0 0 1 0 2Z"
            />
            <circle
              cx="7"
              cy="8"
              r="1.5"
            />
          </svg>

          <span
            class="task-create-organize-label"
          >
            分類
          </span>

          <select
            id="newEventCategory"
            class="task-create-organize-select"
          >
            <option value="work">
              仕事
            </option>

            <option value="school">
              学校
            </option>

            <option value="shopping">
              買い物
            </option>

            <option value="private">
              プライベート
            </option>

            <option
              value="other"
              selected
            >
              その他
            </option>
          </select>

          <span
            class="task-create-organize-chevron"
            aria-hidden="true"
          >
            ›
          </span>
        </div>

        <div
          class="
            task-create-organize-row
            task-create-priority-row
          "
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 21V4" />
            <path
              d="M5 5c4-3 7 3 13 0v9c-6 3-9-3-13 0"
            />
          </svg>

          <span
            class="task-create-organize-label"
          >
            優先度
          </span>

          <div
            class="task-create-priority-switch"
          >
            <label>
              <input
                id="newEventPriorityNormal"
                type="radio"
                name="eventPriority"
                value="normal"
                checked
              >
              <span>通常</span>
            </label>

            <label>
              <input
                id="newEventPriorityImportant"
                type="radio"
                name="eventPriority"
                value="important"
              >
              <span>重要</span>
            </label>
          </div>
        </div>

        <div
          class="task-create-organize-row"
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            />
            <path d="M10 21h4" />
          </svg>

          <span
            class="task-create-organize-label"
          >
            通知
          </span>

          <select
            id="newEventNotification"
            class="task-create-organize-select"
          >
            <option value="none">
              通知なし
            </option>

            <option value="at_time">
              予定時刻
            </option>

            <option value="10_minutes_before">
              10分前
            </option>

            <option value="30_minutes_before">
              30分前
            </option>

            <option value="1_hour_before">
              1時間前
            </option>

            <option value="day_before">
              前日
            </option>
          </select>

          <span
            class="task-create-organize-chevron"
            aria-hidden="true"
          >
            ›
          </span>
        </div>
      </section>

      <label
        class="task-create-label"
        for="newEventLocation"
      >
        場所
      </label>

      <input
        id="newEventLocation"
        class="task-create-input"
        type="text"
        maxlength="200"
        placeholder="任意"
        autocomplete="off"
      >

      <label
        class="task-create-label"
        for="newEventDescription"
      >
        メモ
      </label>

      <textarea
        id="newEventDescription"
        class="
          task-create-input
          task-create-textarea
        "
        placeholder="任意"
      ></textarea>

      <p
        id="eventCreateError"
        class="task-create-error"
        hidden
      ></p>

      <button
        id="saveNewEventButton"
        class="task-create-submit"
        type="submit"
      >
        予定を追加
      </button>
    </form>
  `;
}

function bindEventCreateForm() {
  const form =
    document.getElementById(
      "addEventForm"
    );

  if (!form) {
    return;
  }

  const titleInput =
    document.getElementById(
      "newEventTitle"
    );

  const startTimeInput =
    document.getElementById(
      "newEventStartTime"
    );

  const endTimeInput =
    document.getElementById(
      "newEventEndTime"
    );

  const notificationInput =
    document.getElementById(
      "newEventNotification"
    );

  const errorMessage =
    document.getElementById(
      "eventCreateError"
    );

  const saveButton =
    document.getElementById(
      "saveNewEventButton"
    );
  const syncEventNotificationState = () => {
    syncEventNotificationAvailability(
      startTimeInput,
      notificationInput
    );
  };

  startTimeInput.addEventListener(
    "change",
    syncEventNotificationState
  );

  syncEventNotificationState();

  titleInput.focus();

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const title =
        titleInput.value.trim();

      const eventDate =
        document
          .getElementById(
            "newEventDate"
          )
          .value;

      const startTime =
        startTimeInput.value || null;

      const endTime =
        endTimeInput.value || null;

      if (!title) {
        titleInput.focus();
        return;
      }

      if (!eventDate) {
        errorMessage.textContent =
          "日付を入力してください。";

        errorMessage.hidden =
          false;

        return;
      }

      if (
        hasInvalidEventTimeRange(
          startTime,
          endTime
        )
      ) {
        errorMessage.textContent =
          "終了時刻は開始時刻より後にしてください。";

        errorMessage.hidden =
          false;

        return;
      }

      const payload = {
        title,

        eventDate,

        startTime,

        endTime,

        location:
          document
            .getElementById(
              "newEventLocation"
            )
            .value
            .trim(),

        description:
          document
            .getElementById(
              "newEventDescription"
            )
            .value
            .trim(),

        category:
          document
            .getElementById(
              "newEventCategory"
            )
            .value,

        priority:
          document
            .getElementById(
              "newEventPriorityImportant"
            )
            .checked
              ? "important"
              : "normal",

        notification:
          notificationInput.value,
      };

      try {
        saveButton.disabled = true;

        saveButton.textContent =
          "追加中...";

        errorMessage.hidden =
          true;

        const response =
          await fetch(
            "/api/events",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          throw new Error(
            result.error ||
              `登録失敗: ${response.status}`
          );
        }

        closeSheet();

        await Promise.all([
          loadTasks(),
          loadEvents(),
          loadRoutines(),
        ]);

        updatePlanCounts();

        setPlanType(
          currentPlanType
        );
      } catch (error) {
        console.error(
          "Event creation error:",
          error
        );

        errorMessage.textContent =
          error.message ||
          "予定を追加できませんでした。";

        errorMessage.hidden =
          false;

        saveButton.disabled =
          false;

        saveButton.textContent =
          "予定を追加";
      }
    }
  );
}

function getDefaultCreateType() {
  if (currentPlanType === "tasks") {
    return "task";
  }

  if (currentPlanType === "events") {
    return "event";
  }

  if (currentPlanType === "routines") {
    return "routine";
  }

  return "task";
}

function renderCreateTypeTabs() {
  return `
    <div
      class="plan-create-tabs"
      role="tablist"
      aria-label="追加する種類"
    >
      <button
        type="button"
        class="plan-create-tab ${
          currentCreateType === "task"
            ? "active"
            : ""
        }"
        data-create-type="task"
      >
        タスク
      </button>

      <button
        type="button"
        class="plan-create-tab ${
          currentCreateType === "event"
            ? "active"
            : ""
        }"
        data-create-type="event"
      >
        予定
      </button>

      <button
        type="button"
        class="plan-create-tab ${
          currentCreateType === "routine"
            ? "active"
            : ""
        }"
        data-create-type="routine"
      >
        ルーティーン
      </button>
    </div>
  `;
}

function bindCreateTypeTabs() {
  sheetContent
    .querySelectorAll(
      "[data-create-type]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          currentCreateType =
            button.dataset.createType;

          renderPlanCreateSheet();
        }
      );
    });
}

function enhanceNativeDateTimeInputs(
  root = document
) {
  if (
    !window.NotiaRuntime
      ?.isNativeApp?.()
  ) {
    return;
  }

  const inputs =
    root.querySelectorAll(
      '.task-create-input[type="date"], ' +
      '.task-create-input[type="time"]'
    );

  inputs.forEach((input) => {
    if (
      input.closest(
        ".native-datetime-field"
      )
    ) {
      return;
    }

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "native-datetime-field";

    const display =
      document.createElement("span");

    display.className =
      "native-datetime-display";

    input.parentNode.insertBefore(
      wrapper,
      input
    );

    wrapper.appendChild(display);
    wrapper.appendChild(input);

    const syncDisplay = () => {
      let value =
        input.value || "";

      if (
        input.type === "date" &&
        value
      ) {
        value =
          value.replaceAll("-", "/");
      }

      display.textContent = value;
    };

    input.addEventListener(
      "input",
      syncDisplay
    );

    input.addEventListener(
      "change",
      syncDisplay
    );

    syncDisplay();
  });
}

function renderPlanCreateSheet() {
  let formHtml = "";

  if (currentCreateType === "task") {
    formHtml =
      renderTaskCreateForm();
  }

  if (currentCreateType === "event") {
    formHtml =
      renderEventCreateForm();
  }

  if (currentCreateType === "routine") {
    formHtml =
      renderRoutineCreateForm();
  }

  openSheet(
    "追加",
    `
      ${renderCreateTypeTabs()}

      <div
        class="plan-create-content"
      >
        ${formHtml}
      </div>
    `
  );

  bindCreateTypeTabs();

  enhanceNativeDateTimeInputs(
    document.querySelector(
      ".plan-create-content"
    )
  );

  if (currentCreateType === "task") {
    bindTaskCreateForm();
  }

  if (currentCreateType === "event") {
    bindEventCreateForm();
  }

  if (currentCreateType === "routine") {
    bindRoutineCreateForm();
  }
}

addTaskButton.addEventListener(
  "click",
  () => {
    currentCreateType =
      getDefaultCreateType();

    renderPlanCreateSheet();
  }
);

function renderRoutineCreateForm() {
  return `
    <form
      id="addRoutineForm"
      class="task-create-form routine-create-form"
    >
      <label
        class="task-create-label"
        for="newRoutineTitle"
      >
        タイトル
      </label>

      <input
        id="newRoutineTitle"
        class="task-create-input"
        type="text"
        maxlength="100"
        placeholder="例：英語学習"
        autocomplete="off"
        required
      >

      <fieldset
        class="plan-routine-create-days"
      >
        <legend>
          曜日
        </legend>

        <p class="plan-create-help">
          複数の曜日を選択できます。
        </p>

        <div
          class="plan-routine-day-options"
        >
          ${[
            ["0", "日"],
            ["1", "月"],
            ["2", "火"],
            ["3", "水"],
            ["4", "木"],
            ["5", "金"],
            ["6", "土"],
          ]
            .map(
              ([value, label]) => `
                <label
                  class="plan-routine-day-option"
                >
                  <input
                    type="checkbox"
                    name="newRoutineDay"
                    value="${value}"
                  >
                  <span>
                    ${label}
                  </span>
                </label>
              `
            )
            .join("")}
        </div>
      </fieldset>

      <label
        class="task-create-label"
        for="newRoutineTime"
      >
        時間
      </label>

      <input
        id="newRoutineTime"
        class="task-create-input"
        type="time"
      >

      <label
        class="plan-routine-toggle-row"
        for="newRoutineNoTime"
      >
        <span>
          <strong>
            時間を設定しない
          </strong>

          <small>
            その日のルーティーンとして表示
          </small>
        </span>

        <span
          class="plan-routine-switch"
        >
          <input
            id="newRoutineNoTime"
            type="checkbox"
          >

          <span
            class="plan-routine-switch-track"
            aria-hidden="true"
          ></span>
        </span>
      </label>

      <section
        class="task-create-organize-card"
      >
        <h3
          class="task-create-organize-title"
        >
          整理
        </h3>

        <div
          class="task-create-organize-row"
        >
          <svg
            class="task-create-organize-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M20 13 11 22 2 13V3h10l8 8a1.4 1.4 0 0 1 0 2Z"
            />
            <circle
              cx="7"
              cy="8"
              r="1.5"
            />
          </svg>

          <span
            class="task-create-organize-label"
          >
            分類
          </span>

          <select
            id="newRoutineCategory"
            class="task-create-organize-select"
          >
            <option value="work">
              仕事
            </option>

            <option value="school">
              学校
            </option>

            <option value="shopping">
              買い物
            </option>

            <option
              value="private"
              selected
            >
              プライベート
            </option>

            <option value="other">
              その他
            </option>
          </select>

          <span
            class="task-create-organize-chevron"
            aria-hidden="true"
          >
            ›
          </span>
        </div>
      </section>

      <label
        class="plan-routine-toggle-row"
        for="newRoutineGoogle"
      >
        <span>
          <strong>
            Google予定にも表示
          </strong>

          <small>
            次回の同期時に繰り返し予定として反映
          </small>
        </span>

        <span
          class="plan-routine-switch"
        >
          <input
            id="newRoutineGoogle"
            type="checkbox"
          >

          <span
            class="plan-routine-switch-track"
            aria-hidden="true"
          ></span>
        </span>
      </label>

      <label
        class="task-create-label"
        for="newRoutineMemo"
      >
        メモ
      </label>

      <textarea
        id="newRoutineMemo"
        class="
          task-create-input
          task-create-textarea
        "
        maxlength="2000"
        placeholder="持ち物や補足など（任意）"
      ></textarea>

      <p
        id="routineCreateError"
        class="task-create-error"
        hidden
      ></p>

      <button
        id="saveNewRoutineButton"
        class="task-create-submit"
        type="submit"
      >
        ルーティーンを追加
      </button>
    </form>
  `;
}

function bindRoutineCreateForm() {
  const form =
    document.getElementById(
      "addRoutineForm"
    );

  if (!form) {
    return;
  }

  const titleInput =
    document.getElementById(
      "newRoutineTitle"
    );

  const timeInput =
    document.getElementById(
      "newRoutineTime"
    );

  const noTimeInput =
    document.getElementById(
      "newRoutineNoTime"
    );

  const saveButton =
    document.getElementById(
      "saveNewRoutineButton"
    );

  const errorMessage =
    document.getElementById(
      "routineCreateError"
    );

  function getSelectedRoutineDays() {
    return [
      ...form.querySelectorAll(
        'input[name="newRoutineDay"]:checked'
      ),
    ]
      .map(
        (input) =>
          Number(input.value)
      )
      .sort(
        (a, b) => a - b
      );
  }

  function syncRoutineTimeState() {
    timeInput.disabled =
      noTimeInput.checked;

    if (noTimeInput.checked) {
      timeInput.value = "";
    }
  }

  noTimeInput.addEventListener(
    "change",
    syncRoutineTimeState
  );

  syncRoutineTimeState();

  titleInput.focus();

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const title =
        titleInput.value.trim();

      const daysOfWeek =
        getSelectedRoutineDays();

      if (!title) {
        titleInput.focus();
        return;
      }

      if (
        daysOfWeek.length === 0
      ) {
        errorMessage.textContent =
          "曜日を1つ以上選択してください。";

        errorMessage.hidden =
          false;

        return;
      }

      const payload = {
        title,

        dayOfWeek:
          daysOfWeek[0],

        daysOfWeek,

        routineTime:
          noTimeInput.checked
            ? null
            : timeInput.value ||
              null,

        category:
          document
            .getElementById(
              "newRoutineCategory"
            )
            .value,

        googleCalendarEnabled:
          document
            .getElementById(
              "newRoutineGoogle"
            )
            .checked,

        memo:
          document
            .getElementById(
              "newRoutineMemo"
            )
            .value
            .trim(),
      };

      try {
        saveButton.disabled = true;

        saveButton.textContent =
          "追加中...";

        errorMessage.hidden =
          true;

        const response =
          await fetch(
            "/api/routines",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          throw new Error(
            result.error ||
              `登録失敗: ${response.status}`
          );
        }

        closeSheet();

        await Promise.all([
          loadTasks(),
          loadEvents(),
          loadRoutines(),
        ]);

        updatePlanCounts();

        setPlanType(
          currentPlanType
        );
      } catch (error) {
        console.error(
          "Routine creation error:",
          error
        );

        errorMessage.textContent =
          error.message ||
          "ルーティーンを追加できませんでした。";

        errorMessage.hidden =
          false;

        saveButton.disabled =
          false;

        saveButton.textContent =
          "ルーティーンを追加";
      }
    }
  );
}

sheetOverlay.addEventListener("click", closeSheet);
closeSheetButton.addEventListener("click", closeSheet);