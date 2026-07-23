const taskPageParams =
  new URLSearchParams(
    window.location.search
  );

const requestedFilter =
  taskPageParams.get("filter");

const taskList = document.getElementById("taskList");
let allTasks = [];
let currentSort = "due_asc";
let currentFilter =
  requestedFilter === "overdue"
    ? "overdue"
    : "all";

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

function getSortedTasks(tasks) {
  const sortedTasks = [...tasks];

  if (currentSort === "priority") {
    const priorityRank = {
  important: 1,
  normal: 2,
  high: 1,
  low: 2,
};

    return sortedTasks.sort((a, b) => {
      return (
        (priorityRank[a.priority] ?? 2) -
        (priorityRank[b.priority] ?? 2)
      );
    });
  }

  if (currentSort === "newest") {
    return sortedTasks.sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  if (currentSort === "oldest") {
    return sortedTasks.sort((a, b) => {
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  // 期限が近い順
  return sortedTasks.sort((a, b) => {
    if (!a.due_date && !b.due_date) {
      return 0;
    }

    if (!a.due_date) {
      return 1;
    }

    if (!b.due_date) {
      return -1;
    }

    return a.due_date.localeCompare(b.due_date);
  });
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
    return tasks.filter(isOverdueTask);
  }

  return tasks.filter((task) => {
    return task.category === currentFilter;
  });
}

function refreshTaskList() {
  const filteredTasks =
    getFilteredTasks(allTasks);

  const sortedTasks =
    getSortedTasks(filteredTasks);

  renderTaskList(sortedTasks);
}

function renderTaskCard(task) {
  const priorityIcon =
  priorityIcons[task.priority] ??
  priorityIcons.normal;

const card =
  createTaskCard(task, {
    priorityIcon,
    dueDateText: formatDueDate(
      task.due_date
    ),
    categoryText:
      getCategoryLabel(
        task.category
      ),
    showActions: true,
  });


  const taskInfo = card.querySelector(".task-info");
  const completeButton =
    card.querySelector(".complete-button");
  const deleteButton =
    card.querySelector(".delete-button");

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
}

function renderTaskList(tasks) {
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
    renderTaskCard(task);
  });
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

const sortButton =
  document.getElementById("sortButton");

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

sortButton.addEventListener("click", () => {
  openSheet(
    "並び替え",
    `
      <button
        class="sheet-item"
        type="button"
        data-sort="due_asc"
      >
        期限が近い順
      </button>

      <button
        class="sheet-item"
        type="button"
        data-sort="priority"
      >
        優先度順
      </button>

      <button
        class="sheet-item"
        type="button"
        data-sort="newest"
      >
        新しい順
      </button>

      <button
        class="sheet-item"
        type="button"
        data-sort="oldest"
      >
        古い順
      </button>
    `
  );

  const sortItems =
    sheetContent.querySelectorAll("[data-sort]");

  sortItems.forEach((button) => {
    if (button.dataset.sort === currentSort) {
      button.classList.add("is-selected");
      button.setAttribute("aria-current", "true");
    }

    button.addEventListener("click", () => {
      currentSort = button.dataset.sort;

      refreshTaskList();
      closeSheet();
    });
  });
});

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
            初期並び替え
          </div>

          <div class="settings-description">
            ${getSortLabel(currentSort)}
          </div>
        </div>

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