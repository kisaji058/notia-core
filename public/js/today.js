const todayBriefingContent =
  document.getElementById(
    "todayBriefingContent"
  );

const todayHeroDate =
  document.getElementById(
    "todayHeroDate"
  );

const todayHeroGreeting =
  document.getElementById(
    "todayHeroGreeting"
  );

const timelineElement =
  document.getElementById(
    "timeline"
  );

const unscheduledList =
  document.getElementById(
    "todayUnscheduledList"
  );

const overdueNotice =
  document.getElementById(
    "overdueNotice"
  );

const overdueNoticeText =
  document.getElementById(
    "overdueNoticeText"
  );

function formatTodayDate(date) {
  return date.toLocaleDateString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "long",
    }
  );
}

function renderTodayHero() {
  const now = new Date();

  todayHeroDate.textContent =
    formatTodayDate(now);
}

function getTodayMessage(taskCount) {
  if (taskCount === 0) {
    return "今日は余裕がありそうです。";
  }

  if (taskCount <= 2) {
    return "今日もいいスタートです。";
  }

  if (taskCount <= 5) {
    return "少し忙しい一日です。";
  }

  return "やることが多い一日です。";
}

function formatDateForApi(date) {
  return date.toLocaleDateString(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
    }
  );
}

function getCurrentTimeText() {
  return new Date().toLocaleTimeString(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );
}

function renderTodayBriefing(
  timeline,
  taskCount,
  eventCount
) {
  if (!todayBriefingContent) {
    return;
  }

  const currentTime =
    getCurrentTimeText();

  const nextItem =
    timeline
      .filter(
        (item) =>
          item.startTime &&
          item.startTime >= currentTime
      )
      .sort(
        (a, b) =>
          a.startTime.localeCompare(
            b.startTime
          )
      )[0];

  const summaryText =
    `今日は予定が${eventCount}件、` +
    `タスクが${taskCount}件あります。`;


  const nextConnector =
  nextItem?.type === "task"
    ? "までに"
    : "から";

const nextText =
  nextItem
    ? `次は${nextItem.startTime}${nextConnector}「${nextItem.title}」です。`
    : "このあとの予定はありません。";

  const summary =
  document.createElement("p");

const next =
  document.createElement("p");

const label =
  document.createElement("div");

summary.textContent = summaryText;
next.textContent = nextText;

label.textContent =
  "Notia briefing";

label.className =
  "today-briefing-label";

todayBriefingContent.replaceChildren(
  summary,
  next,
  label
);
}

async function loadTodayMessage() {
  try {
    const today =
      formatDateForApi(
        new Date()
      );

    const response =
      await fetch(
        `/api/today?date=${today}`
      );

    if (!response.ok) {
      throw new Error(
        `Today取得失敗: ${response.status}`
      );
    }

    const data =
      await response.json();

    console.log(data.timeline);

    const timeline =
  Array.isArray(data.timeline)
    ? data.timeline
    : [];

const overdueTasks =
  Array.isArray(data.overdueTasks)
    ? data.overdueTasks
    : [];

renderTimeline(timeline);
renderUnscheduled(timeline);
renderOverdueNotice(overdueTasks);


    const taskCount =
      timeline.filter(
        (item) =>
          item.type === "task"
      ).length;

    const eventCount =
      timeline.filter(
        (item) =>
          item.type === "event"
      ).length;

    const routineCount =
      timeline.filter(
        (item) =>
          item.type === "routine"
      ).length;

    todayHeroGreeting.textContent =
      getTodayMessage(
        taskCount
      );

renderTodayBriefing(
  timeline,
  taskCount,
  eventCount
);

  } catch (error) {
    console.error(
      "Todayデータ取得エラー:",
      error
    );

    todayHeroGreeting.textContent =
      "今日もあなたのペースで進めていきましょう。";

    todayBriefingContent.innerHTML = `
      <p>
        今日の情報を取得できませんでした。
      </p>
    `;
  }
}

function timeTextToMinutes(value) {
  if (!value) {
    return null;
  }

  const match =
    String(value).match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}

function isPastTodayTimedItem(item) {
  if (
    !["event", "routine"].includes(
      item?.type
    ) ||
    !item.startTime
  ) {
    return false;
  }

  const now = new Date();

  const currentMinutes =
    Number(
      now.toLocaleTimeString(
        "ja-JP",
        {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      ).split(":")[0]
    ) * 60 +
    Number(
      now.toLocaleTimeString(
        "ja-JP",
        {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      ).split(":")[1]
    );

  const endTime =
    item.endTime ||
    item.end_time ||
    null;

  const compareMinutes =
    timeTextToMinutes(
      endTime || item.startTime
    );

  if (compareMinutes === null) {
    return false;
  }

  return (
    compareMinutes <
    currentMinutes
  );
}

function renderTimeline(timeline) {
  if (!timelineElement) {
    return;
  }

  const scheduledItems =
    timeline.filter(
      (item) => item.startTime
    );

  if (scheduledItems.length === 0) {
    timelineElement.innerHTML = `
      <p>
        今日の予定はありません。
      </p>
    `;

    return;
  }

  timelineElement.innerHTML =
    scheduledItems
      .map((item) =>
        window.createTimelineCard(item)
      )
      .join("");

  const cards =
    timelineElement.querySelectorAll(
      ".timeline-item"
    );

  scheduledItems.forEach(
    (item, index) => {
      const card =
        cards[index];

      if (!card) {
        return;
      }

      if (
        isPastTodayTimedItem(item)
      ) {
        card.classList.add(
          "timeline-item--past-event"
        );

        return;
      }

      let targetUrl = null;

      if (
        item.type === "task" &&
        item.id !== undefined
      ) {
        targetUrl =
          `/tasks/${encodeURIComponent(
            item.id
          )}`;
      }

      if (
        item.type === "routine" &&
        item.id !== undefined
      ) {
        targetUrl =
          `/routine-edit.html?id=${encodeURIComponent(
            item.id
          )}`;
      }

      if (
        item.type === "event" &&
        item.id !== undefined
      ) {
        const today =
          formatDateForApi(
            new Date()
          );

        targetUrl =
          `/calendar.html?date=${encodeURIComponent(
            today
          )}&eventId=${encodeURIComponent(
            item.id
          )}`;
      }

      if (!targetUrl) {
        return;
      }

      card.classList.add(
        "timeline-item--clickable"
      );

      card.setAttribute(
        "role",
        "button"
      );

      card.tabIndex = 0;

      const activate = () => {
        if (
          window.NotiaRuntime?.navigate
        ) {
          window.NotiaRuntime.navigate(
            targetUrl
          );

          return;
        }

        window.location.href =
          targetUrl;
      };

      card.addEventListener(
        "click",
        activate
      );

      card.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }

          event.preventDefault();
          activate();
        }
      );
    }
  );
}

function renderUnscheduled(timeline) {

  if (!unscheduledList) {

    return;

  }

  const unscheduledItems =

  timeline.filter(

    (item) =>

      (

        item.type === "task" ||

        item.type === "event"

      ) &&

      !item.startTime

  );

  if (unscheduledItems.length === 0) {

    unscheduledList.innerHTML = `

      <p class="unscheduled-empty">

        時間未設定のタスク・予定はありません。

      </p>

    `;

    return;

  }

  unscheduledList.innerHTML =

  unscheduledItems

    .map((item) =>

      window.createUnscheduledCard(item)

    )

    .join("");

}

function renderOverdueNotice(
  overdueTasks
) {
  if (
    !overdueNotice ||
    !overdueNoticeText
  ) {
    return;
  }

  if (overdueTasks.length === 0) {
    overdueNotice.hidden = true;
    return;
  }

  overdueNoticeText.textContent =
    `期限を過ぎたタスクが${overdueTasks.length}件あります`;

  overdueNotice.hidden = false;
}



renderTodayHero();
loadTodayMessage();