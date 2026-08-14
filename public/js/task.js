console.log("task.js loaded");

const taskStatus = document.getElementById("taskStatus");
const taskForm = document.getElementById("taskForm");
const taskNotification = document.getElementById("taskNotification");
const taskTypeTask = document.getElementById("taskTypeTask");
const taskTypeEvent = document.getElementById("taskTypeEvent");

const taskTitle = document.getElementById("taskTitle");
const taskDueDate =
  document.getElementById("taskDueDate");
const taskDueDateButton =
  document.getElementById("taskDueDateButton");


const taskDueTime =
  document.getElementById("taskDueTime");
const taskDueTimeButton =
  document.getElementById("taskDueTimeButton");
const taskDueTimeDisplay =
  document.getElementById("taskDueTimeDisplay");
const taskCategory = document.getElementById("taskCategory");
const taskPriorityNormal =
  document.getElementById("taskPriorityNormal");
const taskPriorityImportant =
  document.getElementById("taskPriorityImportant");
const taskLocation =
  document.getElementById("taskLocation");
const taskDescription = document.getElementById("taskDescription");
const backLink = document.querySelector(".task-detail-back");
const notificationButton =
  document.getElementById("notificationButton");
const notificationButtonContent =
  document.getElementById(
    "notificationButtonContent"
  );
const notificationSheetOverlay =
  document.getElementById(
    "notificationSheetOverlay"
  );

const notificationSheet =
  document.getElementById(
    "notificationSheet"
  );

const closeNotificationSheetButton =
  document.getElementById(
    "closeNotificationSheetButton"
  );

const notificationSheetItems =
  document.querySelectorAll(
    ".notification-sheet-item"
  );
  const saveTaskButton =
  document.getElementById("saveTaskButton");
const completeTaskButton =
  document.getElementById("completeTaskButton");
const deleteTaskButton =
  document.getElementById("deleteTaskButton");

let originalTaskState = null;
let isSaving = false;

function updateNotificationButton() {
  const isOn =
    taskNotification.value !== "none";

  const notificationText = {
  none: "通知なし",
  at_time: "予定時刻",
  "10_minutes_before": "10分前",
  "30_minutes_before": "30分前",
  "1_hour_before": "1時間前",
  day_before: "前日",
}[taskNotification.value] || "通知なし";

  notificationButtonContent.textContent =
    notificationText;

  notificationButton.setAttribute(
    "aria-pressed",
    String(isOn)
  );

  notificationButton.setAttribute(
    "aria-label",
    isOn
      ? "通知をオフにする"
      : "通知をオンにする"
  );
}

async function loadTask() {
  console.log("loadTask started");
  const taskId = getTaskId();

  if (!taskId) {
    showError("タスクIDを取得できませんでした。");
    return;
  }

  try {
    const res = await fetch(`/api/tasks/${taskId}`);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("タスクが見つかりません。");
      }

      throw new Error(`タスク取得失敗: ${res.status}`);
    }

    const task = await res.json();

    renderTask(task);
  } catch (error) {
    console.error(error);
    showError(error.message || "タスクを読み込めませんでした。");
  }
}

function getTaskId() {
  const pathParts = location.pathname
    .split("/")
    .filter(Boolean);

  if (
    pathParts.length !== 2 ||
    pathParts[0] !== "tasks"
  ) {
    return null;
  }

  return pathParts[1];
}

const taskDueDateDisplay =
  document.getElementById("taskDueDateDisplay");

function updateDateTimeState() {
  const hasDate = Boolean(taskDueDate.value);

  taskDueDateDisplay.textContent = hasDate
    ? taskDueDate.value.replaceAll("-", "/")
    : "yyyy/mm/dd";

  taskDueDateDisplay.classList.toggle(
    "is-placeholder",
    !hasDate
  );

  const hasTime = Boolean(taskDueTime.value);

  taskDueTimeDisplay.textContent = hasTime
    ? taskDueTime.value
    : "00:00";

  taskDueTimeDisplay.classList.toggle(
    "is-placeholder",
    !hasTime
  );

  const requiresTimeValues = [
    "at_time",
    "10_minutes_before",
    "30_minutes_before",
    "1_hour_before",
  ];

  if (
    !hasTime &&
    requiresTimeValues.includes(
      taskNotification.value
    )
  ) {
    taskNotification.value = "none";
    updateNotificationButton();
  }
}

function openDateTimePicker(input) {
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }

  input.click();
}

taskDueDateButton.addEventListener("click", () => {
  openDateTimePicker(taskDueDate);
});

taskDueTimeButton.addEventListener("click", () => {
  openDateTimePicker(taskDueTime);
});

function renderTask(task) {
  taskTypeTask.checked = true;
  taskTypeEvent.checked = false;
  taskTitle.value = task.title || "";
  taskDueDate.value = task.due_date || "";
  taskDueTime.value = task.due_time || "";
  taskCategory.value = task.category || "other";
  const isImportant =
  task.priority === "high" ||
  task.priority === "important";

taskPriorityImportant.checked = isImportant;
taskPriorityNormal.checked = !isImportant;

taskLocation.value =
  task.location || "";

taskDescription.value =
  task.description || "";

taskNotification.value =
  task.notification || "none";

  updateDateTimeState();

  originalTaskState = getTaskFormState();

  updateNotificationButton();

  taskStatus.hidden = true;
  taskForm.hidden = false;
}

taskDueDate.addEventListener(
  "change",
  updateDateTimeState
);

taskDueTime.addEventListener(
  "change",
  updateDateTimeState
);

taskNotification.addEventListener(
  "change",
  updateNotificationButton
);

function openNotificationSheet() {
  const hasDueTime =
    Boolean(taskDueTime.value);

  const requiresTimeValues = [
    "at_time",
    "10_minutes_before",
    "30_minutes_before",
    "1_hour_before",
  ];

  notificationSheetItems.forEach((item) => {
    const requiresTime =
      requiresTimeValues.includes(
        item.dataset.notificationValue
      );

    item.disabled =
      requiresTime && !hasDueTime;
  });

  notificationSheetOverlay.hidden = false;
  notificationSheet.hidden = false;
}

function closeNotificationSheet() {
  notificationSheetOverlay.hidden = true;
  notificationSheet.hidden = true;
}

notificationButton.addEventListener(
  "click",
  openNotificationSheet
);

notificationSheetOverlay.addEventListener(
  "click",
  closeNotificationSheet
);

closeNotificationSheetButton.addEventListener(
  "click",
  closeNotificationSheet
);

notificationSheetItems.forEach((item) => {
  item.addEventListener("click", () => {
    const value =
      item.dataset.notificationValue;

    if (!value) {
      return;
    }

    taskNotification.value = value;

    updateNotificationButton();
    closeNotificationSheet();
  });
});

function getTaskFormState() {
  return {
    taskType:
      taskTypeEvent.checked
        ? "event"
        : "task",

    title:
      taskTitle.value.trim(),

    dueDate:
      taskDueDate.value || null,

    dueTime:
      taskDueTime.value || null,

    category:
      taskCategory.value,

    priority:
      taskPriorityImportant.checked
        ? "important"
        : "normal",

    location:
      taskLocation.value.trim(),

    description:
      taskDescription.value.trim(),

    notification:
      taskNotification.value,
  };
}

function hasTaskChanged() {
  if (!originalTaskState) {
    return false;
  }

  return (
    JSON.stringify(getTaskFormState()) !==
    JSON.stringify(originalTaskState)
  );
}

async function saveTask() {
  console.log("saveTask called");
  console.log("changed:", hasTaskChanged());
  console.log(getTaskFormState());

  if (!hasTaskChanged() || isSaving) {
    return true;
  }

  const taskId = getTaskId();

  if (!taskId) {
    return false;
  }

  try {
    isSaving = true;

    const updates = getTaskFormState();

    const isConvertingToEvent =
  updates.taskType === "event";

const endpoint = isConvertingToEvent
  ? `/api/tasks/${taskId}/convert-to-event`
  : `/api/tasks/${taskId}`;

const res = await fetch(endpoint, {
  method: isConvertingToEvent
    ? "POST"
    : "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);

      throw new Error(
        result?.error || `タスク更新失敗: ${res.status}`
      );
    }

    originalTaskState = getTaskFormState();

    return true;
  } catch (error) {
    console.error(error);
    alert("タスクを保存できませんでした。");

    return false;
  } finally {
    isSaving = false;
  }
}

completeTaskButton.addEventListener("click", async () => {
  const taskId = getTaskId();

  if (!taskId) {
    alert("タスクIDを取得できませんでした。");
    return;
  }

  try {
    completeTaskButton.disabled = true;
    completeTaskButton.textContent = "完了中...";

    const res = await fetch(
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

    location.href = "/tasks";
  } catch (error) {
    console.error(error);

    completeTaskButton.disabled = false;
    completeTaskButton.textContent = "✓ 完了にする";

    alert("タスクを完了できませんでした。");
  }
});

deleteTaskButton.addEventListener("click", async () => {
  const taskId = getTaskId();

  if (!taskId) {
    alert("タスクIDを取得できませんでした。");
    return;
  }

  const confirmed = confirm(
    `「${taskTitle.value}」を削除しますか？`
  );

  if (!confirmed) {
    return;
  }

  try {
    deleteTaskButton.disabled = true;
    deleteTaskButton.textContent = "削除中...";

    const res = await fetch(
      `/api/tasks/${taskId}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      throw new Error(
        `タスク削除失敗: ${res.status}`
      );
    }

    isSaving = true;
    location.href = "/tasks";
  } catch (error) {
    console.error(error);

    deleteTaskButton.disabled = false;
    deleteTaskButton.textContent = "削除";

    alert("タスクを削除できませんでした。");
  }
});

saveTaskButton.addEventListener("click", async () => {
  const isConvertingToEvent =
    taskTypeEvent.checked;

  saveTaskButton.disabled = true;
  saveTaskButton.textContent = "保存中...";

  const saved = await saveTask();

  if (!saved) {
    saveTaskButton.disabled = false;
    saveTaskButton.textContent = "変更を保存";
    return;
  }

  if (isConvertingToEvent) {
    location.href = "/calendar";
    return;
  }

  saveTaskButton.textContent = "保存しました";

  setTimeout(() => {
    saveTaskButton.disabled = false;
    saveTaskButton.textContent = "変更を保存";
  }, 1200);
});



backLink.addEventListener("click", async (event) => {
  event.preventDefault();

  const destination = backLink.href;
  const saved = await saveTask();

  if (saved) {
  location.href = taskTypeEvent.checked
    ? "/calendar"
    : destination;
}
});

window.addEventListener("beforeunload", (event) => {
  if (!hasTaskChanged() || isSaving) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

function showError(message) {
  taskForm.hidden = true;
  taskStatus.hidden = false;
  taskStatus.textContent = message;
}

loadTask();