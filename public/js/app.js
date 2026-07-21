const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");

function scrollChatToBottom() {
  if (!chat) {
    return;
  }

  requestAnimationFrame(() => {
    chat.scrollTop =
      chat.scrollHeight;
  });
}

function parseConversationDate(createdAt) {
  if (!createdAt) {
    return new Date();
  }

  if (createdAt instanceof Date) {
    return createdAt;
  }

  const normalized =
    String(createdAt).replace(" ", "T");

  const hasTimezone =
    normalized.endsWith("Z") ||
    /[+-]\d{2}:\d{2}$/.test(normalized);

  return new Date(
    hasTimezone
      ? normalized
      : `${normalized}Z`
  );
}

function formatConversationDate(createdAt) {
  const date =
    parseConversationDate(createdAt);

  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  const targetDate =
  date.toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );
  const todayDate = today.toLocaleDateString("sv-SE");
  const yesterdayDate =
    yesterday.toLocaleDateString("sv-SE");

  if (targetDate === todayDate) {
    return "今日";
  }

  if (targetDate === yesterdayDate) {
    return "昨日";
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function addDateSeparator(createdAt) {
  const separator =
    document.createElement("div");

  separator.className =
    "date-separator";

  separator.innerText =
    formatConversationDate(createdAt);

  chat.appendChild(separator);
}

function addMessage(
  role,
  text,
  createdAt = null
) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    `message-wrapper ${role}`;

  const message =
    document.createElement("div");

  message.className = `message ${role}`;
  message.innerText = text;

  // ユーザー発言だけ時刻を表示
  if (role === "user" && createdAt) {
    const time =
      document.createElement("div");

    time.className = "message-time";

    const date =
  parseConversationDate(createdAt);

    time.innerText =
  date.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

    // LINEと同じく、時刻を吹き出しの左側へ
    wrapper.appendChild(time);
  }

  wrapper.appendChild(message);
  chat.appendChild(wrapper);

scrollChatToBottom();
}

async function loadConversationHistory() {
  try {
    const res = await fetch("/api/conversations");

    if (!res.ok) {
      throw new Error(
        `履歴取得失敗: ${res.status}`
      );
    }

    const conversations = await res.json();

    chat.innerHTML = "";

    let lastDate = null;

conversations.forEach((conversation) => {
  const currentDate =
  parseConversationDate(
    conversation.created_at
  ).toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );

  if (currentDate !== lastDate) {
    addDateSeparator(
      conversation.created_at
    );

    lastDate = currentDate;
  }

  addMessage(
    conversation.role,
    conversation.message,
    conversation.created_at
  );
});

   scrollChatToBottom(); 
  } catch (error) {
    console.error(
      "会話履歴の読み込みに失敗しました。",
      error
    );
  }
}


chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  addMessage(
  "user",
  message,
  new Date()
);
  messageInput.value = "";


  const loading = document.createElement("div");
  loading.className = "message assistant";
  loading.innerText = "確認しています。少しだけお待ちください。";
  scrollChatToBottom();

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
    addMessage("assistant", data.reply, new Date());
    
    
  } catch (error) {
    loading.remove();
    addMessage("assistant", "すみません。少し調子が悪いようです。");
  }
});

function showNotification(
  title,
  body
) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  new Notification(title, {
    body,
  });
}

function connectNotificationStream() {
  console.log("connectNotificationStream called");
  const eventSource = new EventSource(
    "/api/notifications/stream"
  );

  eventSource.onopen = () => {
  console.log(
    "✅ Notification Stream Connected",
    eventSource.readyState
  );
};

eventSource.onmessage = (event) => {
  const data = JSON.parse(
    event.data
  );

  showNotification(
    data.title,
    data.body
  );

  addMessage(
    "assistant",
    `🔔 ${data.body}`,
    new Date()
  );
};

  eventSource.onerror = (error) => {
    console.error(
      "Notification Stream Error",
      error
    );
  };
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return;
  }

  const permission =
    await Notification.requestPermission();

  console.log(
    "通知許可:",
    permission
  );

  if (permission === "granted") {
  showNotification(
    "Notia",
    "通知の準備ができました。"
  );
}
}


requestNotificationPermission();

connectNotificationStream();

loadConversationHistory();