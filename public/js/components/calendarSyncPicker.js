// Googleカレンダー同期対象の共通選択画面
(function () {
  async function fetchCategories() {
    const runtime = window.NotiaRuntime;
    const isNative =
      runtime?.isNativeApp?.() === true;
    const headers = {};

    if (isNative) {
      const token =
        await runtime.getAuthToken();

      if (!token) {
        throw new Error(
          "認証情報を取得できませんでした。"
        );
      }

      headers.Authorization = `Bearer ${token}`;
    }

    const url = runtime?.apiUrl
      ? runtime.apiUrl("/api/categories")
      : "/api/categories";

    const response = await fetch(url, {
      headers,
      credentials: isNative
        ? "omit"
        : "same-origin",
    });

    if (!response.ok) {
      throw new Error(
        "分類の取得に失敗しました。"
      );
    }

    const categories = await response.json();

    if (!Array.isArray(categories)) {
      throw new Error(
        "分類データを確認できませんでした。"
      );
    }

    return categories;
  }

  function open() {
    return new Promise((resolve) => {
      const overlay =
        document.createElement("div");

      overlay.setAttribute(
        "role",
        "dialog"
      );
      overlay.setAttribute(
        "aria-modal",
        "true"
      );
      overlay.setAttribute(
        "aria-label",
        "Googleカレンダーと同期"
      );

      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(20, 40, 45, 0.55);
      `;

      const card =
        document.createElement("div");

      card.style.cssText = `
        box-sizing: border-box;
        width: min(100%, 420px);
        max-height: 85vh;
        overflow-y: auto;
        padding: 22px;
        border-radius: 22px;
        background: #fff;
        color: #24364f;
        font-size: 15px;
      `;

      const heading =
        document.createElement("h2");

      heading.textContent =
        "Googleカレンダーと同期";
      heading.style.margin = "0 0 18px";

      const allLabel =
        document.createElement("label");
      const allRadio =
        document.createElement("input");

      allRadio.type = "radio";
      allRadio.name = "notia-sync-mode";
      allRadio.value = "all";
      allRadio.checked = true;

      allLabel.append(
        allRadio,
        document.createTextNode(
          " すべて同期する"
        )
      );

      const selectedLabel =
        document.createElement("label");
      const selectedRadio =
        document.createElement("input");

      selectedRadio.type = "radio";
      selectedRadio.name = "notia-sync-mode";
      selectedRadio.value = "selected";

      selectedLabel.append(
        selectedRadio,
        document.createTextNode(
          " 分類を選んで同期する"
        )
      );

      const categoryArea =
        document.createElement("div");

      categoryArea.hidden = true;
      categoryArea.style.cssText = `
        margin: 12px 0;
        padding: 12px;
        border-radius: 12px;
        background: #f1f7f5;
      `;

      const message =
        document.createElement("p");

      message.textContent =
        "分類を取得しています...";
      message.style.fontSize = "13px";

      const categoryList =
        document.createElement("div");

      categoryArea.append(
        message,
        categoryList
      );

      const actions =
        document.createElement("div");

      actions.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      `;

      const cancelButton =
        document.createElement("button");

      cancelButton.type = "button";
      cancelButton.textContent =
        "キャンセル";

      const confirmButton =
        document.createElement("button");

      confirmButton.type = "button";
      confirmButton.textContent =
        "同期する";
      confirmButton.style.cssText = `
        padding: 10px 16px;
        border: 0;
        border-radius: 999px;
        background: #2fa99d;
        color: #fff;
        font-weight: bold;
      `;

      const close = (result) => {
        overlay.remove();
        resolve(result);
      };

      const update = () => {
        categoryArea.hidden =
          !selectedRadio.checked;

        const hasSelection =
          categoryList.querySelector(
            'input[type="checkbox"]:checked'
          ) !== null;

        confirmButton.disabled =
          selectedRadio.checked &&
          !hasSelection;
      };

      allRadio.addEventListener(
        "change",
        update
      );
      selectedRadio.addEventListener(
        "change",
        update
      );

      cancelButton.addEventListener(
        "click",
        () => close(null)
      );

      confirmButton.addEventListener(
        "click",
        () => {
          if (allRadio.checked) {
            close({ categories: null });
            return;
          }

          const categories = Array.from(
            categoryList.querySelectorAll(
              'input[type="checkbox"]:checked'
            )
          ).map(
            (input) => input.value
          );

          if (categories.length > 0) {
            close({ categories });
          }
        }
      );

      actions.append(
        cancelButton,
        confirmButton
      );

      card.append(
        heading,
        allLabel,
        document.createElement("br"),
        selectedLabel,
        categoryArea,
        actions
      );

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      update();

      fetchCategories()
        .then((categories) => {
          message.remove();

          for (const category of categories) {
            const label =
              document.createElement("label");
            const checkbox =
              document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.value =
              category.category_key;

            label.style.cssText = `
              display: block;
              padding: 6px 0;
            `;

            label.append(
              checkbox,
              document.createTextNode(
                ` ${category.label}`
              )
            );

            checkbox.addEventListener(
              "change",
              update
            );

            categoryList.appendChild(
              label
            );
          }

          update();
        })
        .catch((error) => {
          message.textContent =
            error.message;
          update();
        });
    });
  }

  window.NotiaCalendarSyncPicker = {
    open,
  };
})();
