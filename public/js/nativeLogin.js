(function () {
  function isNativeApp() {
    return (
      window.NotiaRuntime
        ?.isNativeApp?.() === true
    );
  }

  async function openNativeGoogleLogin(
    event
  ) {
    if (!isNativeApp()) {
      return;
    }

    event.preventDefault();

    const browser =
      window.Capacitor
        ?.Plugins
        ?.Browser;

    if (!browser) {
      console.error(
        "Capacitor Browser plugin not available"
      );

      alert(
        "Googleログインを開始できませんでした。"
      );

      return;
    }

    const url =
      window.NotiaRuntime.apiUrl(
        "/login/native/google"
      );

    await browser.open({
      url,
    });
  }

  async function verifyStoredToken() {
    if (!isNativeApp()) {
      return;
    }

    const token =
      await window.NotiaRuntime
        ?.getAuthToken?.();

    console.log(
      "Native auth token restored:",
      Boolean(token)
    );

    if (token) {
      alert(
        "KeychainからTokenを復元できました。"
      );
    }
  }

  function initialize() {
    verifyStoredToken().catch(
      (error) => {
        console.error(
          "Stored token check failed:",
          error
        );
      }
    );

    const googleLink =
      document.querySelector(
        ".google-login-link"
      );

    if (!googleLink) {
      return;
    }

    googleLink.addEventListener(
      "click",
      (event) => {
        openNativeGoogleLogin(
          event
        ).catch((error) => {
          console.error(
            "Native Google login error:",
            error
          );
        });
      }
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();
