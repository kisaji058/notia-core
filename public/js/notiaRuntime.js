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

  async function handleAppUrl(url) {
    if (
      !url ||
      !url.startsWith(
        "notia://auth/callback"
      )
    ) {
      return;
    }

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

      console.log(
        "Native token exchange succeeded",
        {
          expiresAt:
            result.expiresAt,
        }
      );

      alert(
        "Googleログイン認証成功\nBearer Tokenの発行まで完了しました。"
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

    const launch =
      await appPlugin.getLaunchUrl();

    if (launch?.url) {
      handleAppUrl(
        launch.url
      );
    }
  }

  window.NotiaRuntime = {
    API_ORIGIN,
    isNativeApp,
    apiUrl,
    loginUrl,
    handleAppUrl,
  };

  registerAppUrlListener()
    .catch((error) => {
      console.error(
        "App URL listener error:",
        error
      );
    });
})();
