const chat = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const attachmentButton =
  document.querySelector(
    ".attachment-button"
  );

const attachmentInput =
  document.getElementById(
    "attachmentInput"
  );

let selectedAttachment = null;
const sendButton =
  chatForm.querySelector(
    'button[type="submit"]'
  );
const todayNextSchedule =
  document.getElementById(
    "todayNextSchedule"
  );
let isSending = false;

function clearAttachmentPreview() {
  selectedAttachment = null;

  if (attachmentInput) {
    attachmentInput.value = "";
  }

  document
    .querySelector(
      ".attachment-preview"
    )
    ?.remove();
}

function showAttachmentPreview(file) {
  document
    .querySelector(
      ".attachment-preview"
    )
    ?.remove();

  const preview =
    document.createElement("div");

  preview.className =
    "attachment-preview";

  const fileName =
    document.createElement("span");

  fileName.className =
    "attachment-preview-name";

  fileName.textContent =
    file.name;

  const removeButton =
    document.createElement("button");

  removeButton.type =
    "button";

  removeButton.className =
    "attachment-preview-remove";

  removeButton.setAttribute(
    "aria-label",
    "添付を解除"
  );

  removeButton.textContent = "×";

  removeButton.addEventListener(
    "click",
    () => {
      clearAttachmentPreview();
    }
  );

  preview.appendChild(
    fileName
  );

  preview.appendChild(
    removeButton
  );

  chatForm.insertBefore(
    preview,
    messageInput
  );
}

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

  const itemType =
  task.item_type ??
  task.itemType ??
  "task";

heading.textContent =
  itemType === "event"
    ? "予定を登録しました"
    : "タスクを登録しました";

  const title =
    document.createElement("p");

  title.className =
    "task-created-card-title";

  title.textContent =
  task.title ||
  task.task_name ||
  (
    itemType === "event"
      ? "名称未設定の予定"
      : "名称未設定のタスク"
  );

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

  if (itemType === "event") {
  const params =
    new URLSearchParams();

  params.set(
    "eventId",
    String(task.id)
  );

  const eventDate =
    task.due_date ??
    task.dueDate;

  if (eventDate) {
    params.set(
      "date",
      eventDate
    );
  }

  detailLink.href =
    NotiaRuntime.pageUrl(
      `/calendar?${params.toString()}`
    );
} else {
  detailLink.href =
    NotiaRuntime.pageUrl(
      `/tasks/${encodeURIComponent(
        task.id
      )}`
    );
}

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

function formatDocumentCandidateDate(
  date,
  time
) {
  if (!date) {
    return "日付未確定";
  }

  const parsed =
    new Date(
      `${date}T00:00:00+09:00`
    );

  const dateText =
    parsed.toLocaleDateString(
      "ja-JP",
      {
        month: "numeric",
        day: "numeric",
        weekday: "short",
        timeZone: "Asia/Tokyo",
      }
    );

  if (!time) {
    return dateText;
  }

  return `${dateText} ${time}`;
}

function refreshDocumentCandidateRow(
  row,
  item
) {
  const type =
    row.querySelector(
      ".document-candidate-type"
    );

  const title =
    row.querySelector(
      ".document-candidate-title"
    );

  const date =
    row.querySelector(
      ".document-candidate-date"
    );

  const details = [
    ...row.querySelectorAll(
      ".document-candidate-detail"
    ),
  ];

  details.forEach(
    (element) => element.remove()
  );

  if (type) {
    type.textContent =
      item.type === "event"
        ? "予定"
        : "タスク";
  }

  if (title) {
    title.textContent =
      item.title ||
      "名称未設定";
  }

  const candidateTime =
    item.type === "event"
      ? item.startTime
      : item.dueTime;

  if (date) {
    date.textContent =
      formatDocumentCandidateDate(
        item.date,
        candidateTime
      );
  }

  const body =
    row.querySelector(
      ".document-candidate-body"
    );

  if (!body) {
    return;
  }

  if (
    item.type === "event" &&
    item.location
  ) {
    const location =
      document.createElement("p");

    location.className =
      "document-candidate-detail";

    location.textContent =
      `場所：${item.location}`;

    body.appendChild(location);
  }

  if (item.description) {
    const description =
      document.createElement("p");

    description.className =
      "document-candidate-detail";

    description.textContent =
      item.description;

    body.appendChild(
      description
    );
  }
}

function openDocumentCandidateEditor(
  item,
  row
) {
  document
    .querySelector(
      ".document-editor-overlay"
    )
    ?.remove();

  const overlay =
    document.createElement("div");

  overlay.className =
    "document-editor-overlay";

  const modal =
    document.createElement("section");

  modal.className =
    "document-editor-modal";

  modal.innerHTML = `
    <div class="document-editor-header">
      <h2>
        ${
          item.type === "event"
            ? "予定を編集"
            : "タスクを編集"
        }
      </h2>

      <button
        type="button"
        class="document-editor-close"
        aria-label="閉じる"
      >
        ×
      </button>
    </div>

    <form
      class="document-editor-form"
    >
      <div class="document-editor-type-switch">
        <label>
          <input
            type="radio"
            name="documentItemType"
            value="task"
            ${
              item.type === "task"
                ? "checked"
                : ""
            }
          >
          <span>タスク</span>
        </label>

        <label>
          <input
            type="radio"
            name="documentItemType"
            value="event"
            ${
              item.type === "event"
                ? "checked"
                : ""
            }
          >
          <span>予定</span>
        </label>
      </div>

      <label
        class="document-sheet-label"
        for="documentTitle"
      >
        タイトル
      </label>

      <input
        id="documentTitle"
        class="document-sheet-input"
        name="title"
        type="text"
        required
      >

      <label
        class="document-sheet-label"
        for="documentDate"
      >
        日付
      </label>

      <input
        id="documentDate"
        class="document-sheet-input"
        name="date"
        type="date"
      >

      <div
        class="document-editor-event-only"
        data-event-field
      >
        <div class="document-editor-time-fields">
          <div>
            <label
              class="document-sheet-label"
              for="documentStartTime"
            >
              開始
            </label>

            <input
              id="documentStartTime"
              class="document-sheet-input"
              name="startTime"
              type="time"
            >
          </div>

          <div>
            <label
              class="document-sheet-label"
              for="documentEndTime"
            >
              終了
            </label>

            <input
              id="documentEndTime"
              class="document-sheet-input"
              name="endTime"
              type="time"
            >
          </div>
        </div>

        <p class="document-sheet-help">
          時間を空欄にすると終日予定になります。
        </p>
      </div>

      <section class="document-organize-card">
        <h3 class="document-organize-title">
          整理
        </h3>

        <div class="document-organize-row">
          <span class="document-organize-label">
            分類
          </span>

          <select
            class="document-organize-select"
            name="category"
          >
            <option value="work">
              仕事
            </option>

            <option value="school">
              学校
            </option>

            <option value="private">
              プライベート
            </option>

            <option value="shopping">
              買い物
            </option>

            <option value="other">
              その他
            </option>
          </select>
        </div>

        <div class="document-organize-row">
          <span class="document-organize-label">
            優先度
          </span>

          <div class="document-priority-switch">
            <label>
              <input
                type="radio"
                name="priority"
                value="normal"
              >
              <span>通常</span>
            </label>

            <label>
              <input
                type="radio"
                name="priority"
                value="important"
              >
              <span>重要</span>
            </label>
          </div>
        </div>

        <div class="document-organize-row">
          <span class="document-organize-label">
            通知
          </span>

          <select
            class="document-organize-select"
            name="notification"
          >
            <option value="none">
              通知なし
            </option>

            <option value="same_day">
              当日
            </option>

            <option value="at_time">
              時刻になったら
            </option>

            <option value="10_minutes_before">
              10分前
            </option>

            <option value="30_minutes_before">
              30分前
            </option>

            <option value="1_hour_before">
              1時間前
            </option>

            <option value="day_before">
              前日
            </option>
          </select>
        </div>
      </section>

      <div
        class="document-editor-event-only"
        data-event-field
      >
        <label
          class="document-sheet-label"
          for="documentLocation"
        >
          場所
        </label>

        <input
          id="documentLocation"
          class="document-sheet-input"
          name="location"
          type="text"
          placeholder="場所"
        >
      </div>

      <label
        class="document-sheet-label"
        for="documentDescription"
      >
        備考
      </label>

      <textarea
        id="documentDescription"
        class="document-sheet-input document-sheet-textarea"
        name="description"
        rows="5"
      ></textarea>

      <div class="document-editor-actions">
        <button
          type="button"
          class="document-editor-cancel"
        >
          キャンセル
        </button>

        <button
          type="submit"
          class="document-editor-save"
        >
          保存
        </button>
      </div>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const form =
    modal.querySelector(
      ".document-editor-form"
    );

  const titleInput =
    form.elements.title;

  const dateInput =
    form.elements.date;

  const startTimeInput =
    form.elements.startTime;

  const endTimeInput =
    form.elements.endTime;

  const locationInput =
    form.elements.location;

  const descriptionInput =
    form.elements.description;

  const categoryInput =
    form.elements.category;

  const notificationInput =
    form.elements.notification;

  titleInput.value =
    item.title || "";

  dateInput.value =
    item.date || "";

  startTimeInput.value =
    item.startTime || "";

  endTimeInput.value =
    item.endTime || "";

  locationInput.value =
    item.location || "";

  descriptionInput.value =
    item.description || "";

  categoryInput.value =
    item.category || "other";

  notificationInput.value =
    item.notification || "none";

  const priority =
    item.priority || "normal";

  const priorityInput =
    form.querySelector(
      `input[name="priority"][value="${priority}"]`
    );

  if (priorityInput) {
    priorityInput.checked = true;
  }

  function updateEditorTypeUI() {
    const type =
      form.elements
        .documentItemType
        .value;

    const isEvent =
      type === "event";

    modal
      .querySelectorAll(
        "[data-event-field]"
      )
      .forEach((field) => {
        field.hidden =
          !isEvent;
      });

    const heading =
      modal.querySelector(
        ".document-editor-header h2"
      );

    if (heading) {
      heading.textContent =
        isEvent
          ? "予定を編集"
          : "タスクを編集";
    }
  }

  form
    .querySelectorAll(
      'input[name="documentItemType"]'
    )
    .forEach((input) => {
      input.addEventListener(
        "change",
        updateEditorTypeUI
      );
    });

  updateEditorTypeUI();

  function closeEditor() {
    overlay.remove();
  }

  modal
    .querySelector(
      ".document-editor-close"
    )
    .addEventListener(
      "click",
      closeEditor
    );

  modal
    .querySelector(
      ".document-editor-cancel"
    )
    .addEventListener(
      "click",
      closeEditor
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeEditor();
      }
    }
  );

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const type =
        form.elements
          .documentItemType
          .value;

      item.type =
        type;

      item.title =
        titleInput.value.trim();

      item.date =
        dateInput.value || null;

      item.category =
        categoryInput.value;

      item.priority =
        form.elements.priority.value;

      item.notification =
        notificationInput.value;

      item.description =
        descriptionInput.value.trim();

      if (type === "event") {
        item.startTime =
          startTimeInput.value ||
          null;

        item.endTime =
          endTimeInput.value ||
          null;

        item.location =
          locationInput.value.trim() ||
          null;

        item.dueTime = null;
      } else {
        item.startTime = null;
        item.endTime = null;
        item.location = null;
        item.dueTime = null;
      }

      refreshDocumentCandidateRow(
        row,
        item
      );

      closeEditor();
    }
  );
}

async function registerDocumentCandidate(
  item
) {
  if (!item) {
    throw new Error(
      "登録データがありません。"
    );
  }

  let endpoint;
  let body;

  if (item.type === "event") {
    if (!item.date) {
      throw new Error(
        "予定の日付が未確定です。"
      );
    }

    endpoint = "/api/events";

    body = {
      title:
        String(
          item.title || ""
        ).trim(),

      description:
        String(
          item.description || ""
        ).trim(),

      eventDate:
        item.date,

      startTime:
        item.startTime || null,

      endTime:
        item.endTime || null,

      location:
        String(
          item.location || ""
        ).trim(),

      priority:
  item.priority || "normal",

category:
  item.category || "other",
      notification:
  item.notification || "none",
    };
  } else {
    endpoint = "/api/tasks";

    body = {
      title:
        String(
          item.title || ""
        ).trim(),

      description:
        String(
          item.description || ""
        ).trim(),

      due_date:
        item.date || null,

      due_time:
        item.dueTime || null,

      priority:
  item.priority || "normal",

category:
  item.category || "other",

notification:
  item.notification || "none",
  
    };
  }

  const res =
    await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(body),
      }
    );

  const data =
    await res.json();

  if (!res.ok) {
    throw new Error(
      data.error ||
        "登録に失敗しました。"
    );
  }

  return data;
}

function addDocumentCandidateCards(
  items,
  warnings = []
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    addMessage(
      "assistant",
      "資料から登録できそうな予定やタスクは見つかりませんでした。",
      new Date()
    );

    return;
  }

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "document-candidates-wrapper";

  const card =
    document.createElement("div");

  card.className =
    "document-candidates-card";

  const heading =
    document.createElement("p");

  heading.className =
    "document-candidates-heading";

  heading.textContent =
    `資料から${items.length}件見つかりました`;

  const subtext =
    document.createElement("p");

  subtext.className =
    "document-candidates-subtext";

  subtext.textContent =
    "内容を確認してから追加できます。";

  const list =
    document.createElement("div");

  list.className =
    "document-candidates-list";

  items.forEach(
    (item, index) => {
      const row =
        document.createElement("div");

      row.className =
        "document-candidate-item";

      row.dataset.index =
        String(index);

      row.addEventListener(
  "click",
  (event) => {
    if (
      event.target.closest(
        ".document-candidate-add"
      )
    ) {
      return;
    }

    if (
      row.dataset.registered ===
      "true"
    ) {
      return;
    }

    openDocumentCandidateEditor(
      item,
      row
    );
  }
);

      const type =
        document.createElement("span");

      type.className =
        "document-candidate-type";

      const body =
        document.createElement("div");

      body.className =
        "document-candidate-body";

      const title =
        document.createElement("p");

      title.className =
        "document-candidate-title";

      const date =
        document.createElement("p");

      date.className =
        "document-candidate-date";

      body.appendChild(title);
      body.appendChild(date);

      const addButton =
  document.createElement("button");

addButton.type =
  "button";

addButton.className =
  "document-candidate-add";

addButton.textContent =
  "追加";

addButton.addEventListener(
  "click",
  async (event) => {
    event.stopPropagation();

    if (
      row.dataset.registered ===
      "true"
    ) {
      return;
    }

    addButton.disabled = true;
    addButton.textContent =
      "追加中…";

    try {
      await registerDocumentCandidate(
        item
      );

      row.dataset.registered =
        "true";

      row.classList.add(
        "registered"
      );

      addButton.textContent =
        "追加済み";

      addButton.classList.add(
        "registered"
      );
    } catch (error) {
      console.error(
        "Document candidate registration error:",
        error
      );

      addButton.disabled =
        false;

      addButton.textContent =
        "追加";

      alert(
        error.message ||
          "登録に失敗しました。"
      );
    }
  }
);

row.appendChild(type);
row.appendChild(body);
row.appendChild(addButton);

refreshDocumentCandidateRow(
  row,
  item
);

list.appendChild(row);

    }
  );

  const actions =
    document.createElement("div");

  actions.className =
    "document-candidates-actions";

  const addAllButton =
  document.createElement("button");

addAllButton.type =
  "button";

addAllButton.className =
  "document-candidates-primary";

addAllButton.textContent =
  "全部追加";

const cancelButton =
  document.createElement("button");

cancelButton.type =
  "button";

cancelButton.className =
  "document-candidates-secondary";

cancelButton.textContent =
  "キャンセル";

addAllButton.addEventListener(
  "click",
  async () => {
    const rows = [
      ...list.querySelectorAll(
        ".document-candidate-item"
      ),
    ];

    const targets =
      rows.filter(
        (row) =>
          row.dataset.registered !==
          "true"
      );

    if (targets.length === 0) {
      return;
    }

    addAllButton.disabled = true;
    addAllButton.textContent =
      "追加中…";

    let successCount = 0;
    let failureCount = 0;

    for (const row of targets) {
      const index =
        Number(
          row.dataset.index
        );

      const item =
        items[index];

      const button =
        row.querySelector(
          ".document-candidate-add"
        );

      try {
        if (button) {
          button.disabled = true;
          button.textContent =
            "追加中…";
        }

        await registerDocumentCandidate(
          item
        );

        row.dataset.registered =
          "true";

        row.classList.add(
          "registered"
        );

        if (button) {
          button.textContent =
            "追加済み";

          button.classList.add(
            "registered"
          );
        }

        successCount += 1;
      } catch (error) {
        console.error(
          "Document candidate registration error:",
          error
        );

        failureCount += 1;

        if (button) {
          button.disabled = false;
          button.textContent =
            "追加";
        }
      }
    }

    addAllButton.disabled =
      false;

    const remaining =
      rows.filter(
        (row) =>
          row.dataset.registered !==
          "true"
      ).length;

    addAllButton.textContent =
      remaining === 0
        ? "追加済み"
        : "残りを全部追加";

    if (failureCount === 0) {
      addMessage(
        "assistant",
        `${successCount}件を追加しました。`,
        new Date()
      );
    } else {
      addMessage(
        "assistant",
        `${successCount}件を追加しました。${failureCount}件は追加できませんでした。`,
        new Date()
      );
    }
  }
);

cancelButton.addEventListener(
  "click",
  () => {
    wrapper.remove();

    addMessage(
      "assistant",
      "資料からの追加をキャンセルしました。",
      new Date()
    );
  }
);

actions.appendChild(
  addAllButton
);

actions.appendChild(
  cancelButton
);

  card.appendChild(heading);
  card.appendChild(subtext);
  card.appendChild(list);

  if (
    Array.isArray(warnings) &&
    warnings.length > 0
  ) {
    const warning =
      document.createElement("p");

    warning.className =
      "document-candidates-warning";

    warning.textContent =
      warnings.join("\n");

    card.appendChild(
      warning
    );
  }

  card.appendChild(actions);

  wrapper.appendChild(card);
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

attachmentButton?.addEventListener(
  "click",
  () => {
    if (isSending) {
      return;
    }

    attachmentInput?.click();
  }
);

attachmentInput?.addEventListener(
  "change",
  () => {
    const file =
      attachmentInput.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "application/pdf",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      alert(
        "PNG、JPEG、PDFのみ添付できます。"
      );

      clearAttachmentPreview();
      return;
    }

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        "ファイルサイズは10MB以下にしてください。"
      );

      clearAttachmentPreview();
      return;
    }

    selectedAttachment =
      file;

    showAttachmentPreview(
      file
    );
  }
);

chatForm.addEventListener(
  "submit",
  async (e) => {
    e.preventDefault();

    const message =
      messageInput.value.trim();

    const attachment =
      selectedAttachment;

    if (
      (!message && !attachment) ||
      isSending
    ) {
      return;
    }

    isSending = true;
    sendButton.disabled = true;

    let sentMessage = null;

    if (message) {
      sentMessage = addMessage(
        "user",
        message,
        new Date(),
        "processing"
      );
    }

    messageInput.value = "";

    const loading =
      document.createElement("div");

    loading.className =
      "message assistant";

    loading.innerText =
      attachment
        ? "資料を確認しています。少しだけお待ちください。"
        : "確認しています。少しだけお待ちください。";

    chat.appendChild(loading);

    scrollChatToBottom();

    try {
      /*
       * =====================
       * 添付ファイルあり
       * =====================
       */
      if (attachment) {
        const formData =
          new FormData();

        formData.append(
          "file",
          attachment
        );

        if (message) {
          formData.append(
            "message",
            message
          );
        }

        const res =
          await fetch(
            "/api/document/extract",
            {
              method: "POST",
              body: formData,
            }
          );

        const data =
          await res.json();

        if (!res.ok) {
          if (
            data?.code ===
            "DOCUMENT_PAGE_LIMIT_REACHED"
          ) {
            loading.remove();

            const limit =
              data?.usage?.limit;

            if (limit === 3) {
              window.NotiaPaywall?.open({
                reason:
                  "document-free-limit",
              });

              return;
            }

            if (limit === 30) {
              window.NotiaPaywall?.open({
                reason:
                  "document-standard-limit",
              });

              return;
            }
          }

          throw new Error(
            data.error ||
              "資料の送信に失敗しました。"
          );
        }

        if (
          sentMessage?.status
        ) {
          const statusImage =
            sentMessage.status.querySelector(
              ".message-processing-status-image"
            );

          if (statusImage) {
            statusImage.src =
              "/images/notia-double-check-overlap-transparent.png";

            statusImage.alt =
              "処理完了";
          }

          sentMessage.status.classList.add(
            "completed"
          );
        }

        loading.remove();

        addMessage(
  "assistant",
  `${data.file.name}を確認しました。`,
  new Date()
);

addDocumentCandidateCards(
  data.items,
  data.warnings
);

clearAttachmentPreview();

return;
      }

      /*
       * =====================
       * 通常チャット
       * =====================
       */
      const res =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              message,
            }),
          }
        );

      const data =
        await res.json();

      if (sentMessage?.status) {
        const statusImage =
          sentMessage.status.querySelector(
            ".message-processing-status-image"
          );

        if (statusImage) {
          statusImage.src =
            "/images/notia-double-check-overlap-transparent.png";

          statusImage.alt =
            "処理完了";
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
      console.error(
        "Chat send error:",
        error
      );

      loading.remove();

      addMessage(
        "assistant",
        attachment
          ? "すみません。資料を読み込めませんでした。"
          : "すみません。少し調子が悪いようです。",
        new Date()
      );
    } finally {
      isSending = false;

      sendButton.disabled =
        false;

      messageInput.focus();
    }
  }
);

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

function handleNotificationStreamData(
  rawData
) {
  try {
    const data =
      JSON.parse(rawData);

    showNotification(
      data.title,
      data.body
    );

    addMessage(
      "assistant",
      `🔔 ${data.body}`,
      new Date()
    );
  } catch (error) {
    console.error(
      "Notification stream parse error",
      error
    );
  }
}

async function connectNativeNotificationStream() {
  console.log(
    "Connecting native notification stream"
  );

  while (true) {
    try {
      const response =
        await fetch(
          "/api/notifications/stream",
          {
            headers: {
              Accept:
                "text/event-stream",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Notification stream HTTP ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error(
          "Notification stream body unavailable"
        );
      }

      console.log(
        "✅ Native Notification Stream Connected"
      );

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          value,
          done,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        const events =
          buffer.split("\n\n");

        buffer =
          events.pop() || "";

        for (
          const eventBlock
          of events
        ) {
          const lines =
            eventBlock.split("\n");

          for (
            const line
            of lines
          ) {
            if (
              !line.startsWith(
                "data:"
              )
            ) {
              continue;
            }

            const rawData =
              line
                .slice(5)
                .trim();

            if (rawData) {
              handleNotificationStreamData(
                rawData
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        "Native Notification Stream Error",
        error
      );
    }

    await new Promise(
      (resolve) => {
        setTimeout(
          resolve,
          3000
        );
      }
    );
  }
}

function connectNotificationStream() {
  console.log(
    "connectNotificationStream called"
  );

  const isNative =
    window.NotiaRuntime
      ?.isNativeApp?.() === true;

  if (isNative) {
    connectNativeNotificationStream()
      .catch((error) => {
        console.error(
          "Native notification stream fatal error",
          error
        );
      });

    return;
  }

  const eventSource =
    new EventSource(
      "/api/notifications/stream"
    );

  eventSource.onopen = () => {
    console.log(
      "✅ Notification Stream Connected",
      eventSource.readyState
    );
  };

  eventSource.onmessage = (
    event
  ) => {
    handleNotificationStreamData(
      event.data
    );
  };

  eventSource.onerror = (
    error
  ) => {
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


const chatOnboardingImages = [
  "/images/onboarding/notia_onboarding_chat_01.png",
  "/images/onboarding/notia_onboarding_chat_02.png",
  "/images/onboarding/notia_onboarding_chat_03.png",
  "/images/onboarding/notia_onboarding_chat_04.png",
];

const chatOnboardingDescriptions = [
  "予定ややることを、普段の会話のように送るだけ。<br>Notiaが内容を整理して、予定やタスクとしてまとめます。",
  "やりたいことや期限を相談するだけ。<br>Notiaが内容を整理して、わかりやすくまとめます。",
  "プリントや資料も、そのまま送れます。<br>Notiaが内容を読み取り、予定ややることを整理します。",
  "思いついたことを、そのまま話しかけるだけ。<br>Notiaが毎日の整理をサポートします。",
];

let chatOnboardingIndex = 0;

function renderChatOnboarding() {
  const onboarding =
    document.getElementById(
      "chatOnboarding"
    );

  const image =
    document.getElementById(
      "chatOnboardingImage"
    );

  const prevButton =
    document.getElementById(
      "chatOnboardingPrev"
    );

  const nextButton =
    document.getElementById(
      "chatOnboardingNext"
    );

  const progress =
    document.getElementById(
      "chatOnboardingProgress"
    );

  const description =
    document.getElementById(
      "chatOnboardingDescription"
    );

  if (
    !onboarding ||
    !image ||
    !prevButton ||
    !nextButton ||
    !progress ||
    !description
  ) {
    return;
  }

  image.src =
    chatOnboardingImages[
      chatOnboardingIndex
    ];

  image.alt =
    `Notiaチャットの使い方 ${
      chatOnboardingIndex + 1
    }`;

  progress.textContent =
    `${chatOnboardingIndex + 1} / ${
      chatOnboardingImages.length
    }`;

  description.innerHTML =
    chatOnboardingDescriptions[
      chatOnboardingIndex
    ];

  prevButton.disabled =
    chatOnboardingIndex === 0;

  nextButton.textContent =
    chatOnboardingIndex ===
    chatOnboardingImages.length - 1
      ? "閉じる"
      : "次へ";
}

function showChatOnboarding() {
  const onboarding =
    document.getElementById(
      "chatOnboarding"
    );

  if (!onboarding) {
    return;
  }

  chatOnboardingIndex = 0;

  renderChatOnboarding();

  onboarding.hidden = false;

  onboarding.setAttribute(
    "aria-hidden",
    "false"
  );
}

function hideChatOnboarding() {
  const onboarding =
    document.getElementById(
      "chatOnboarding"
    );

  if (!onboarding) {
    return;
  }

  onboarding.hidden = true;

  onboarding.setAttribute(
    "aria-hidden",
    "true"
  );
}

async function completeChatOnboarding() {
  const response = await fetch(
    "/api/onboarding/complete",
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      "オンボーディング完了状態を保存できませんでした。"
    );
  }

  hideChatOnboarding();
}

function setupChatOnboardingControls() {
  const prevButton =
    document.getElementById(
      "chatOnboardingPrev"
    );

  const nextButton =
    document.getElementById(
      "chatOnboardingNext"
    );

  if (!prevButton || !nextButton) {
    return;
  }

  prevButton.addEventListener(
    "click",
    () => {
      if (chatOnboardingIndex === 0) {
        return;
      }

      chatOnboardingIndex -= 1;

      renderChatOnboarding();
    }
  );

  nextButton.addEventListener(
    "click",
    async () => {
      const isLastPage =
        chatOnboardingIndex ===
        chatOnboardingImages.length - 1;

      if (!isLastPage) {
        chatOnboardingIndex += 1;

        renderChatOnboarding();

        return;
      }

      nextButton.disabled = true;

      try {
        await completeChatOnboarding();
      } catch (error) {
        console.error(
          "Chat onboarding completion error:",
          error
        );

        nextButton.disabled = false;
      }
    }
  );
}

async function loadChatOnboarding() {
  try {
    const response = await fetch(
      "/api/onboarding"
    );

    if (!response.ok) {
      throw new Error(
        "オンボーディング状態を取得できませんでした。"
      );
    }

    const data = await response.json();

    if (!data.completed) {
      showChatOnboarding();
    }
  } catch (error) {
    console.error(
      "Chat onboarding load error:",
      error
    );
  }
}

setupChatOnboardingControls();
loadChatOnboarding();

requestNotificationPermission();

connectNotificationStream();

loadConversationHistory();

renderTodaySummary();
loadTodayNextSchedule();
