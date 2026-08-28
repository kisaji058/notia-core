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

    const environment =
      result?.environment ===
        "production"
        ? "production"
        : "sandbox";

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
            environment,
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

  async function registerNativePushRouteListener() {
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

    await push.addListener(
      "pushRouteReceived",
      (event) => {
        const route =
          event?.route;

        if (
          typeof route !== "string" ||
          !route.startsWith("/")
        ) {
          return;
        }

        navigate(route);
      }
    );
  }

  async function handlePendingPushRoute() {
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

    const result =
      await push.getPendingRoute();

    const route =
      result?.route;

    if (
      typeof route !== "string" ||
      !route.startsWith("/")
    ) {
      return;
    }

    navigate(route);
  }

  async function registerPushResumeListener() {
    if (!isNativeApp()) {
      return;
    }

    const appPlugin =
      window.Capacitor
        ?.Plugins
        ?.App;

    if (!appPlugin) {
      return;
    }

    await appPlugin.addListener(
      "appStateChange",
      (state) => {
        if (!state?.isActive) {
          return;
        }

        handlePendingPushRoute()
          .catch((error) => {
            console.error(
              "Push resume route error:",
              error
            );
          });
      }
    );
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


  function getStoreKit() {
    if (!isNativeApp()) {
      return null;
    }

    return window.Capacitor
      ?.Plugins
      ?.NotiaStoreKit ||
      null;
  }

  function getAdMob() {
    if (!isNativeApp()) {
      return null;
    }

    return window.Capacitor
      ?.Plugins
      ?.AdMob ||
      null;
  }

  async function getSubscriptionStatus() {
    const authToken =
      isNativeApp()
        ? await getAuthToken()
        : null;

    if (
      isNativeApp() &&
      !authToken
    ) {
      throw new Error(
        "Auth token is required"
      );
    }

    const headers = {};

    if (authToken) {
      headers.Authorization =
        `Bearer ${authToken}`;
    }

    const response =
      await fetch(
        apiUrl(
          "/api/subscription/status"
        ),
        {
          method: "GET",
          headers,
          credentials:
            isNativeApp()
              ? "omit"
              : "same-origin",
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        result.error ||
        `Subscription status failed: ${response.status}`
      );
    }

    return result.subscription;
  }

  const ADMOB_USE_TEST_ADS = true;

  const ADMOB_TEST_BANNER_ID =
    "ca-app-pub-3940256099942544/2934735716";

  const ADMOB_PRODUCTION_BANNER_ID =
    "ca-app-pub-4900678819792582/1200959035";

  function getAdMobBannerConfig() {
    return {
      adId:
        ADMOB_USE_TEST_ADS
          ? ADMOB_TEST_BANNER_ID
          : ADMOB_PRODUCTION_BANNER_ID,
      isTesting:
        ADMOB_USE_TEST_ADS,
    };
  }

  let adMobBannerListenersReady = false;
  let adMobInitializationPromise = null;

  async function initializeAdMob(
    adMob
  ) {
    if (!adMobInitializationPromise) {
      adMobInitializationPromise =
        adMob.initialize({
          initializeForTesting: ADMOB_USE_TEST_ADS,
        });
    }

    return adMobInitializationPromise;
  }

  async function ensureAdMobBannerListeners(
    adMob
  ) {
    if (
      !adMob ||
      adMobBannerListenersReady
    ) {
      return;
    }

    await adMob.addListener(
      "bannerAdLoaded",
      () => {
        document.documentElement
          .style
          .setProperty(
            "--ad-banner-height",
            "50px"
          );
      }
    );

    await adMob.addListener(
      "bannerAdFailedToLoad",
      () => {
        document.documentElement
          .style
          .setProperty(
            "--ad-banner-height",
            "0px"
          );
      }
    );

    adMobBannerListenersReady = true;
  }

  async function updateAdBanner() {
    if (!isNativeApp()) {
      return;
    }

    const adMob = getAdMob();

    if (!adMob) {
      console.warn(
        "AdMob plugin not available"
      );
      return;
    }

    const bottomNav =
      document.querySelector(
        ".bottom-nav"
      );

    if (!bottomNav) {
      document.documentElement
        .style
        .setProperty(
          "--ad-banner-height",
          "0px"
        );

      await adMob.removeBanner()
        .catch(() => {});

      return;
    }

    const subscription =
      await getSubscriptionStatus();

    if (
      subscription?.ads !== true
    ) {
      document.documentElement
        .style
        .setProperty(
          "--ad-banner-height",
          "0px"
        );

      await adMob.removeBanner()
        .catch(() => {});
      return;
    }

    document.documentElement
      .style
      .setProperty(
        "--ad-banner-height",
        "0px"
      );

    await ensureAdMobBannerListeners(
      adMob
    );

    await initializeAdMob(
      adMob
    );

    await adMob.removeBanner()
      .catch(() => {});

    await adMob.showBanner({
      adId:
        getAdMobBannerConfig().adId,
      adSize:
        "BANNER",
      position:
        "BOTTOM_CENTER",
      margin:
        64,
      isTesting:
        getAdMobBannerConfig().isTesting,
      npa: true,
    });
  }

  async function getCurrentSubscription() {
    const storeKit =
      getStoreKit();

    if (!storeKit) {
      return {
        activeProductId: null,
        entitlements: [],
      };
    }

    return storeKit
      .getCurrentEntitlements();
  }

  async function syncDevSubscription(
    entitlement
  ) {
    if (
      !entitlement ||
      typeof entitlement.productId !==
        "string" ||
      !entitlement.productId
    ) {
      throw new Error(
        "Subscription entitlement is required"
      );
    }

    const authToken =
      isNativeApp()
        ? await getAuthToken()
        : null;

    if (
      isNativeApp() &&
      !authToken
    ) {
      throw new Error(
        "Auth token is required"
      );
    }

    const headers = {
      "Content-Type":
        "application/json",
    };

    if (authToken) {
      headers.Authorization =
        `Bearer ${authToken}`;
    }

    const response =
      await fetch(
        apiUrl(
          "/api/subscription/dev-sync"
        ),
        {
          method: "POST",
          headers,
          credentials:
            isNativeApp()
              ? "omit"
              : "same-origin",
          body: JSON.stringify({
            productId:
              entitlement.productId,
            originalTransactionId:
              entitlement
                .originalTransactionId ||
              null,
            expirationDate:
              entitlement
                .expirationDate ||
              null,
          }),
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        result.error ||
        `Subscription sync failed: ${response.status}`
      );
    }

    return result;
  }

  async function syncAppleSubscription(
    entitlement
  ) {
    if (
      !entitlement ||
      typeof entitlement.signedTransaction !==
        "string" ||
      !entitlement.signedTransaction
    ) {
      throw new Error(
        "Signed transaction is required"
      );
    }

    const authToken =
      isNativeApp()
        ? await getAuthToken()
        : null;

    if (
      isNativeApp() &&
      !authToken
    ) {
      throw new Error(
        "Auth token is required"
      );
    }

    const headers = {
      "Content-Type":
        "application/json",
    };

    if (authToken) {
      headers.Authorization =
        `Bearer ${authToken}`;
    }

    const response =
      await fetch(
        apiUrl(
          "/api/subscription/sync"
        ),
        {
          method: "POST",
          headers,
          credentials:
            isNativeApp()
              ? "omit"
              : "same-origin",
          body: JSON.stringify({
            signedTransaction:
              entitlement
                .signedTransaction,
          }),
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        result.error ||
        `Subscription sync failed: ${response.status}`
      );
    }

    return result;
  }

  async function purchaseSubscription(
    productId
  ) {
    const storeKit =
      getStoreKit();

    if (!storeKit) {
      throw new Error(
        "StoreKit plugin not available"
      );
    }

    const purchase =
      await storeKit.purchase({
        productId,
      });

    if (
      purchase?.cancelled ||
      purchase?.pending ||
      purchase?.success !== true
    ) {
      return purchase;
    }

    const entitlements =
      await storeKit
        .getCurrentEntitlements();

    const activeProductId =
      entitlements
        ?.activeProductId;

    const activeEntitlement =
      Array.isArray(
        entitlements?.entitlements
      )
        ? entitlements.entitlements.find(
            (item) =>
              item?.productId ===
              activeProductId
          )
        : null;

    if (activeEntitlement) {
      await syncAppleSubscription(
        activeEntitlement
      );

      await updateAdBanner();
    }

    return {
      ...purchase,
      activeProductId,
      entitlements:
        entitlements?.entitlements ||
        [],
    };
  }

  async function restoreSubscription() {
    const storeKit =
      getStoreKit();

    if (!storeKit) {
      throw new Error(
        "StoreKit plugin not available"
      );
    }

    const restored =
      await storeKit
        .restorePurchases();

    const activeProductId =
      restored?.activeProductId;

    const activeEntitlement =
      Array.isArray(
        restored?.entitlements
      )
        ? restored.entitlements.find(
            (item) =>
              item?.productId ===
              activeProductId
          )
        : null;

    if (activeEntitlement) {
      await syncAppleSubscription(
        activeEntitlement
      );

      await updateAdBanner();
    }

    return restored;
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
    getStoreKit,
    getCurrentSubscription,
    syncDevSubscription,
    syncAppleSubscription,
    purchaseSubscription,
    restoreSubscription,
    updateAdBanner,
  };

  setupNativeKeyboard();

  const startAdBanner = () => {
    updateAdBanner()
      .catch((error) => {
        console.error(
          "AdMob banner startup error:",
          error
        );
      });
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        rewriteNativeLinks();
        startAdBanner();
      }
    );
  } else {
    rewriteNativeLinks();
    startAdBanner();
  }

  registerNativePushToken()
    .catch((error) => {
      console.error(
        "Native push registration error:",
        error
      );
    });

  registerNativePushRouteListener()
    .then(() =>
      handlePendingPushRoute()
    )
    .catch((error) => {
      console.error(
        "Pending push route error:",
        error
      );
    });

  registerPushResumeListener()
    .catch((error) => {
      console.error(
        "Push resume listener error:",
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
