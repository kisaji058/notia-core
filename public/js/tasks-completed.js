const completedTaskList =
  document.getElementById("completedTaskList");

async function loadCompletedTasks() {
  try {
    completedTaskList.innerHTML = `
      <p class="task-status">読み込み中...</p>
    `;

    const res = await fetch("/api/tasks/completed");

    if (!res.ok) {
      throw new Error(
        `完了タスク取得失敗: ${res.status}`
      );
    }

    const tasks =
  await res.json();

completedTaskList.innerHTML = "";

if (
  !Array.isArray(tasks) ||
  tasks.length === 0
) {
      completedTaskList.innerHTML = `
        <p class="completed-empty">
          完了したタスクはありません。
        </p>
      `;
      return;
    }

    tasks.forEach((task) => {
      const priorityIcon =
  priorityIcons[task.priority] ??
  priorityIcons.normal;

const card = createTaskCard(task, {
  variant: "completed",
  priorityIcon,
  dueDateText: formatCompletedDate(
    task.completed_at
  ),
  categoryText: getCategoryLabel(
    task.category
  ),
});

      const restoreButton =
        card.querySelector(".restore-button");

      restoreButton.addEventListener(
        "click",
        async () => {
          await restoreTask(task.id, restoreButton);
        }
      );

      completedTaskList.appendChild(card);
    });
  } catch (error) {
    console.error(error);

    completedTaskList.innerHTML = `
      <div class="error-state">
        <p>完了タスクを読み込めませんでした。</p>

        <button
          type="button"
          id="retryCompletedButton"
        >
          再読み込み
        </button>
      </div>
    `;

    document
      .getElementById("retryCompletedButton")
      ?.addEventListener(
        "click",
        loadCompletedTasks
      );
  }
}

async function restoreTask(taskId, button) {
  try {
    button.disabled = true;
    button.textContent = "復元中...";

    const res = await fetch(
      `/api/tasks/${taskId}/restore`,
      {
        method: "POST",
      }
    );

    if (!res.ok) {
      const result = await res
        .json()
        .catch(() => null);

      throw new Error(
        result?.error ||
          `復元失敗: ${res.status}`
      );
    }

    await loadCompletedTasks();
  } catch (error) {
    console.error(error);
    alert("タスクを復元できませんでした。");

    button.disabled = false;
    button.textContent = "復元";
  }
}

loadCompletedTasks();