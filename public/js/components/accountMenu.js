(function () {
  const accountButtons =
    document.querySelectorAll(
      ".account-button"
    );

  if (!accountButtons.length) {
    return;
  }

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
        "Google Calendarとの同期に失敗しました。"
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
        "Google Calendarとの連携を解除しますか？"
      );

    if (!confirmed) {
      return;
    }

    try {
      button.disabled = true;
      button.textContent =
        "解除中...";

      const response =
        await fetch(
          "/auth/google/logout",
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
        "Google Calendarとの連携を解除しました。"
      );

      closeAccountMenu();
    } catch (error) {
      console.error(
        "Google logout error:",
        error
      );

      alert(
        "Google Calendarとの連携を解除できませんでした。"
      );

      button.disabled = false;
      button.textContent =
        "Google連携を解除";
    }
  }

  function showAbout() {
    alert(
      "Notia\n\n" +
      "Bon Voyage.\n" +
      "あなたの毎日が、より良い旅になりますように。"
    );
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
        class="account-menu-item account-menu-about"
        type="button"
      >
        Notiaについて
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
      googleArea.innerHTML = `
        <a
          class="account-menu-primary"
          href="/auth/google"
        >
          Googleと連携
        </a>
      `;
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
        ".account-menu-about"
      )
      .addEventListener(
        "click",
        showAbout
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
