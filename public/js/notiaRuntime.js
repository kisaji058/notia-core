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

  async function handleAppUrl(url) {
    if (
      !url ||
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

    const existingToken =
      await getAuthToken();

    if (existingToken) {
      console.log(
        "Launch auth URL skipped: token already exists"
      );
      return;
    }

    const launch =
      await appPlugin.getLaunchUrl();

    if (launch?.url) {
      await handleAppUrl(
        launch.url
      );
    }
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
    handleAppUrl,
  };

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

  registerAppUrlListener()
    .catch((error) => {
      console.error(
        "App URL listener error:",
        error
      );
    });
})();
