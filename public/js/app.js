const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
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
    
  } catch (error) {
    loading.remove();
    addMessage("assistant", "すみません。少し調子が悪いようです。私にもそういう日があります。");
  }
});
