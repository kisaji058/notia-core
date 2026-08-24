(function () {
  const accountButtons =
    document.querySelectorAll(
      ".account-button"
    );

  if (!accountButtons.length) {
    return;
  }

  window.addEventListener(
    "notia:google-calendar-callback",
    async (event) => {
      const expandedButton =
        Array.from(
          accountButtons
        ).find(
          (button) =>
            button.getAttribute(
              "aria-expanded"
            ) === "true"
        );

      if (!event.detail?.success) {
        alert(
          "Google予定との連携に失敗しました。"
        );
        return;
      }

      alert(
        "Google予定との連携が完了しました。"
      );

      closeAccountMenu();

      if (expandedButton) {
        expandedButton.click();
      }
    }
  );

  function closeAccountMenu() {
    document
      .querySelectorAll(
        ".account-menu"
      )
      .forEach((menu) => {
        menu.remove();
      });

    accountButtons.forEach(
      (button) => {
        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
  }

  async function getGoogleStatus() {
    try {
      const response =
        await fetch(
          "/api/integrations"
        );

      if (!response.ok) {
        throw new Error(
          `連携状態取得失敗: ${response.status}`
        );
      }

      const data =
        await response.json();

      return (
        data.google || {
          connected: false,
        }
      );
    } catch (error) {
      console.error(
        "Google integration error:",
        error
      );

      return null;
    }
  }

  async function getNotificationSettings() {
  try {
    const response =
      await fetch(
        "/api/notification-settings"
      );

    if (!response.ok) {
      throw new Error(
        `通知設定取得失敗: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      "Notification settings error:",
      error
    );

    return null;
  }
}

async function saveNotificationSettings(
  settings
) {
  const response =
    await fetch(
      "/api/notification-settings",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          settings
        ),
      }
    );

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.error ||
      "通知設定の保存に失敗しました。"
    );
  }

  return result.settings;
}

  async function startNativeGoogleCalendarConnect(
    button
  ) {
    try {
      button.disabled = true;
      button.textContent =
        "接続中...";

      const response =
        await fetch(
          "/api/calendar/google/native/start",
          {
            method: "POST",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.authUrl
      ) {
        throw new Error(
          result.error ||
          "Google連携を開始できませんでした。"
        );
      }

      const browser =
        window.Capacitor
          ?.Plugins
          ?.Browser;

      if (!browser) {
        throw new Error(
          "Capacitor Browser is not available"
        );
      }

      await browser.open({
        url:
          result.authUrl,
      });
    } catch (error) {
      console.error(
        "Native Google Calendar connect error:",
        error
      );

      alert(
        "Google予定との連携を開始できませんでした。"
      );

      button.disabled = false;
      button.textContent =
        "Googleと連携";
    }
  }

  async function syncGoogleCalendar(
    button
  ) {
    try {
      button.disabled = true;
      button.textContent = "同期中...";

      const response =
        await fetch(
          "/api/calendar/sync",
          {
            method: "POST",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
          result.message ||
          `同期失敗: ${response.status}`
        );
      }

      alert(
        `同期が完了しました。\n` +
        `Google予定 ${
          result.importedEvents ?? 0
        }件\n` +
        `Notia同期 ${
          result.exportedTasks ?? 0
        }件`
      );

      closeAccountMenu();
    } catch (error) {
      console.error(
        "Google Calendar sync error:",
        error
      );

      alert(
        "Google予定との同期に失敗しました。"
      );

      button.disabled = false;
      button.textContent =
        "今すぐ同期";
    }
  }

  async function disconnectGoogle(
    button
  ) {
    const confirmed =
      confirm(
        "Google予定との連携を解除しますか？"
      );

    if (!confirmed) {
      return;
    }

    try {
      button.disabled = true;
      button.textContent =
        "解除中...";

      const disconnectUrl =
        window.NotiaRuntime
          ?.isNativeApp?.()
          ? "/api/calendar/google/disconnect"
          : "/auth/google/logout";

      const response =
        await fetch(
          disconnectUrl,
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        throw new Error(
          `連携解除失敗: ${response.status}`
        );
      }

      alert(
        "Google予定との連携を解除しました。"
      );

      closeAccountMenu();
    } catch (error) {
      console.error(
        "Google logout error:",
        error
      );

      alert(
        "Google予定との連携を解除できませんでした。"
      );

      button.disabled = false;
      button.textContent =
        "Google連携を解除";
    }
  }

  async function openNotificationSettings() {
  const settings =
    await getNotificationSettings();

  if (!settings) {
    alert(
      "通知設定を取得できませんでした。"
    );
    return;
  }

  closeAccountMenu();

  document
    .querySelectorAll(
      ".notification-settings-sheet"
    )
    .forEach((sheet) => {
      sheet.remove();
    });

  const sheet =
    document.createElement("div");

  sheet.className =
    "notification-settings-sheet";

  sheet.innerHTML = `
    <div class="notification-settings-card">
      <div class="notification-settings-header">
        <h2>
          通知設定
        </h2>

        <button
          class="notification-settings-close"
          type="button"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      <div class="notification-setting-row">
        <div class="notification-setting-text">
          <strong>
            朝のまとめ通知
          </strong>

          <span>
            今日のタスクをお知らせします
          </span>
        </div>

        <input
          id="morningNotificationEnabled"
          type="checkbox"
          ${
            settings.morningEnabled
              ? "checked"
              : ""
          }
        >
      </div>

      <div class="notification-setting-time">
        <label for="morningNotificationTime">
          通知時刻
        </label>

        <input
          id="morningNotificationTime"
          type="time"
          value="${
            settings.morningTime
          }"
        >
      </div>

      <div class="notification-setting-divider"></div>

      <div class="notification-setting-row">
        <div class="notification-setting-text">
          <strong>
            夜の確認通知
          </strong>

          <span>
            今日残っているタスクを確認します
          </span>
        </div>

        <input
          id="eveningNotificationEnabled"
          type="checkbox"
          ${
            settings.eveningEnabled
              ? "checked"
              : ""
          }
        >
      </div>

      <div class="notification-setting-time">
        <label for="eveningNotificationTime">
          通知時刻
        </label>

        <input
          id="eveningNotificationTime"
          type="time"
          value="${
            settings.eveningTime
          }"
        >
      </div>

      <button
        class="notification-settings-save"
        type="button"
      >
        保存
      </button>
    </div>
  `;

  document.body.appendChild(
    sheet
  );

  const closeButton =
    sheet.querySelector(
      ".notification-settings-close"
    );

  const saveButton =
    sheet.querySelector(
      ".notification-settings-save"
    );

  const morningEnabled =
    sheet.querySelector(
      "#morningNotificationEnabled"
    );

  const morningTime =
    sheet.querySelector(
      "#morningNotificationTime"
    );

  const eveningEnabled =
    sheet.querySelector(
      "#eveningNotificationEnabled"
    );

  const eveningTime =
    sheet.querySelector(
      "#eveningNotificationTime"
    );

  function updateTimeDisabledState() {
    morningTime.disabled =
      !morningEnabled.checked;

    eveningTime.disabled =
      !eveningEnabled.checked;
  }

  updateTimeDisabledState();

  morningEnabled.addEventListener(
    "change",
    updateTimeDisabledState
  );

  eveningEnabled.addEventListener(
    "change",
    updateTimeDisabledState
  );

  closeButton.addEventListener(
    "click",
    () => {
      sheet.remove();
    }
  );

  sheet.addEventListener(
    "click",
    (event) => {
      if (event.target === sheet) {
        sheet.remove();
      }
    }
  );

  saveButton.addEventListener(
    "click",
    async () => {
      try {
        saveButton.disabled = true;
        saveButton.textContent =
          "保存中...";

        await saveNotificationSettings({
          morningEnabled:
            morningEnabled.checked,

          morningTime:
            morningTime.value,

          eveningEnabled:
            eveningEnabled.checked,

          eveningTime:
            eveningTime.value,
        });

        sheet.remove();

        alert(
          "通知設定を保存しました。"
        );
      } catch (error) {
        console.error(
          "Notification settings save error:",
          error
        );

        alert(
          "通知設定を保存できませんでした。"
        );

        saveButton.disabled = false;
        saveButton.textContent =
          "保存";
      }
    }
  );
}

  function showAbout() {
    alert(
      "Notia\n\n" +
      "Bon Voyage.\n" +
      "あなたの毎日が、より良い旅になりますように。"
    );
  }

  function openAccountDeleteSheet() {
    closeAccountMenu();

    document
      .querySelectorAll(
        ".account-delete-sheet"
      )
      .forEach((sheet) => {
        sheet.remove();
      });

    const sheet =
      document.createElement("div");

    sheet.className =
      "account-delete-sheet";

    sheet.innerHTML = `
      <div class="account-delete-card">
        <h2>
          アカウントを削除しますか？
        </h2>

        <p>
          会話履歴、タスク、予定、
          ルーティーンなど、
          Notiaに保存されているデータが
          削除されます。
        </p>

        <p class="account-delete-warning">
          この操作は取り消せません。
        </p>

        <div class="account-delete-actions">
          <button
            type="button"
            class="account-delete-cancel"
          >
            キャンセル
          </button>

          <button
            type="button"
            class="account-delete-confirm"
          >
            アカウントを完全に削除
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);

    const cancelButton =
      sheet.querySelector(
        ".account-delete-cancel"
      );

    const deleteButton =
      sheet.querySelector(
        ".account-delete-confirm"
      );

    cancelButton.addEventListener(
      "click",
      () => {
        sheet.remove();
      }
    );

    sheet.addEventListener(
      "click",
      (event) => {
        if (event.target === sheet) {
          sheet.remove();
        }
      }
    );

    deleteButton.addEventListener(
      "click",
      async () => {
        const confirmed =
          confirm(
            "本当にアカウントを完全に削除しますか？\n\nこの操作は取り消せません。"
          );

        if (!confirmed) {
          return;
        }

        try {
          deleteButton.disabled = true;
          cancelButton.disabled = true;

          deleteButton.textContent =
            "削除中...";

          const response =
            await fetch(
              "/api/account",
              {
                method: "DELETE",
              }
            );

          const result =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.error ||
              `削除失敗: ${response.status}`
            );
          }

          window.location.href =
            "/login";
        } catch (error) {
          console.error(
            "Account deletion error:",
            error
          );

          alert(
            "アカウントを削除できませんでした。"
          );

          deleteButton.disabled = false;
          cancelButton.disabled = false;

          deleteButton.textContent =
            "アカウントを完全に削除";
        }
      }
    );
  }

    async function logoutNotia() {
    const confirmed =
      confirm(
        "Notiaからログアウトしますか？"
      );

    if (!confirmed) {
      return;
    }

    const isNative =
      window.NotiaRuntime
        ?.isNativeApp?.() === true;

    if (isNative) {
      try {
        const token =
          await window.NotiaRuntime
            .getAuthToken();

        if (token) {
          try {
            await window.NotiaRuntime
              .unregisterNativePushToken();
          } catch (error) {
            console.warn(
              "Native push unregister failed:",
              error
            );
          }

          try {
            const response =
              await fetch(
                window.NotiaRuntime.apiUrl(
                  "/login/native/logout"
                ),
                {
                  method: "POST",
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );

            if (!response.ok) {
              console.warn(
                "Native token revoke failed:",
                response.status
              );
            }
          } catch (error) {
            console.warn(
              "Native logout request failed:",
              error
            );
          }
        }

        await window.NotiaRuntime
          .removeAuthToken();

        window.location.replace(
          "/login.html"
        );

        return;
      } catch (error) {
        console.error(
          "Native logout error:",
          error
        );

        alert(
          "ログアウトに失敗しました。"
        );

        return;
      }
    }

    try {
      const response =
        await fetch(
          "/login/logout",
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        throw new Error(
          `ログアウト失敗: ${response.status}`
        );
      }

      window.location.href =
        "/login";
    } catch (error) {
      console.error(
        "Notia logout error:",
        error
      );

      alert(
        "ログアウトに失敗しました。"
      );
    }
  }

  async function openAccountMenu(
    accountButton
  ) {
    const existing =
      document.querySelector(
        ".account-menu"
      );

    if (existing) {
      closeAccountMenu();
      return;
    }

    accountButton.setAttribute(
      "aria-expanded",
      "true"
    );

    const menu =
      document.createElement("div");

    menu.className =
      "account-menu";

    menu.innerHTML = `
      <div class="account-menu-section">
        <p class="account-menu-label">
          Google Calendar
        </p>

        <div
          class="account-menu-google"
        >
          接続状態を確認中...
        </div>
      </div>

           <button
        class="account-menu-item account-menu-notifications"
        type="button"
      >
        通知設定
      </button>

      <button
        class="account-menu-item account-menu-about"
        type="button"
      >
        Notiaについて
      </button>

      <a
        class="account-menu-item account-menu-link"
        href="/terms"
      >
        利用規約
      </a>

      <a
        class="account-menu-item account-menu-link"
        href="/privacy"
      >
        プライバシーポリシー
      </a>

      <button
        class="account-menu-item account-menu-logout"
        type="button"
      >
        ログアウト
      </button>

      <button
        class="account-menu-item account-menu-delete"
        type="button"
      >
        アカウントを削除
      </button>
    `;



    document.body.appendChild(
      menu
    );

    const rect =
      accountButton.getBoundingClientRect();

    menu.style.top =
      `${rect.bottom + 8}px`;

    menu.style.right =
      `${Math.max(
        12,
        window.innerWidth -
        rect.right
      )}px`;

    const googleArea =
      menu.querySelector(
        ".account-menu-google"
      );

    const google =
      await getGoogleStatus();

    if (!document.body.contains(menu)) {
      return;
    }

    if (!google) {
      googleArea.textContent =
        "接続状態を取得できませんでした。";
    } else if (!google.connected) {
      if (
        window.NotiaRuntime
          ?.isNativeApp?.()
      ) {
        googleArea.innerHTML = `
          <button
            class="account-menu-primary account-google-connect"
            type="button"
          >
            Googleと連携
          </button>
        `;

        const connectButton =
          googleArea.querySelector(
            ".account-google-connect"
          );

        connectButton.addEventListener(
          "click",
          () =>
            startNativeGoogleCalendarConnect(
              connectButton
            )
        );
      } else {
        googleArea.innerHTML = `
          <a
            class="account-menu-primary"
            href="/auth/google"
          >
            Googleと連携
          </a>
        `;
      }
    } else {
      googleArea.innerHTML = `
        <p class="account-menu-email">
          ${
            google.email ||
            "Google連携済み"
          }
        </p>

        <button
          class="account-menu-primary account-google-sync"
          type="button"
        >
          今すぐ同期
        </button>

        <button
          class="account-menu-secondary account-google-disconnect"
          type="button"
        >
          Google連携を解除
        </button>
      `;

      const syncButton =
        googleArea.querySelector(
          ".account-google-sync"
        );

      const disconnectButton =
        googleArea.querySelector(
          ".account-google-disconnect"
        );

      syncButton.addEventListener(
        "click",
        () =>
          syncGoogleCalendar(
            syncButton
          )
      );

      disconnectButton.addEventListener(
        "click",
        () =>
          disconnectGoogle(
            disconnectButton
          )
      );
    }

    menu
  .querySelector(
    ".account-menu-notifications"
  )
  .addEventListener(
    "click",
    openNotificationSettings
  );

    menu
      .querySelector(
        ".account-menu-about"
      )
      .addEventListener(
        "click",
        showAbout
      );

      menu
      .querySelector(
        ".account-menu-logout"
      )
      .addEventListener(
        "click",
        logoutNotia
      );

    menu
      .querySelector(
        ".account-menu-delete"
      )
      .addEventListener(
        "click",
        openAccountDeleteSheet
      );
  }

      

  accountButtons.forEach(
    (button) => {
      button.setAttribute(
        "aria-haspopup",
        "true"
      );

      button.setAttribute(
        "aria-expanded",
        "false"
      );

      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          openAccountMenu(button);
        }
      );
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      const menu =
        document.querySelector(
          ".account-menu"
        );

      if (
        menu &&
        !menu.contains(
          event.target
        )
      ) {
        closeAccountMenu();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeAccountMenu();
      }
    }
  );

  window.addEventListener(
    "resize",
    closeAccountMenu
  );
})();
