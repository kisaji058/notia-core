const routineList =
  document.getElementById(
    "routineList"
  );

const addRoutineButton =
  document.getElementById(
    "addRoutineButton"
  );

const sheetOverlay =
  document.getElementById(
    "sheetOverlay"
  );

const sheetModal =
  document.getElementById(
    "sheetModal"
  );

const sheetTitle =
  document.getElementById(
    "sheetTitle"
  );

const sheetContent =
  document.getElementById(
    "sheetContent"
  );

const closeSheetButton =
  document.getElementById(
    "closeSheetButton"
  );

const DAY_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
];

const CATEGORY_LABELS = {
  work: "仕事",
  school: "学校",
  shopping: "買い物",
  private: "プライベート",
  other: "その他",
};

async function loadRoutines() {
  try {
    routineList.innerHTML = `
      <p class="routine-status">
        読み込み中...
      </p>
    `;

    const response = await fetch(
      "/api/routines"
    );

    if (!response.ok) {
      throw new Error(
        `ルーティーン取得失敗: ${response.status}`
      );
    }

    const routines =
      await response.json();

    renderRoutines(routines);
  } catch (error) {
    console.error(
      "ルーティーン取得エラー:",
      error
    );

    routineList.innerHTML = `
      <p class="routine-status routine-error">
        ルーティーンの読み込みに失敗しました。
      </p>
    `;
  }
}

function renderRoutines(routines) {
  routineList.innerHTML = "";

  if (
    !Array.isArray(routines) ||
    routines.length === 0
  ) {
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

  const sortedRoutines =
    [...routines].sort(
      compareRoutines
    );

  sortedRoutines.forEach(
    (routine) => {
      const dayLabel =
  DAY_LABELS[
    routine.day_of_week
  ] || "曜日未設定";

const categoryLabel =
  CATEGORY_LABELS[
    routine.category
  ] || "その他";

const timeText =
  routine.routine_time ||
  "時間未設定";

const card =
  window.createRoutineCard(
    routine,
    {
      dayLabel,
      categoryLabel,
      timeText,
      onClick: () =>
        openRoutineSheet(
          routine
        ),
    }
  );

      routineList.appendChild(
        card
      );
    }
  );
}

function compareRoutines(a, b) {
  if (
    a.day_of_week !==
    b.day_of_week
  ) {
    return (
      a.day_of_week -
      b.day_of_week
    );
  }

  const timeA =
    a.routine_time ||
    "99:99";

  const timeB =
    b.routine_time ||
    "99:99";

  return timeA.localeCompare(
    timeB
  );
}

function openRoutineSheet(
  routine = null
) {
  const isEdit =
    routine !== null;

  sheetTitle.textContent =
    isEdit
      ? "ルーティーン編集"
      : "ルーティーン追加";

  sheetContent.innerHTML = `
    <form id="routineForm">
      <label
        class="sheet-label"
        for="routineTitle"
      >
        タイトル
      </label>

      <input
        id="routineTitle"
        class="sheet-input"
        type="text"
        value="${escapeHtml(
          routine?.title ?? ""
        )}"
        placeholder="例：ジム"
        required
      />

      <label
        class="sheet-label"
        for="routineDay"
      >
        曜日
      </label>

      <select
        id="routineDay"
        class="sheet-input"
      >
        ${createDayOptions(
          routine?.day_of_week
        )}
      </select>

      <label
        class="sheet-label"
        for="routineTime"
      >
        時間
      </label>

      <input
  id="routineTime"
  class="sheet-input"
  type="time"
  value="${escapeHtml(
    routine?.routine_time ??
    ""
  )}"
/>

      <label
        class="sheet-label"
        for="routineCategory"
      >
        カテゴリー
      </label>

      <select
        id="routineCategory"
        class="sheet-input"
      >
        ${createCategoryOptions(
          routine?.category
        )}
      </select>

      <label class="sheet-checkbox">
        <input
          id="googleEnabled"
          type="checkbox"
          ${
            routine
              ?.google_calendar_enabled
              ? "checked"
              : ""
          }
        />

        Googleカレンダーにも追加
      </label>

      <button
        type="submit"
        class="sheet-submit-button"
      >
        ${
          isEdit
            ? "保存"
            : "登録"
        }
      </button>

      ${
        isEdit
          ? `
            <button
              id="deleteRoutineButton"
              type="button"
              class="sheet-delete-button"
            >
              ルーティーンを削除
            </button>
          `
          : ""
      }
    </form>
  `;

  const routineForm =
    document.getElementById(
      "routineForm"
    );

  routineForm.addEventListener(
    "submit",
    (event) => {
      submitRoutine(
        event,
        routine
      );
    }
  );

  if (isEdit) {
    const deleteRoutineButton =
      document.getElementById(
        "deleteRoutineButton"
      );

    deleteRoutineButton.addEventListener(
      "click",
      () => {
        deleteRoutine(
          routine
        );
      }
    );
  }

  sheetOverlay.hidden = false;
  sheetModal.hidden = false;
}

function createDayOptions(
  selectedDay
) {
  return DAY_LABELS.map(
    (label, index) => {
      const selected =
        selectedDay === index
          ? "selected"
          : "";

      return `
        <option
          value="${index}"
          ${selected}
        >
          ${label}
        </option>
      `;
    }
  ).join("");
}

function createCategoryOptions(
  selectedCategory
) {
  const category =
    selectedCategory ||
    "private";

  return Object.entries(
    CATEGORY_LABELS
  )
    .map(
      ([value, label]) => {
        const selected =
          category === value
            ? "selected"
            : "";

        return `
          <option
            value="${value}"
            ${selected}
          >
            ${label}
          </option>
        `;
      }
    )
    .join("");
}

function closeRoutineSheet() {
  sheetOverlay.hidden = true;
  sheetModal.hidden = true;

  sheetContent.innerHTML = "";
}

async function submitRoutine(
  event,
  routine = null
) {
  event.preventDefault();

  const title =
    document
      .getElementById(
        "routineTitle"
      )
      .value
      .trim();

  const dayOfWeek = Number(
    document.getElementById(
      "routineDay"
    ).value
  );

  const routineTime =
    document.getElementById(
      "routineTime"
    ).value || null;

  const category =
    document.getElementById(
      "routineCategory"
    ).value;

  const googleCalendarEnabled =
    document.getElementById(
      "googleEnabled"
    ).checked;

  if (!title) {
    alert(
      "タイトルを入力してください。"
    );

    return;
  }

  const isEdit =
    routine !== null;

  const url =
    isEdit
      ? `/api/routines/${routine.id}`
      : "/api/routines";

  const method =
    isEdit
      ? "PUT"
      : "POST";

  console.log("routine save:", {
  routine,
  url,
  method,
  title,
  dayOfWeek,
  routineTime,
  category,
  googleCalendarEnabled,
});

  try {
    const response = await fetch(
      url,
      {
        method,
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          title,
          dayOfWeek,
          routineTime,
          category,
          googleCalendarEnabled,
        }),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          (
            isEdit
              ? "更新に失敗しました。"
              : "登録に失敗しました。"
          )
      );
    }

    closeRoutineSheet();

    await loadRoutines();
  } catch (error) {
    console.error(
      "ルーティーン保存エラー:",
      error
    );

    alert(error.message);
  }
}

async function deleteRoutine(
  routine
) {
  const confirmed =
    window.confirm(
      `「${routine.title}」を削除しますか？`
    );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `/api/routines/${routine.id}`,
      {
        method: "DELETE",
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "削除に失敗しました。"
      );
    }

    closeRoutineSheet();

    await loadRoutines();
  } catch (error) {
    console.error(
      "ルーティーン削除エラー:",
      error
    );

    alert(error.message);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

addRoutineButton.addEventListener(
  "click",
  () => {
    openRoutineSheet();
  }
);

closeSheetButton.addEventListener(
  "click",
  closeRoutineSheet
);

sheetOverlay.addEventListener(
  "click",
  closeRoutineSheet
);

loadRoutines();