const taskList = document.getElementById("taskList");

async function loadTasks() {
  const res = await fetch("/api/tasks");
  const tasks = await res.json();

  taskList.innerHTML = "";

  if (tasks.length === 0) {
    taskList.innerHTML = `<p class="empty">未完了タスクはありません。</p>`;
    return;
  }

  tasks.forEach((task) => {
    const div = document.createElement("div");
    div.className = "task";

    div.innerHTML = `
      <div>
        <strong>${task.title}</strong>
        ${task.due_date ? `<p>期日：${task.due_date}</p>` : `<p>期日：期限なし</p>`}
        ${task.due_date_label ? `<p>表示：${task.due_date_label}</p>` : ""}
        ${task.description ? `<p>${task.description}</p>` : ""}
      </div>
      <button data-id="${task.id}">完了</button>
    `;

    div.querySelector("button").addEventListener("click", async () => {
      await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
      });
      await loadTasks();
    });

    taskList.appendChild(div);
  });
}

loadTasks();