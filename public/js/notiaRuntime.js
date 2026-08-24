(function () {
  const API_ORIGIN =
    "https://notia.cecily-ai.top";

  function isNativeApp() {
    return (
      window.location.protocol ===
        "capacitor:" ||
      window.Capacitor
        ?.isNativePlatform
        ?.() === true
    );
  }

  function apiUrl(path) {
    if (
      typeof path !== "string"
    ) {
      return path;
    }

    if (!isNativeApp()) {
      return path;
    }

    if (
      !path.startsWith("/api/") &&
      !path.startsWith("/auth/") &&
      !path.startsWith("/login/")
    ) {
      return path;
    }

    return `${API_ORIGIN}${path}`;
  }

  function loginUrl() {
    return isNativeApp()
      ? "/login.html"
      : "/login";
  }

  function pageUrl(path) {
    if (
      typeof path !== "string" ||
      !isNativeApp()
    ) {
      return path;
    }

    const hashIndex =
      path.indexOf("#");

    const hash =
      hashIndex >= 0
        ? path.slice(hashIndex)
        : "";

    const withoutHash =
      hashIndex >= 0
        ? path.slice(0, hashIndex)
        : path;

    const queryIndex =
      withoutHash.indexOf("?");

    const query =
      queryIndex >= 0
        ? withoutHash.slice(queryIndex)
        : "";

    const pathname =
      queryIndex >= 0
        ? withoutHash.slice(0, queryIndex)
        : withoutHash;

    const routes = {
      "/": "/index.html",
      "/today": "/today.html",
      "/tasks": "/tasks.html",
      "/calendar": "/calendar.html",
      "/routines": "/routines.html",
    };

    if (routes[pathname]) {
      return (
        routes[pathname] +
        query +
        hash
      );
    }

    const taskMatch =
      pathname.match(
        /^\/tasks\/([^/]+)$/
      );

    if (taskMatch) {
      const taskId =
        encodeURIComponent(
          decodeURIComponent(
            taskMatch[1]
          )
        );

      return (
        `/task.html?id=${taskId}` +
        hash
      );
    }

    return path;
  }

  function navigate(path, {
    replace = false,
  } = {}) {
    const destination =
      pageUrl(path);

    if (replace) {
      window.location.replace(
        destination
      );
      return;
    }

    window.location.href =
      destination;
  }

  function setupNativeKeyboard() {
    if (!isNativeApp()) {
      return;
    }

    const keyboard =
      window.Capacitor
        ?.Plugins
        ?.Keyboard;

    if (!keyboard) {
      return;
    }

    keyboard.addListener(
      "keyboardWillShow",
      (info) => {
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${info.keyboardHeight}px`
        );

        document.body.classList.add(
          "keyboard-open"
        );
      }
    );

    keyboard.addListener(
      "keyboardWillHide",
      () => {
        document.documentElement.style.setProperty(
          "--keyboard-height",
          "0px"
        );

        document.body.classList.remove(
          "keyboard-open"
        );
      }
    );
  }

  function rewriteNativeLinks() {
    if (!isNativeApp()) {
      return;
    }

    document
      .querySelectorAll(
        'a[href]'
      )
      .forEach((link) => {
        const href =
          link.getAttribute(
            "href"
          );

        if (
          !href ||
          !href.startsWith("/")
        ) {
          return;
        }

        link.setAttribute(
          "href",
          pageUrl(href)
        );
      });
  }

  const AUTH_TOKEN_KEY =
    "notia_auth_token";

  function getSecureStorage() {
    if (!isNativeApp()) {
      return null;
    }

    return window.Capacitor
      ?.Plugins
      ?.SecureStorage || null;
  }

  async function saveAuthToken(
    token
  ) {
    if (
      typeof token !== "string" ||
      !token
    ) {
      throw new Error(
        "Auth token is required"
      );
    }

    const storage =
      getSecureStorage();

    if (!storage) {
      throw new Error(
        "SecureStorage plugin not available"
      );
    }

    await storage.internalSetItem({
      prefixedKey:
        AUTH_TOKEN_KEY,
      data:
        token,
      sync:
        false,
      access:
        1,
    });
  }

  async function getAuthToken() {
    const storage =
      getSecureStorage();

    if (!storage) {
      return null;
    }

    const result =
      await storage.internalGetItem({
        prefixedKey:
          AUTH_TOKEN_KEY,
        sync:
          false,
      });

    return typeof result?.data ===
      "string"
      ? result.data
      : null;
  }

  async function removeAuthToken() {
    const storage =
      getSecureStorage();

    if (!storage) {
      return false;
    }

    const result =
      await storage.internalRemoveItem({
        prefixedKey:
          AUTH_TOKEN_KEY,
        sync:
          false,
      });

    return result?.success === true;
  }

  let lastHandledAuthUrl = null;
  let lastHandledGoogleCalendarUrl = null;

  async function handleAppUrl(url) {
    if (!url) {
      return;
    }

    if (
      url.startsWith(
        "notia://calendar/google/callback"
      )
    ) {
      if (
        url ===
        lastHandledGoogleCalendarUrl
      ) {
        console.log(
          "Duplicate Google Calendar URL ignored"
        );
        return;
      }

      lastHandledGoogleCalendarUrl =
        url;

      const parsedUrl =
        new URL(url);

      const success =
        parsedUrl.searchParams.get(
          "success"
        ) === "1";

      const browser =
        window.Capacitor
          ?.Plugins
          ?.Browser;

      if (browser) {
        try {
          await browser.close();
        } catch (error) {
          console.warn(
            "Browser close failed:",
            error
          );
        }
      }

      window.dispatchEvent(
        new CustomEvent(
          "notia:google-calendar-callback",
          {
            detail: {
              success,
            },
          }
        )
      );

      return;
    }

    if (
      !url.startsWith(
        "notia://auth/callback"
      )
    ) {
      return;
    }

    if (
      url ===
      lastHandledAuthUrl
    ) {
      console.log(
        "Duplicate auth URL ignored"
      );
      return;
    }

    lastHandledAuthUrl =
      url;

    const parsedUrl =
      new URL(url);

    const code =
      parsedUrl.searchParams.get(
        "code"
      );

    const browser =
      window.Capacitor
        ?.Plugins
        ?.Browser;

    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.warn(
          "Browser close failed:",
          error
        );
      }
    }

    if (!code) {
      console.error(
        "Native auth code missing"
      );
      return;
    }

    try {
      const response =
        await fetch(
          apiUrl(
            "/login/native/exchange"
          ),
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              code,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result?.token
      ) {
        throw new Error(
          "Token exchange failed"
        );
      }

      await saveAuthToken(
        result.token
      );

      const savedToken =
        await getAuthToken();

      if (
        savedToken !==
        result.token
      ) {
        throw new Error(
          "Saved auth token verification failed"
        );
      }

      console.log(
        "Native token exchange succeeded",
        {
          expiresAt:
            result.expiresAt,
          secureStorage:
            true,
        }
      );

      window.location.replace(
        "/"
      );
    } catch (error) {
      console.error(
        "Native token exchange error:",
        error
      );

      alert(
        "Googleログインの完了処理に失敗しました。"
      );
    }
  }

  async function registerNativePushToken() {
    if (!isNativeApp()) {
      return;
    }

    const push =
      window.Capacitor
        ?.Plugins
        ?.NotiaPush;

    if (!push) {
      return;
    }

    const authToken =
      await getAuthToken();

    if (!authToken) {
      return;
    }

    const result =
      await push.getDeviceToken();

    const deviceToken =
      result?.deviceToken;

    if (
      typeof deviceToken !==
        "string" ||
      !deviceToken
    ) {
      return;
    }

    const response =
      await fetch(
        apiUrl(
          "/api/native/push/register"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            deviceToken,
          }),
        }
      );

    if (!response.ok) {
      throw new Error(
        "Native push token registration failed"
      );
    }
  }

  async function getNativePushDeviceToken() {
    if (!isNativeApp()) {
      return null;
    }

    const push =
      window.Capacitor
        ?.Plugins
        ?.NotiaPush;

    if (!push) {
      return null;
    }

    const result =
      await push.getDeviceToken();

    return typeof result?.deviceToken ===
      "string" &&
      result.deviceToken
      ? result.deviceToken
      : null;
  }

  async function unregisterNativePushToken() {
    if (!isNativeApp()) {
      return;
    }

    const push =
      window.Capacitor
        ?.Plugins
        ?.NotiaPush;

    if (!push) {
      return;
    }

    const authToken =
      await getAuthToken();

    if (!authToken) {
      return;
    }

    const result =
      await push.getDeviceToken();

    const deviceToken =
      result?.deviceToken;

    if (
      typeof deviceToken !==
        "string" ||
      !deviceToken
    ) {
      return;
    }

    const response =
      await fetch(
        apiUrl(
          "/api/native/push/unregister"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            deviceToken,
          }),
        }
      );

    if (!response.ok) {
      throw new Error(
        "Native push token unregister failed"
      );
    }
  }

  async function registerAppUrlListener() {
    if (!isNativeApp()) {
      return;
    }

    const appPlugin =
      window.Capacitor
        ?.Plugins
        ?.App;

    if (!appPlugin) {
      console.warn(
        "Capacitor App plugin not available"
      );
      return;
    }

    await appPlugin.addListener(
      "appUrlOpen",
      (event) => {
        handleAppUrl(
          event.url
        );
      }
    );

    const launchHandledKey =
      "notia_launch_url_checked";

    if (
      sessionStorage.getItem(
        launchHandledKey
      ) === "1"
    ) {
      return;
    }

    sessionStorage.setItem(
      launchHandledKey,
      "1"
    );

    const launch =
      await appPlugin.getLaunchUrl();

    if (!launch?.url) {
      return;
    }

    if (
      launch.url.startsWith(
        "notia://auth/callback"
      )
    ) {
      const existingToken =
        await getAuthToken();

      if (existingToken) {
        console.log(
          "Launch auth URL skipped: token already exists"
        );
        return;
      }
    }

    await handleAppUrl(
      launch.url
    );
  }

  window.NotiaRuntime = {
    API_ORIGIN,
    isNativeApp,
    apiUrl,
    loginUrl,
    pageUrl,
    navigate,
    saveAuthToken,
    getAuthToken,
    removeAuthToken,
    getNativePushDeviceToken,
    unregisterNativePushToken,
    handleAppUrl,
  };

  setupNativeKeyboard();

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      rewriteNativeLinks
    );
  } else {
    rewriteNativeLinks();
  }

  registerNativePushToken()
    .catch((error) => {
      console.error(
        "Native push registration error:",
        error
      );
    });

  registerAppUrlListener()
    .catch((error) => {
      console.error(
        "App URL listener error:",
        error
      );
    });
})();
