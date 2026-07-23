function escapeCardHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createTaskCard(task, options = {}) {
  const {
  variant = "default",
  priorityIcon = "",
  dueDateText = "",
  categoryText = "",
  timeText = "",
  showActions = true,
} = options;

  const card =
    document.createElement("article");

  card.className = "task-card";

  if (variant === "completed") {
  card.className = "completed-task-card";

  card.innerHTML = `
    <div class="completed-task-info">
      <div class="completed-task-title">
        <span class="priority-icon">
          ${escapeCardHtml(
  priorityIcon
)}
        </span>

        <span>
          ${escapeCardHtml(task.title)}
        </span>
      </div>

      <div class="completed-task-meta">
        <span>
  ${escapeCardHtml(
    dueDateText
  )}
</span>

        <span class="task-category">
          ${escapeCardHtml(categoryText)}
        </span>
      </div>
    </div>

    <button
      type="button"
      class="restore-button"
      aria-label="${escapeCardHtml(task.title)}を復元する"
    >
      復元
    </button>
  `;

  return card;
}

if (variant === "calendar") {
  card.className =
    "task-card calendar-task-card";

  const displayTime =
    timeText || "時間未設定";

  card.innerHTML = `
    <div
      class="task-info"
      role="button"
      tabindex="0"
    >
      <div class="task-title">
        <span class="priority-icon">
          ${escapeCardHtml(
  priorityIcon
)}
        </span>

        <span>
          ${escapeCardHtml(
            task.title
          )}
        </span>
      </div>

      <div class="task-meta">
        <span class="task-time">
          ${escapeCardHtml(
            displayTime
          )}
        </span>
      </div>
    </div>
  `;

  return card;
}

  card.innerHTML = `
    <div
      class="task-info"
      role="button"
      tabindex="0"
    >
      <div class="task-title">
        <span class="priority-icon">
          ${escapeCardHtml(
  priorityIcon
)}
        </span>

        <span>
          ${escapeCardHtml(task.title)}
        </span>
      </div>

      <div class="task-meta">
        <span class="task-date">
  ${escapeCardHtml(
    dueDateText
  )}
</span>

        <span class="task-category">
          ${escapeCardHtml(categoryText)}
        </span>
      </div>
    </div>

    ${
      showActions
        ? `
          <div class="task-actions">
            <button
              type="button"
              class="complete-button"
              aria-label="${escapeCardHtml(
                task.title
              )}を完了する"
            >
              完了
            </button>

            <button
              type="button"
              class="delete-button"
              aria-label="${escapeCardHtml(
                task.title
              )}を削除する"
            >
              🗑
            </button>
          </div>
        `
        : ""
    }
  `;

  return card;
}

function createRoutineCard(
  routine,
  options = {}
) {
  const {
    dayLabel = "曜日未設定",
    categoryLabel = "その他",
    timeText = "時間未設定",
    onClick = null,
  } = options;

  const card =
    document.createElement(
      "article"
    );

  card.className =
    "routine-card";

  card.innerHTML = `
    <div class="routine-card-top">
      <span class="routine-day-badge">
        ${escapeCardHtml(
          dayLabel
        )}
      </span>

      <span class="routine-category">
        ${escapeCardHtml(
          categoryLabel
        )}
      </span>
    </div>

    <h2 class="routine-title">
      ${escapeCardHtml(
        routine.title
      )}
    </h2>

    <p class="routine-time">
      ${escapeCardHtml(
        timeText
      )}
    </p>
  `;

  if (
    typeof onClick === "function"
  ) {
    card.addEventListener(
      "click",
      onClick
    );
  }

  return card;
}

function createTimelineCard(item) {
  const typeConfig = {
    task: {
      label: "タスク",
      iconClass:
        "timeline-item-icon--task",
      iconSrc:
        "/images/nav/task-selected.png",
    },

    event: {
      label: "予定",
      iconClass:
        "timeline-item-icon--calendar",
      iconSrc:
        "/images/nav/point-selected.png",
    },

    routine: {
      label: "ルーティーン",
      iconClass:
        "timeline-item-icon--routine",
      iconSrc:
        "/images/nav/routine-icon-concept.png",
    },
  };

  const config =
    typeConfig[item.type] ||
    typeConfig.task;

  let subtitle = "";

  if (
    item.type === "event" &&
    item.source === "google"
  ) {
    subtitle = "Google Calendar";
  }

  if (
    item.type === "task" &&
    (
      item.priority === "high" ||
      item.subtitle === "重要タスク"
    )
  ) {
    subtitle = "重要タスク";
  }

  const isImportantTask =
    item.type === "task" &&
    (
      item.priority === "high" ||
      item.subtitle === "重要タスク"
    );

  return `
    <article class="timeline-item">
      <time class="timeline-item-time">
        ${escapeCardHtml(
          item.startTime || ""
        )}
      </time>

      <div class="timeline-item-marker"></div>

      <div
  class="
    timeline-item-content
    ${isImportantTask
      ? "timeline-item-content--important"
      : ""}
  "
>
        <div
          class="
            timeline-item-icon
            ${config.iconClass}
          "
        >
          <img
            src="${config.iconSrc}"
            alt=""
          >
        </div>

        <div class="timeline-item-main">
          <h3>
            ${escapeCardHtml(
              item.title
            )}
          </h3>

          ${
            subtitle
              ? `
                <p class="timeline-item-subtitle">
                  ${escapeCardHtml(
                    subtitle
                  )}
                </p>
              `
              : ""
          }
        </div>

        <div class="timeline-item-right">
          ${
            isImportantTask
              ? `
                <span
                  class="timeline-priority-dot"
                  aria-hidden="true"
                ></span>
              `
              : ""
          }

          <span class="timeline-tag">
            ${escapeCardHtml(
              config.label
            )}
          </span>
        </div>
      </div>
    </article>
  `;
}

function createUnscheduledCard(item) {
  const isImportantTask =
    item.type === "task" &&
    (
      item.priority === "high" ||
      item.subtitle === "重要タスク"
    );

  return `
    <article class="unscheduled-item">
      <div class="unscheduled-item-icon">
        <img
          src="/images/nav/task-selected.png"
          alt=""
        >
      </div>

      <div class="unscheduled-item-main">
        <h3>
          ${escapeCardHtml(
            item.title
          )}
        </h3>

        ${
          isImportantTask
            ? `
              <p>
                重要タスク
              </p>
            `
            : ""
        }
      </div>

      <div class="timeline-item-right">
        ${
          isImportantTask
            ? `
              <span
                class="timeline-priority-dot"
                aria-hidden="true"
              ></span>
            `
            : ""
        }

        <span class="timeline-tag">
          タスク
        </span>
      </div>
    </article>
  `;
}

window.createTaskCard =
  createTaskCard;

window.createRoutineCard =
  createRoutineCard;

window.createTimelineCard =
  createTimelineCard;

window.createUnscheduledCard =
  createUnscheduledCard;