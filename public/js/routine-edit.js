const routineForm =
  document.getElementById("routineForm");
const pageTitle =
  document.getElementById("pageTitle");
const pageDescription =
  document.getElementById("pageDescription");
const pageStatus =
  document.getElementById("pageStatus");
const titleInput =
  document.getElementById("routineTitle");
const timeInput =
  document.getElementById("routineTime");
const noTimeInput =
  document.getElementById("noRoutineTime");
const categoryInput =
  document.getElementById("routineCategory");
const googleInput =
  document.getElementById("googleEnabled");
const memoInput =
  document.getElementById("routineMemo");
const saveButton =
  document.getElementById("saveRoutineButton");
const deleteButton =
  document.getElementById("deleteRoutineButton");

const params = new URLSearchParams(window.location.search);
const routineId = Number(params.get("id"));
const isNew = params.get("new") === "1";

let currentRoutine = null;

const ROUTINE_FALLBACK_CATEGORIES = [
  { category_key: "work", label: "仕事" },
  { category_key: "school", label: "学校" },
  { category_key: "shopping", label: "買い物" },
  { category_key: "private", label: "プライベート" },
  { category_key: "other", label: "その他" },
];

function escapeRoutineCategoryHtml(
  value
) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadRoutineCategories(
  selectedKey = "private"
) {
  let categories =
    ROUTINE_FALLBACK_CATEGORIES;

  try {
    const runtime =
      window.NotiaRuntime;

    const isNative =
      runtime
        ?.isNativeApp
        ?.() === true;

    const headers = {};

    if (isNative) {
      const token =
        await runtime
          .getAuthToken();

      if (!token) {
        throw new Error(
          "分類取得用の認証情報がありません。"
        );
      }

      headers.Authorization =
        `Bearer ${token}`;
    }

    const url =
      runtime?.apiUrl
        ? runtime.apiUrl(
            "/api/categories"
          )
        : "/api/categories";

    const response =
      await fetch(
        url,
        {
          method: "GET",
          headers,
          credentials:
            isNative
              ? "omit"
              : "same-origin",
        }
      );

    if (!response.ok) {
      throw new Error(
        `分類取得失敗: ${response.status}`
      );
    }

    const result =
      await response.json();

    if (
      Array.isArray(result) &&
      result.length > 0
    ) {
      categories = result;
    }
  } catch (error) {
    console.error(
      "Routine categories load error:",
      error
    );
  }

  categoryInput.innerHTML =
    categories
      .map((category) => {
        const key =
          String(
            category.category_key ||
            ""
          );

        const label =
          String(
            category.label ||
            key
          );

        const selected =
          key === selectedKey
            ? " selected"
            : "";

        return (
          `<option value="${escapeRoutineCategoryHtml(key)}"${selected}>` +
          `${escapeRoutineCategoryHtml(label)}` +
          `</option>`
        );
      })
      .join("");
}

function getSelectedDays() {
  return [...document.querySelectorAll(
    'input[name="routineDay"]:checked'
  )]
    .map((input) => Number(input.value))
    .sort((a, b) => a - b);
}

function setSelectedDays(daysOfWeek) {
  const selectedDays = new Set(
    daysOfWeek.map((day) => Number(day))
  );

  document.querySelectorAll(
    'input[name="routineDay"]'
  ).forEach((input) => {
    input.checked = selectedDays.has(
      Number(input.value)
    );
  });
}

function getRoutineDays(routine) {
  if (Array.isArray(routine.days_of_week)) {
    return routine.days_of_week;
  }

  if (typeof routine.days_of_week === "string") {
    return routine.days_of_week.split(",");
  }

  return [routine.day_of_week];
}

function syncTimeState() {
  timeInput.disabled = noTimeInput.checked;

  if (noTimeInput.checked) {
    timeInput.value = "";
  }
}

function showForm() {
  pageStatus.hidden = true;
  routineForm.hidden = false;
}

function showError(message) {
  pageStatus.textContent = message;
  pageStatus.classList.add("is-error");
  pageStatus.hidden = false;
  routineForm.hidden = true;
}

function setSaving(isSaving) {
  saveButton.disabled = isSaving;
  deleteButton.disabled = isSaving;
  saveButton.textContent = isSaving
    ? "保存中..."
    : isNew
      ? "ルーティーンを登録"
      : "変更を保存";
}

async function setupNewRoutine() {
  pageTitle.textContent = "ルーティーン追加";
  pageDescription.textContent =
    "毎週くり返す予定や習慣を登録します。";
  document.title = "Notia ルーティーン追加";

  setSelectedDays([new Date().getDay()]);

  await loadRoutineCategories(
    "private"
  );

  categoryInput.value = "private";
  googleInput.checked = false;
  deleteButton.hidden = true;
  saveButton.textContent = "ルーティーンを登録";
  showForm();
  titleInput.focus();
}

async function populateRoutine(routine) {
  currentRoutine = routine;
  titleInput.value = routine.title || "";
  setSelectedDays(getRoutineDays(routine));

  const routineTime = routine.routine_time || "";
  timeInput.value = routineTime;
  noTimeInput.checked = !routineTime;
  syncTimeState();

  await loadRoutineCategories(
    routine.category || "other"
  );

  categoryInput.value =
    routine.category || "other";
  googleInput.checked = Boolean(
    routine.google_calendar_enabled
  );
  memoInput.value = routine.memo || "";

  showForm();
}

async function loadRoutine() {
  if (isNew) {
    await setupNewRoutine();
    return;
  }

  if (!Number.isInteger(routineId) || routineId <= 0) {
    showError("編集するルーティーンを特定できませんでした。");
    return;
  }

  try {
    const response = await fetch("/api/routines");

    if (!response.ok) {
      throw new Error("ルーティーンの取得に失敗しました。");
    }

    const routines = await response.json();
    const routine = Array.isArray(routines)
      ? routines.find((item) => Number(item.id) === routineId)
      : null;

    if (!routine) {
      throw new Error("ルーティーンが見つかりません。");
    }

    await populateRoutine(routine);
  } catch (error) {
    console.error("ルーティーン取得エラー:", error);
    showError(error.message);
  }
}

async function saveRoutine(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const daysOfWeek = getSelectedDays();

  if (!title) {
    alert("タイトルを入力してください。");
    titleInput.focus();
    return;
  }

  if (daysOfWeek.length === 0) {
    alert("曜日を1つ以上選択してください。");
    return;
  }

  const payload = {
    title,
    dayOfWeek: daysOfWeek[0],
    daysOfWeek,
    routineTime: noTimeInput.checked
      ? null
      : timeInput.value || null,
    category: categoryInput.value,
    googleCalendarEnabled: googleInput.checked,
    memo: memoInput.value.trim(),
  };

  const url = isNew
    ? "/api/routines"
    : `/api/routines/${routineId}`;
  const method = isNew ? "POST" : "PUT";

  setSaving(true);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
        (isNew
          ? "登録に失敗しました。"
          : "更新に失敗しました。")
      );
    }

    NotiaRuntime.navigate("/routines");
  } catch (error) {
    console.error("ルーティーン保存エラー:", error);
    alert(error.message);
    setSaving(false);
  }
}

async function deleteRoutine() {
  if (isNew || !currentRoutine) {
    return;
  }

  const confirmed = window.confirm(
    `「${currentRoutine.title}」を削除しますか？`
  );

  if (!confirmed) {
    return;
  }

  setSaving(true);

  try {
    const response = await fetch(
      `/api/routines/${routineId}`,
      { method: "DELETE" }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "削除に失敗しました。");
    }

    NotiaRuntime.navigate("/calendar");
  } catch (error) {
    console.error("ルーティーン削除エラー:", error);
    alert(error.message);
    setSaving(false);
  }
}

noTimeInput.addEventListener("change", syncTimeState);
routineForm.addEventListener("submit", saveRoutine);
deleteButton.addEventListener("click", deleteRoutine);

loadRoutine();
