const taskStatus = document.getElementById("taskStatus");
const taskForm = document.getElementById("taskForm");
const taskNotification = document.getElementById("taskNotification");

const taskTitle = document.getElementById("taskTitle");
const taskDueDate = document.getElementById("taskDueDate");
const taskDueTime = document.getElementById("taskDueTime");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");
const taskDescription = document.getElementById("taskDescription");
const backLink = document.querySelector(".task-detail-back");
const notificationButton =
  document.getElementById("notificationButton");

let originalTaskState = null;
let isSaving = false;

function updateNotificationButton() {
  const isOn = taskNotification.value !== "none";

  notificationButton.textContent = isOn ? "🔔" : "🔕";

  notificationButton.setAttribute(
    "aria-pressed",
    String(isOn)
  );
}

async function loadTask() {
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

function renderTask(task) {
  taskTitle.value = task.title || "";
  taskDueDate.value = task.due_date || "";
  taskDueTime.value = task.due_time || "";
  taskCategory.value = task.category || "other";
  taskPriority.value = task.priority || "normal";
  taskDescription.value = task.description || "";
  taskNotification.value = task.notification || "none";

  originalTaskState = getTaskFormState();

  updateNotificationButton();

  taskStatus.hidden = true;
  taskForm.hidden = false;
}

taskNotification.addEventListener(
  "change",
  updateNotificationButton
);

notificationButton.addEventListener("click", () => {
  if (taskNotification.value === "none") {
    taskNotification.value = "same_day";
  } else {
    taskNotification.value = "none";
  }

  updateNotificationButton();
});

function getTaskFormState() {
  return {
    title: taskTitle.value.trim(),
    dueDate: taskDueDate.value || null,
    dueTime: taskDueTime.value || null,
    category: taskCategory.value,
    priority: taskPriority.value,
    description: taskDescription.value.trim(),
    notification: taskNotification.value,
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

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
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

backLink.addEventListener("click", async (event) => {
  event.preventDefault();

  const destination = backLink.href;
  const saved = await saveTask();

  if (saved) {
    location.href = destination;
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