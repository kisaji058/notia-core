(function () {
  "use strict";

  const STORE_URL =
    "https://apps.apple.com/app/id6805034281?action=write-review";
  const FIRST_USE_KEY = "notia.review.firstUseDate.v1";
  const NEXT_PROMPT_KEY = "notia.review.nextPromptDate.v1";
  const COMPLETED_KEY = "notia.review.storeOpened.v1";
  const DAY_MS = 24 * 60 * 60 * 1000;

  function dayNumber(date) {
    return Math.floor(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ) / DAY_MS
    );
  }

  function readDay(key) {
    const value = Number(localStorage.getItem(key));
    return Number.isInteger(value) && value > 0
      ? value
      : null;
  }

  function isIOSApp() {
    return (
      window.NotiaRuntime?.isNativeApp?.() === true &&
      window.Capacitor?.getPlatform?.() === "ios"
    );
  }

  function recordFirstUse() {
    if (!isIOSApp()) return;

    try {
      if (readDay(FIRST_USE_KEY) === null) {
        localStorage.setItem(
          FIRST_USE_KEY,
          String(dayNumber(new Date()))
        );
      }
    } catch (error) {
      console.warn("Review first-use save skipped:", error);
    }
  }

  function closePrompt() {
    document.getElementById("notiaReviewOverlay")?.remove();
  }

  function showPrompt() {
    if (
      document.getElementById("notiaReviewOverlay") ||
      document.querySelector(
        '#chatOnboarding:not([hidden]), #notiaUpdateNotice'
      )
    ) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "notiaReviewOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:10000;" +
      "display:flex;align-items:center;justify-content:center;" +
      "padding:24px;background:rgba(15,35,39,.55)";

    const card = document.createElement("section");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "Notiaの評価のお願い");
    card.style.cssText =
      "box-sizing:border-box;width:min(100%,360px);" +
      "padding:28px 22px;background:#fff;border-radius:22px;" +
      "box-shadow:0 16px 48px rgba(0,0,0,.18);" +
      "text-align:center;color:#26383a";

    const title = document.createElement("h2");
    title.textContent = "Notiaの使い心地はいかがですか？";
    title.style.cssText =
      "margin:0 0 12px;font-size:20px;line-height:1.5";

    const message = document.createElement("p");
    message.textContent =
      "いつもNotiaを使ってくれてありがとう！" +
      "よかったら、App Storeで評価してもらえるとうれしいです。";
    message.style.cssText =
      "margin:0 0 22px;font-size:14px;line-height:1.8";

    const reviewButton = document.createElement("button");
    reviewButton.type = "button";
    reviewButton.textContent = "App Storeで評価する";
    reviewButton.style.cssText =
      "width:100%;padding:14px;border:0;border-radius:12px;" +
      "background:#159e99;color:white;font-size:15px;" +
      "font-weight:700;cursor:pointer";

    const laterButton = document.createElement("button");
    laterButton.type = "button";
    laterButton.textContent = "あとで";
    laterButton.style.cssText =
      "margin-top:12px;padding:12px;border:0;" +
      "background:transparent;color:#54696b;font-size:14px;" +
      "cursor:pointer";

    reviewButton.addEventListener("click", () => {
      try {
        localStorage.setItem(COMPLETED_KEY, "1");
      } catch (error) {
        console.warn("Review completion save skipped:", error);
      }
      closePrompt();
      window.location.href = STORE_URL;
    });

    laterButton.addEventListener("click", () => {
      try {
        localStorage.setItem(
          NEXT_PROMPT_KEY,
          String(dayNumber(new Date()) + 7)
        );
      } catch (error) {
        console.warn("Review reminder save skipped:", error);
      }
      closePrompt();
    });

    card.append(title, message, reviewButton, laterButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    reviewButton.focus();
  }

  function considerPrompt() {
    if (!isIOSApp()) return;

    try {
      recordFirstUse();

      const today = dayNumber(new Date());
      const firstUse = readDay(FIRST_USE_KEY);
      const nextPrompt = readDay(NEXT_PROMPT_KEY);

      if (
        localStorage.getItem(COMPLETED_KEY) === "1" ||
        firstUse === null ||
        today - firstUse < 2 ||
        (nextPrompt !== null && today < nextPrompt)
      ) {
        return;
      }

      showPrompt();
    } catch (error) {
      console.warn("Review prompt skipped:", error);
    }
  }

  recordFirstUse();


  window.addEventListener("notia:registration-succeeded", considerPrompt);
})();
