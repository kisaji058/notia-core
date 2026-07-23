const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton =
  chatForm.querySelector(
    'button[type="submit"]'
  );
const todayNextSchedule =
  document.getElementById(
    "todayNextSchedule"
  );
let isSending = false;

function getJapanDateString(date = new Date()) {
  return date.toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );
}

function getJapanCurrentMinutes() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      }
    ).formatToParts(new Date());

  const hour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value
  );

  const minute = Number(
    parts.find(
      (part) => part.type === "minute"
    )?.value
  );

  return hour * 60 + minute;
}

function timeToMinutes(time) {
  if (!time) {
    return null;
  }

  const [hour, minute] =
    time.split(":").map(Number);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function getJapanTime(dateTime) {
  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );
}

async function loadTodayNextSchedule() {
  if (!todayNextSchedule) {
    return;
  }

  try {
    const today = getJapanDateString();

    const res = await fetch(
      `/api/calendar?date=${encodeURIComponent(today)}`
    );

    if (!res.ok) {
      throw new Error(
        `予定取得失敗: ${res.status}`
      );
    }

    const data = await res.json();
    const schedules = [];

    for (const task of data.tasks ?? []) {
      const minutes =
        timeToMinutes(task.due_time);

      if (minutes === null) {
        continue;
      }

      schedules.push({
        minutes,
        time: task.due_time.slice(0, 5),
        title:
          task.title ||
          task.task_name ||
          "名称未設定のタスク",
      });
    }

    for (
      const event of
      data.externalEvents ?? []
    ) {
      if (
        event.is_all_day === 1 ||
        !event.start_datetime
      ) {
        continue;
      }

      const time =
        getJapanTime(
          event.start_datetime
        );

      const minutes =
        timeToMinutes(time);

      if (minutes === null) {
        continue;
      }

      schedules.push({
        minutes,
        time,
        title:
          event.title ||
          "名称未設定の予定",
      });
    }

    const currentMinutes =
      getJapanCurrentMinutes();

    const nextSchedule = schedules
      .filter(
        (schedule) =>
          schedule.minutes >=
          currentMinutes
      )
      .sort(
        (a, b) =>
          a.minutes - b.minutes
      )[0];

    if (!nextSchedule) {
      todayNextSchedule.textContent =
        "今日の予定はありません。";
      return;
    }

    todayNextSchedule.textContent =
      `${nextSchedule.time}から「${nextSchedule.title}」です。`;
  } catch (error) {
    console.error(
      "Next schedule error:",
      error
    );

    todayNextSchedule.textContent =
      "予定を取得できませんでした。";
  }
}

const todaySummaryGreeting =
  document.getElementById(
    "todaySummaryGreeting"
  );

const todaySummaryDate =
  document.getElementById(
    "todaySummaryDate"
  );

function renderTodaySummary() {
  const now = new Date();
  const hour = now.getHours();

  if (todaySummaryGreeting) {
    let greeting;

    if (hour >= 5 && hour < 11) {
      greeting = "おはようございます";
    } else if (hour >= 11 && hour < 18) {
      greeting = "こんにちは";
    } else {
      greeting = "こんばんは";
    }

    todaySummaryGreeting.textContent =
      greeting;
  }

  if (todaySummaryDate) {
    todaySummaryDate.textContent =
  now.toLocaleDateString(
    "ja-JP",
    {
      month: "long",
      day: "numeric",
      weekday: "long",
    }
  );
  }
}

renderTodaySummary();
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
  createdAt = null,
  processingStatus = null
) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    `message-wrapper ${role}`;

  const message =
    document.createElement("div");

  message.className = `message ${role}`;
  message.innerText = text;

  let status = null;
let meta = null;


  // ユーザー発言だけ時刻と処理状況を表示
  if (role === "user" && createdAt) {
    meta =
  document.createElement("div");

    meta.className = "message-meta";

    const time =
      document.createElement("span");

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

    status =
      document.createElement("span");

    status.className =
      "message-processing-status";

    const statusImage =
  document.createElement("img");

statusImage.className =
  "message-processing-status-image";

statusImage.src =
  processingStatus === "completed"
    ? "/images/notia-double-check-overlap-transparent.png"
    : "/images/notia-single-check-transparent.png";

statusImage.alt =
  processingStatus === "completed"
    ? "処理完了"
    : "処理中";

status.appendChild(statusImage);

    meta.appendChild(time);
meta.appendChild(status);
}

if (role === "assistant") {
  const logo =
    document.createElement("img");

  logo.className =
    "message-assistant-logo";

  logo.src =
  "/images/notia-icon.png";

  logo.alt = "Notia";

  wrapper.appendChild(logo);
}

wrapper.appendChild(message);

if (meta) {
  wrapper.appendChild(meta);
}

chat.appendChild(wrapper);

  scrollChatToBottom();

  return {
    wrapper,
    status,
  };
}

function formatTaskDueDate(
  dueDate,
  dueTime
) {
  if (!dueDate) {
    return "期限なし";
  }

  const date = new Date(
    `${dueDate}T00:00:00+09:00`
  );

  const formattedDate =
    date.toLocaleDateString(
      "ja-JP",
      {
        month: "numeric",
        day: "numeric",
        weekday: "short",
        timeZone: "Asia/Tokyo",
      }
    );

  if (!dueTime) {
    return formattedDate;
  }

  return `${formattedDate} ${dueTime.slice(0, 5)}`;
}

function addCreatedTaskCard(task) {
  if (!task?.id) {
    return;
  }

  const cardWrapper =
    document.createElement("div");

  cardWrapper.className =
    "task-created-card-wrapper";

  const card =
    document.createElement("div");

  card.className =
    "task-created-card";

  const heading =
    document.createElement("p");

  heading.className =
    "task-created-card-heading";

  heading.textContent =
    "タスクを登録しました";

  const title =
    document.createElement("p");

  title.className =
    "task-created-card-title";

  title.textContent =
    task.title ||
    task.task_name ||
    "名称未設定のタスク";

  const due =
    document.createElement("p");

  due.className =
    "task-created-card-due";

  due.textContent =
    formatTaskDueDate(
      task.due_date ?? task.dueDate,
      task.due_time ?? task.dueTime
    );

  const detailLink =
    document.createElement("a");

  detailLink.className =
    "task-created-card-link";

  detailLink.href =
    `/tasks/${encodeURIComponent(task.id)}`;

  detailLink.textContent =
    "詳細を見る";

  card.appendChild(heading);
  card.appendChild(title);
  card.appendChild(due);
  card.appendChild(detailLink);

  cardWrapper.appendChild(card);
  chat.appendChild(cardWrapper);

  scrollChatToBottom();
}

function addCreatedTaskCards(taskResult) {
  if (
    !taskResult?.created ||
    !Array.isArray(
      taskResult.createdTasks
    )
  ) {
    return;
  }

  taskResult.createdTasks.forEach(
    (task) => {
      addCreatedTaskCard(task);
    }
  );
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
  conversation.created_at,
  conversation.role === "user"
    ? "completed"
    : null
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

if (!message || isSending) {
  return;
}

isSending = true;

sendButton.disabled = true;

  const sentMessage = addMessage(
  "user",
  message,
  new Date(),
  "processing"
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

if (sentMessage.status) {
  const statusImage =
    sentMessage.status.querySelector(
      ".message-processing-status-image"
    );

  if (statusImage) {
    statusImage.src =
      "/images/notia-double-check-overlap-transparent.png";

    statusImage.alt = "処理完了";
  }

  sentMessage.status.classList.add(
    "completed"
  );
}

loading.remove();

addMessage(
  "assistant",
  data.reply,
  new Date()
);

console.log(
  "taskResult:",
  data.taskResult
);

addCreatedTaskCards(
  data.taskResult
);
    
  } catch (error) {
    loading.remove();
    addMessage("assistant", "すみません。少し調子が悪いようです。");
    } finally {
  isSending = false;

  sendButton.disabled = false;
  messageInput.focus();
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

renderTodaySummary();
loadTodayNextSchedule();