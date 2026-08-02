const taskPageParams =
  new URLSearchParams(
    window.location.search
  );

const requestedFilter =
  taskPageParams.get("filter");

const taskList = document.getElementById("taskList");
let allTasks = [];
let currentFilter =
  requestedFilter === "overdue"
    ? "overdue"
    : "all";
let taskGroupSequence = 0;

async function loadTasks() {
  try {
    taskList.innerHTML = `<p class="task-status">読み込み中...</p>`;

    const res = await fetch("/api/tasks");

    if (!res.ok) {
      throw new Error(`タスク取得失敗: ${res.status}`);
    }

    const tasks = await res.json();

    allTasks = tasks;
refreshTaskList();

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

function renderTaskCard(
  task,
  container = taskList
) {
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
    showActions: true,
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
      location.href =
        `/tasks/${task.id}`;
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

        location.href =
          `/tasks/${task.id}`;
      }
    }
  );

  completeButton.addEventListener(
    "click",
    async () => {
      await completeTask(
        task.id,
        completeButton
      );
    }
  );

  deleteButton.addEventListener(
    "click",
    async () => {
      await deleteTask(
        task,
        deleteButton
      );
    }
  );

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

  const taskProgressCount =
    document.getElementById(
      "taskProgressCount"
    );

  if (taskProgressCount) {
    taskProgressCount.textContent =
      tasks.length;
  }

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
}

async function completeTask(taskId, button) {
  try {
    button.disabled = true;

    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(`タスク完了失敗: ${res.status}`);
    }

    await loadTasks();
  } catch (error) {
    console.error(error);
    button.disabled = false;
    alert("タスクを完了できませんでした。");
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
  } catch (error) {
    console.error(error);
    button.disabled = false;
    alert("タスクを削除できませんでした。");
  }
}


async function loadTaskPage() {
  await loadTasks();
}

loadTaskPage();

const addTaskButton =
  document.getElementById(
    "addTaskButton"
  );

const filterButton =
  document.getElementById("filterButton");

const settingsButton =
  document.getElementById("settingsButton");

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
}

function closeSheet() {
  sheetOverlay.hidden = true;
  sheetModal.hidden = true;
}

addTaskButton.addEventListener(
  "click",
  () => {
    openSheet(
      "タスクを追加",
      `
        <form
          id="addTaskForm"
          class="task-create-form"
        >
          <label class="task-form-field">
            <span>タスク名</span>

            <input
              id="newTaskTitle"
              name="title"
              type="text"
              maxlength="100"
              placeholder="何をしますか？"
              autocomplete="off"
              required
            >
          </label>

          <label class="task-form-field">
            <span>期限</span>

            <input
              name="due_date"
              type="date"
            >
          </label>

          <label class="task-form-field">
  <span>時間（任意）</span>

  <input
    name="due_time"
    type="time"
  >
</label>

          <label class="task-form-field">
            <span>分類</span>

            <select name="category">
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
          </label>

          <label class="task-important-field">
            <input
              name="important"
              type="checkbox"
            >

            <span>
              重要タスクにする
            </span>
          </label>

          <button
  id="notificationToggle"
  class="task-notification-toggle"
  type="button"
  aria-pressed="false"
>
  <img
    id="notificationIcon"
    class="task-notification-icon"
    src="/images/tasks/notia-gong-off.png"
    alt=""
  >

  <span id="notificationText">
    通知しない
  </span>
</button>

<input
  id="notificationValue"
  name="notification"
  type="hidden"
  value="none"
>

<div
  id="newTaskNotificationSheetOverlay"
  class="sheet-overlay"
  hidden
></div>

<section
  id="newTaskNotificationSheet"
  class="sheet-modal"
  aria-labelledby="newTaskNotificationSheetTitle"
  hidden
>
  <div
    class="sheet-handle"
    aria-hidden="true"
  ></div>

  <h2
    id="newTaskNotificationSheetTitle"
    class="sheet-title"
  >
    通知タイミング
  </h2>

  <div class="notification-sheet-options">
    <button
      class="sheet-item new-task-notification-sheet-item"
      type="button"
      data-notification-value="none"
    >
      通知なし
    </button>

    <button
      class="sheet-item new-task-notification-sheet-item"
      type="button"
      data-notification-value="at_time"
    >
      予定時刻
    </button>

    <button
      class="sheet-item new-task-notification-sheet-item"
      type="button"
      data-notification-value="10_minutes_before"
    >
      10分前
    </button>

    <button
      class="sheet-item new-task-notification-sheet-item"
      type="button"
      data-notification-value="30_minutes_before"
    >
      30分前
    </button>

    <button
      class="sheet-item new-task-notification-sheet-item"
      type="button"
      data-notification-value="1_hour_before"
    >
      1時間前
    </button>

    <button
      class="sheet-item new-task-notification-sheet-item"
      type="button"
      data-notification-value="day_before"
    >
      前日
    </button>
  </div>

  <button
    id="closeNewTaskNotificationSheetButton"
    class="sheet-cancel-button"
    type="button"
  >
    キャンセル
  </button>
</section>

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
      `
    );

    const notificationToggle =
  document.getElementById(
    "notificationToggle"
  );

const notificationIcon =
  document.getElementById(
    "notificationIcon"
  );

const notificationText =
  document.getElementById(
    "notificationText"
  );

const notificationValue =
  document.getElementById(
    "notificationValue"
  );

const dueTimeInput =
  document.querySelector(
    '#addTaskForm input[name="due_time"]'
  );

const notificationSheetOverlay =
  document.getElementById(
    "newTaskNotificationSheetOverlay"
  );

const notificationSheet =
  document.getElementById(
    "newTaskNotificationSheet"
  );

const closeNotificationSheetButton =
  document.getElementById(
    "closeNewTaskNotificationSheetButton"
  );

const notificationSheetItems =
  document.querySelectorAll(
    ".new-task-notification-sheet-item"
  );

const timeRequiredNotifications = [
  "at_time",
  "10_minutes_before",
  "30_minutes_before",
  "1_hour_before",
];

function updateNewTaskNotificationButton() {
  const isOn =
    notificationValue.value !== "none";

  const label = {
    none: "通知なし",
    at_time: "予定時刻",
    "10_minutes_before": "10分前",
    "30_minutes_before": "30分前",
    "1_hour_before": "1時間前",
    day_before: "前日",
  }[notificationValue.value] || "通知なし";

  notificationText.textContent = label;

  notificationToggle.setAttribute(
    "aria-pressed",
    String(isOn)
  );

  notificationIcon.src = isOn
    ? "/images/tasks/notia-gong-on.png"
    : "/images/tasks/notia-gong-off.png";
}

function openNewTaskNotificationSheet() {
  const hasDueTime =
    Boolean(dueTimeInput?.value);

  notificationSheetItems.forEach(
    (item) => {
      const requiresTime =
        timeRequiredNotifications.includes(
          item.dataset.notificationValue
        );

      item.disabled =
        requiresTime && !hasDueTime;
    }
  );

  notificationSheetOverlay.hidden = false;
  notificationSheet.hidden = false;
}

function closeNewTaskNotificationSheet() {
  notificationSheetOverlay.hidden = true;
  notificationSheet.hidden = true;
}

notificationToggle.addEventListener(
  "click",
  openNewTaskNotificationSheet
);

notificationSheetOverlay.addEventListener(
  "click",
  closeNewTaskNotificationSheet
);

closeNotificationSheetButton.addEventListener(
  "click",
  closeNewTaskNotificationSheet
);

notificationSheetItems.forEach((item) => {
  item.addEventListener("click", () => {
    const value =
      item.dataset.notificationValue;

    if (!value) {
      return;
    }

    notificationValue.value = value;

    updateNewTaskNotificationButton();
    closeNewTaskNotificationSheet();
  });
});

dueTimeInput?.addEventListener(
  "input",
  () => {
    if (
      !dueTimeInput.value &&
      timeRequiredNotifications.includes(
        notificationValue.value
      )
    ) {
      notificationValue.value = "none";
      updateNewTaskNotificationButton();
    }
  }
);

updateNewTaskNotificationButton();

    const form =
      document.getElementById(
        "addTaskForm"
      );

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

        const title = String(
          formData.get("title") || ""
        ).trim();

        if (!title) {
          titleInput.focus();
          return;
        }

        const taskData = {
          title,
          due_date:
            formData.get("due_date") ||
            null,
          due_time:
    formData.get("due_time") ||
    null,
          priority:
  formData.get("important") === "on"
    ? "important"
    : "normal",
          category:
            formData.get("category") ||
            "other",
          notification:
  formData.get("notification") ||
  "none",
        };

        try {
          saveButton.disabled = true;
          saveButton.textContent =
            "追加中...";

          errorMessage.hidden = true;

          const res = await fetch(
            "/api/tasks",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                taskData
              ),
            }
          );

          const result =
            await res
              .json()
              .catch(() => ({}));

          if (!res.ok) {
            throw new Error(
              result.error ||
                `登録失敗: ${res.status}`
            );
          }

          closeSheet();
          await loadTasks();
        } catch (error) {
          console.error(
            "Task creation error:",
            error
          );

          errorMessage.textContent =
            error.message ||
            "タスクを追加できませんでした。";

          errorMessage.hidden = false;

          saveButton.disabled = false;
          saveButton.textContent =
            "タスクを追加";
        }
      }
    );
  }
);

filterButton.addEventListener("click", () => {
  openSheet(
    "絞り込み",
    `
      <button
        class="sheet-item"
        type="button"
        data-filter="all"
      >
        すべて
      </button>

      <button
  class="sheet-item"
  type="button"
  data-filter="important"
>
  重要タスク
</button>

      <button
        class="sheet-item"
        type="button"
        data-filter="work"
      >
        仕事
      </button>

      <button
        class="sheet-item"
        type="button"
        data-filter="school"
      >
        学校
      </button>

      <button
        class="sheet-item"
        type="button"
        data-filter="shopping"
      >
        買い物
      </button>

      <button
        class="sheet-item"
        type="button"
        data-filter="private"
      >
        プライベート
      </button>

      <button
        class="sheet-item"
        type="button"
        data-filter="other"
      >
        その他
      </button>
    `
  );

  const filterItems =
    sheetContent.querySelectorAll("[data-filter]");

  filterItems.forEach((button) => {
    if (button.dataset.filter === currentFilter) {
      button.classList.add("is-selected");
      button.setAttribute("aria-current", "true");
    }

    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;

      refreshTaskList();
      closeSheet();
    });
  });
});

async function loadGoogleIntegration() {
  const status =
    document.getElementById("googleStatus");

  const email =
    document.getElementById("googleEmail");

  const lastSync =
    document.getElementById("googleLastSync");

  const actions =
    document.getElementById("googleActions");

  try {
    const res =
      await fetch("/api/integrations");

    if (!res.ok) {
      throw new Error(
        `連携状態取得失敗: ${res.status}`
      );
    }

    const data = await res.json();
    const google = data.google;

    if (!google.connected) {
      status.textContent = "未接続";
      email.textContent = "";
      lastSync.textContent = "";

      actions.innerHTML = `
        <a
          class="integration-primary-button"
          href="/auth/google"
        >
          Googleでログイン
        </a>
      `;

      return;
    }

    status.textContent = "🟢 接続済み";

    email.textContent =
      google.email || "アカウント情報なし";

    lastSync.textContent =
      google.lastSync
        ? `最終同期：${formatIntegrationDate(
            google.lastSync
          )}`
        : "最終同期：未同期";

    actions.innerHTML = `
      <button
        id="googleSyncButton"
        class="integration-primary-button"
        type="button"
      >
        ↻ 同期
      </button>

      <button
        id="googleLogoutButton"
        class="integration-secondary-button"
        type="button"
      >
        ログアウト
      </button>
    `;

    const syncButton =
      document.getElementById(
        "googleSyncButton"
      );

    const logoutButton =
      document.getElementById(
        "googleLogoutButton"
      );

    syncButton.addEventListener(
      "click",
      async () => {
        try {
          syncButton.disabled = true;
          syncButton.textContent =
            "同期中...";

          const syncRes = await fetch(
            "/api/calendar/sync",
            {
              method: "POST",
            }
          );

          const result =
            await syncRes.json();

          if (
  !syncRes.ok ||
  !result.success
) {
  throw new Error(
    result.error ||
      result.message ||
      `同期失敗: ${syncRes.status}`
  );
}

          alert(
            `同期が完了しました。\n` +
            `Google予定 ${
              result.importedEvents ?? 0
            }件\n` +
            `Notia同期 ${
              result.exportedTasks ?? 0
            }件`
          );

          await loadGoogleIntegration();
        } catch (error) {
          console.error(
            "Google Calendar sync error:",
            error
          );

          alert(
            "Google Calendarとの同期に失敗しました。"
          );

          syncButton.disabled = false;
          syncButton.textContent = "↻ 同期";
        }
      }
    );

    logoutButton.addEventListener(
      "click",
      async () => {
        const confirmed = confirm(
          "Google Calendarとの連携を解除しますか？"
        );

        if (!confirmed) {
          return;
        }

        try {
          logoutButton.disabled = true;
          logoutButton.textContent =
            "解除中...";

          const logoutRes = await fetch(
            "/auth/google/logout",
            {
              method: "POST",
            }
          );

          if (!logoutRes.ok) {
            throw new Error(
              `ログアウト失敗: ${logoutRes.status}`
            );
          }

          await loadGoogleIntegration();

          alert(
            "Google Calendarとの連携を解除しました。"
          );
        } catch (error) {
          console.error(
            "Google logout error:",
            error
          );

          alert(
            "Google Calendarとの連携を解除できませんでした。"
          );

          logoutButton.disabled = false;
          logoutButton.textContent =
            "ログアウト";
        }
      }
    );
  } catch (error) {
    console.error(
      "Google integration load error:",
      error
    );

    status.textContent =
      "接続状態を取得できませんでした。";

    email.textContent = "";
    lastSync.textContent = "";
    actions.innerHTML = "";
  }
}

function formatIntegrationDate(value) {
  if (!value) {
    return "未同期";
  }

  const normalized =
    value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

settingsButton.addEventListener("click", async () => {
  openSheet(
    "設定",
    `
      <div class="settings-section">

        <div class="settings-item">
          <div class="settings-title">
            カテゴリー管理
          </div>

          <div class="settings-description">
            準備中
          </div>
        </div>

        <div class="settings-item">
          <div class="settings-title">
            表示設定
          </div>

          <div class="settings-description">
            準備中
          </div>
        </div>

        <div class="settings-item integration-card">
          <div class="settings-title">
            Google Calendar
          </div>

          <div
            id="googleStatus"
            class="settings-description"
          >
            接続状態を確認しています...
          </div>

          <div
            id="googleEmail"
            class="integration-email"
          ></div>

          <div
            id="googleLastSync"
            class="integration-last-sync"
          ></div>

          <div
            id="googleActions"
            class="integration-actions"
          ></div>
        </div>
      </div>
    `
  );

  await loadGoogleIntegration();
});

sheetOverlay.addEventListener("click", closeSheet);
closeSheetButton.addEventListener("click", closeSheet);