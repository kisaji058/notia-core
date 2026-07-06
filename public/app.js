const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const taskList = document.getElementById("taskList");

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

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
        ${task.due_date ? `<p>期限：${task.due_date}</p>` : ""}
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

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  addMessage("user", message);
  messageInput.value = "";

  const loading = document.createElement("div");
  loading.className = "message assistant";
  loading.innerText = "確認しています。少しだけお待ちください。";
  chat.appendChild(loading);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    loading.remove();
    addMessage("assistant", data.reply);

    await loadTasks();
  } catch (error) {
    loading.remove();
    addMessage("assistant", "すみません。少し調子が悪いようです。私にもそういう日があります。");
  }
});

loadTasks();