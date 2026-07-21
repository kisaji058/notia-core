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

window.createTaskCard =
  createTaskCard;

window.createRoutineCard =
  createRoutineCard;