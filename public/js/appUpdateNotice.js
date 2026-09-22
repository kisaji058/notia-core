(function () {
  "use strict";

  function compareVersions(current, latest) {
    const pattern = /^\d+(?:\.\d+){0,3}$/;

    if (!pattern.test(current) || !pattern.test(latest)) {
      return 0;
    }

    const a = current.split(".").map(Number);
    const b = latest.split(".").map(Number);

    for (let i = 0; i < 4; i += 1) {
      const difference = (a[i] || 0) - (b[i] || 0);
      if (difference !== 0) return difference;
    }

    return 0;
  }

  function showUpdateNotice(storeUrl) {
    if (document.getElementById("notiaUpdateNotice")) return;

    const overlay = document.createElement("div");
    overlay.id = "notiaUpdateNotice";
    overlay.className = "notia-update-overlay";

    const card = document.createElement("section");
    card.className = "notia-update-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "アプリのアップデート");

    const title = document.createElement("h2");
    title.textContent = "アップデートがあります";

    const description = document.createElement("p");
    description.textContent =
      "新しいバージョンのNotiaが公開されました。";

    const updateButton = document.createElement("button");
    updateButton.type = "button";
    updateButton.className = "notia-update-primary";
    updateButton.textContent = "アップデートする";
    updateButton.addEventListener("click", () => {
      window.location.href = storeUrl;
    });

    const laterButton = document.createElement("button");
    laterButton.type = "button";
    laterButton.className = "notia-update-later";
    laterButton.textContent = "あとで";
    laterButton.addEventListener("click", () => overlay.remove());

    card.append(title, description, updateButton, laterButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    updateButton.focus();
  }

  async function checkAppUpdate() {
    const runtime = window.NotiaRuntime;

    if (!runtime?.isNativeApp?.()) return;

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin?.getInfo) return;

    try {
      const appInfo = await appPlugin.getInfo();

      const platform = window.Capacitor.getPlatform();
      if (platform !== "ios" && platform !== "android") return;

      const response = await fetch(
        runtime.apiUrl("/api/app-version"),
        { cache: "no-store" }
      );

      if (!response.ok) return;

      const versions = await response.json();
      const published = versions?.[platform];

      if (
        !published?.latestVersion ||
        !published?.storeUrl ||
        !/^https:\/\//i.test(published.storeUrl)
      ) {
        return;
      }

      if (
        compareVersions(
          appInfo.version,
          published.latestVersion
        ) < 0
      ) {
        showUpdateNotice(published.storeUrl);
      }
    } catch (error) {
      console.warn("App update check skipped:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAppUpdate, {
      once: true
    });
  } else {
    checkAppUpdate();
  }
})();
