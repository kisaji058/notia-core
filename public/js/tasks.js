const completedTaskList = document.getElementById("completedTaskList");
const taskList = document.getElementById("taskList");

const priorityIcons = {
  high: "🔴",
  normal: "🟡",
  low: "🟢",
};

async function loadTasks() {
  try {
    taskList.innerHTML = `<p class="task-status">読み込み中...</p>`;

    const res = await fetch("/api/tasks");

    if (!res.ok) {
      throw new Error(`タスク取得失敗: ${res.status}`);
    }

    const tasks = await res.json();

    taskList.innerHTML = "";

    if (tasks.length === 0) {
      taskList.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">未完了タスクはありません。</p>
          <p class="empty-message">
            チャットで話しかけると、Notiaがタスクを登録します。
          </p>
        </div>
      `;
      return;
    }

    tasks.forEach((task) => {
      const card = document.createElement("article");
      card.className = "task-card";

      const priorityIcon =
        priorityIcons[task.priority] ?? priorityIcons.normal;
        card.innerHTML = `
  <div class="task-info" role="button" tabindex="0">
    <div class="task-title">
      <span class="priority-icon">${priorityIcon}</span>
      <span>${escapeHtml(task.title)}</span>
    </div>

    <div class="task-meta">
      <span class="task-date">
        ${formatDueDate(task.due_date)}
      </span>

      <span class="task-category">
        ${escapeHtml(getCategoryLabel(task.category))}
      </span>
    </div>
  </div>

  <div class="task-actions">
    <button
      type="button"
      class="complete-button"
      aria-label="${escapeHtml(task.title)}を完了する"
    >
      完了
    </button>

    <button
      type="button"
      class="delete-button"
      aria-label="${escapeHtml(task.title)}を削除する"
    >
      🗑
    </button>
  </div>
`;

      const taskInfo = card.querySelector(".task-info");
      const completeButton = card.querySelector(".complete-button");
      const deleteButton = card.querySelector(".delete-button");

      taskInfo.addEventListener("click", () => {
        location.href = `/tasks/${task.id}`;
      });

      taskInfo.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          location.href = `/tasks/${task.id}`;
        }
      });

      completeButton.addEventListener("click", async () => {
  await completeTask(task.id, completeButton);
});



      deleteButton.addEventListener("click", async () => {
        await deleteTask(task, deleteButton);
      });

      taskList.appendChild(card);
    });
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

async function completeTask(taskId, button) {
  try {
    button.disabled = true;

    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(`タスク完了失敗: ${res.status}`);
    }

    await Promise.all([
  loadTasks(),
  loadCompletedTasks(),
]);
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

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "期限なし";
  }

  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const dueDateObj = new Date(`${dueDate}T00:00:00+09:00`);

  const diffDays = Math.round(
    (dueDateObj - todayDate) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `期限超過（${Math.abs(diffDays)}日）`;
  }

  if (diffDays === 0) {
    return "本日中";
  }

  if (diffDays === 1) {
    return "明日";
  }

  if (diffDays === 2) {
    return "明後日";
  }

  return dueDate;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCategoryLabel(category) {
  const categoryLabels = {
    work: "仕事",
    school: "学校",
    private: "プライベート",
    personal: "プライベート",
    shopping: "買い物",
    other: "その他",
  };

  if (!category) {
    return "その他";
  }

  return categoryLabels[category] ?? category;
}

async function loadTaskPage() {
  await Promise.all([
    loadTasks(),
    loadCompletedTasks(),
  ]);
}

loadTaskPage();

async function loadCompletedTasks() {
  if (!completedTaskList) {
    return;
  }

  try {
    completedTaskList.innerHTML = `
      <p class="task-status">読み込み中...</p>
    `;

    const res = await fetch("/api/tasks/completed/recent");

    if (!res.ok) {
      throw new Error(`完了タスク取得失敗: ${res.status}`);
    }

    const tasks = (await res.json()).slice(0, 2);

    completedTaskList.innerHTML = "";

    if (tasks.length === 0) {
      completedTaskList.innerHTML = `
        <p class="completed-empty">
          最近完了したタスクはありません。
        </p>
      `;
      return;
    }

    tasks.forEach((task) => {
      const card = document.createElement("article");
      card.className = "completed-task-card";

      const priorityIcon =
        priorityIcons[task.priority] ?? priorityIcons.normal;

      card.innerHTML = `
        <div class="completed-task-info">
          <div class="completed-task-title">
            <span class="priority-icon">${priorityIcon}</span>
            <span>${escapeHtml(task.title)}</span>
          </div>

          <div class="completed-task-meta">
            <span>${formatDueDate(task.due_date)}</span>

            <span class="task-category">
              ${escapeHtml(getCategoryLabel(task.category))}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="restore-button"
          aria-label="${escapeHtml(task.title)}を復元する"
        >
          復元
        </button>
      `;

      const restoreButton = card.querySelector(".restore-button");

      restoreButton.addEventListener("click", async () => {
        await restoreTask(task.id, restoreButton);
      });

      completedTaskList.appendChild(card);
    });
  } catch (error) {
    console.error(error);

    completedTaskList.innerHTML = `
      <div class="error-state">
        <p>完了タスクを読み込めませんでした。</p>
        <button type="button" id="retryCompletedButton">
          再読み込み
        </button>
      </div>
    `;

    document
      .getElementById("retryCompletedButton")
      .addEventListener("click", loadCompletedTasks);
  }
}

async function restoreTask(taskId, button) {
  try {
    button.disabled = true;

    const res = await fetch(`/api/tasks/${taskId}/restore`, {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(`タスク復元失敗: ${res.status}`);
    }

    await Promise.all([
      loadTasks(),
      loadCompletedTasks(),
    ]);
  } catch (error) {
    console.error(error);
    button.disabled = false;
    alert("タスクを復元できませんでした。");
  }
}