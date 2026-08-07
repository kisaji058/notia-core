const routineList =
  document.getElementById("routineList");

const addRoutineButton =
  document.getElementById("addRoutineButton");

const DAY_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
];

const DAY_SHORT_LABELS = [
  "日",
  "月",
  "火",
  "水",
  "木",
  "金",
  "土",
];

const CATEGORY_LABELS = {
  work: "仕事",
  school: "学校",
  shopping: "買い物",
  private: "プライベート",
  other: "その他",
};

function openRoutineEditor(routineId = null) {
  const url = routineId
    ? `/routine-edit.html?id=${encodeURIComponent(routineId)}`
    : "/routine-edit.html?new=1";

  window.location.href = url;
}

function getRoutineDays(routine) {
  const source = Array.isArray(routine.days_of_week)
    ? routine.days_of_week
    : typeof routine.days_of_week === "string"
      ? routine.days_of_week.split(",")
      : [routine.day_of_week];

  return [
    ...new Set(
      source
        .map((day) => Number(day))
        .filter(
          (day) =>
            Number.isInteger(day) &&
            day >= 0 &&
            day <= 6
        )
    ),
  ].sort((a, b) => a - b);
}

function getDayLabel(routine) {
  const days = getRoutineDays(routine);

  if (days.length === 1) {
    return DAY_LABELS[days[0]];
  }

  if (days.length > 1) {
    return days
      .map((day) => DAY_SHORT_LABELS[day])
      .join("・");
  }

  return "曜日未設定";
}

async function loadRoutines() {
  try {
    routineList.innerHTML = `
      <p class="routine-status">
        読み込み中...
      </p>
    `;

    const response = await fetch("/api/routines");

    if (!response.ok) {
      throw new Error(
        `ルーティーン取得失敗: ${response.status}`
      );
    }

    const routines = await response.json();
    renderRoutines(routines);
  } catch (error) {
    console.error("ルーティーン取得エラー:", error);

    routineList.innerHTML = `
      <p class="routine-status routine-error">
        ルーティーンの読み込みに失敗しました。
      </p>
    `;
  }
}

function renderRoutines(routines) {
  routineList.innerHTML = "";

  if (!Array.isArray(routines) || routines.length === 0) {
    routineList.innerHTML = `
      <div class="routine-empty">
        <p class="routine-empty-title">
          ルーティーンはありません。
        </p>
        <p class="routine-empty-description">
          チャットまたは追加ボタンから登録できます。
        </p>
      </div>
    `;
    return;
  }

  [...routines]
    .sort(compareRoutines)
    .forEach((routine) => {
      const dayLabel = getDayLabel(routine);
      const categoryLabel =
        CATEGORY_LABELS[routine.category] || "その他";
      const timeText = routine.routine_time || "時間未設定";

      const card = window.createRoutineCard(
        routine,
        {
          dayLabel,
          categoryLabel,
          timeText,
          onClick: () => openRoutineEditor(routine.id),
        }
      );

      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute(
        "aria-label",
        `${routine.title}を編集`
      );

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRoutineEditor(routine.id);
        }
      });

      routineList.appendChild(card);
    });
}

function compareRoutines(a, b) {
  const firstDayA = getRoutineDays(a)[0] ?? 7;
  const firstDayB = getRoutineDays(b)[0] ?? 7;

  if (firstDayA !== firstDayB) {
    return firstDayA - firstDayB;
  }

  const timeA = a.routine_time || "99:99";
  const timeB = b.routine_time || "99:99";

  return timeA.localeCompare(timeB);
}

addRoutineButton.addEventListener("click", () => {
  openRoutineEditor();
});

const initialParams =
  new URLSearchParams(window.location.search);

if (initialParams.get("new") === "1") {
  openRoutineEditor();
} else {
  loadRoutines();
}
