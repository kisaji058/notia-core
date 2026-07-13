const timeline = document.getElementById("timeline");
const unscheduledList = document.getElementById("unscheduledList");

const calendarTitle = document.getElementById("calendarTitle");

const prevDayButton = document.getElementById("prevDayButton");
const nextDayButton = document.getElementById("nextDayButton");
const datePicker = document.getElementById("datePicker");
const todayButton = document.getElementById("todayButton");

const todayString = new Date().toLocaleDateString("sv-SE", {
  timeZone: "Asia/Tokyo",
});

let selectedDate = todayString;

function createTimeline() {
  timeline.innerHTML = "";

  for (let hour = 0; hour < 24; hour++) {
    const slot = document.createElement("div");

    slot.className = "time-slot";

    slot.innerHTML = `
      <div class="time-label">
        ${String(hour).padStart(2, "0")}:00
      </div>

      <div
        class="slot-content"
        id="hour-${hour}">
      </div>
    `;

    timeline.appendChild(slot);
  }
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+09:00`);

  date.setDate(date.getDate() + days);

  return date.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
}

function updateHeader() {
const date = new Date(`${selectedDate}T00:00:00+09:00`);

calendarTitle.textContent = date.toLocaleDateString("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
});

  datePicker.value = selectedDate;

  if (selectedDate === todayString) {
  todayButton.style.display = "none";
} else {
  todayButton.style.display = "block";
}
}

function renderCurrentTimeLine() {
  if (selectedDate !== todayString) {
    return;
  }

  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).formatToParts(now);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return;
  }

  const slot = document.getElementById(`hour-${hour}`);

  if (!slot) {
    return;
  }

  const line = document.createElement("div");

  line.className = "current-time-line";
  line.style.top = `${(minute / 60) * 100}%`;

  const label = document.createElement("span");

  label.className = "current-time-label";
  label.textContent =
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}`;

  line.appendChild(label);
  slot.appendChild(line);
}

function scrollToCurrentTime() {
  if (selectedDate !== todayString) {
    return;
  }

  const now = new Date();

  const hour = now.getHours();

  const target = document.getElementById(`hour-${hour}`);

  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function renderTasks(tasks) {
  createTimeline();
  unscheduledList.innerHTML = "";

  for (const task of tasks) {
    const dueTime = task.due_time;

    if (!dueTime) {
      const item = document.createElement("div");

      item.className = "task-card";
      item.textContent = `${task.priority_icon} ${task.title}`;

      item.addEventListener("click", () => {
        window.location.href = `/tasks/${task.id}`;
      });

      unscheduledList.appendChild(item);

      continue;
    }

    const hour = Number(dueTime.split(":")[0]);
    const slot = document.getElementById(`hour-${hour}`);

    if (!slot) {
      continue;
    }

    const card = document.createElement("div");

    card.className = "task-card";

    card.innerHTML = `
      <strong>${dueTime}</strong><br>
      ${task.priority_icon} ${task.title}
    `;

    card.addEventListener("click", () => {
      window.location.href = `/tasks/${task.id}`;
    });

    slot.appendChild(card);
  }

  renderCurrentTimeLine();
}

async function loadCalendar() {
  try {
    updateHeader();

    const res = await fetch(
      `/api/calendar?date=${encodeURIComponent(selectedDate)}`
    );

    if (!res.ok) {
      throw new Error(`カレンダー取得失敗: ${res.status}`);
    }

    const tasks = await res.json();

    renderTasks(tasks);

    setTimeout(() => {
  scrollToCurrentTime();
}, 50);
  } catch (error) {
    console.error(error);
  }
}

prevDayButton.addEventListener("click", () => {
  selectedDate = addDays(selectedDate, -1);
  loadCalendar();
});

nextDayButton.addEventListener("click", () => {
  selectedDate = addDays(selectedDate, 1);
  loadCalendar();
});

datePicker.addEventListener("change", () => {
  if (!datePicker.value) {
    return;
  }

  selectedDate = datePicker.value;
  loadCalendar();
});

todayButton.addEventListener("click", () => {
  selectedDate = todayString;
  loadCalendar();
});

loadCalendar();