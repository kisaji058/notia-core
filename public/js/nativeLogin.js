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

  async function openNativeAppleLogin(
    event
  ) {
    if (!isNativeApp()) {
      return;
    }

    event.preventDefault();

    const appleAuth =
      window.Capacitor
        ?.Plugins
        ?.NotiaAppleAuth;

    if (!appleAuth) {
      alert(
        "Appleログインを開始できませんでした。"
      );
      return;
    }

    const startResponse =
      await fetch(
        window.NotiaRuntime.apiUrl(
          "/login/native/apple/start"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({}),
        }
      );

    const startResult =
      await startResponse.json();

    if (
      !startResponse.ok ||
      !startResult?.nonce
    ) {
      throw new Error(
        "Apple nonce request failed"
      );
    }

    const appleResult =
      await appleAuth.signIn({
        nonce:
          startResult.nonce,
      });

    if (
      !appleResult?.identityToken
    ) {
      throw new Error(
        "Apple identity token missing"
      );
    }

    const loginResponse =
      await fetch(
        window.NotiaRuntime.apiUrl(
          "/login/native/apple"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            identityToken:
              appleResult.identityToken,

            nonce:
              startResult.nonce,

            displayName:
              appleResult.displayName ||
              null,
          }),
        }
      );

    const loginResult =
      await loginResponse.json();

    if (
      !loginResponse.ok ||
      !loginResult?.code
    ) {
      throw new Error(
        "Apple login verification failed"
      );
    }

    const exchangeResponse =
      await fetch(
        window.NotiaRuntime.apiUrl(
          "/login/native/exchange"
        ),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            code:
              loginResult.code,
          }),
        }
      );

    const exchangeResult =
      await exchangeResponse.json();

    if (
      !exchangeResponse.ok ||
      !exchangeResult?.token
    ) {
      throw new Error(
        "Apple token exchange failed"
      );
    }

    await window.NotiaRuntime
      .saveAuthToken(
        exchangeResult.token
      );

    const savedToken =
      await window.NotiaRuntime
        .getAuthToken();

    if (
      savedToken !==
      exchangeResult.token
    ) {
      throw new Error(
        "Apple auth token save failed"
      );
    }

    window.location.replace("/");
  }

  function initialize() {
    const googleLink =
      document.querySelector(
        ".google-login-link"
      );

    if (googleLink) {
      googleLink.addEventListener(
        "click",
        (event) => {
          openNativeGoogleLogin(
            event
          ).catch(() => {
            alert(
              "Googleログインを開始できませんでした。"
            );
          });
        }
      );
    }

    const appleButton =
      document.getElementById(
        "apple-login-button"
      );

    if (appleButton) {
      appleButton.addEventListener(
        "click",
        (event) => {
          openNativeAppleLogin(
            event
          ).catch((error) => {
            if (
              String(
                error?.message || ""
              ).includes(
                "APPLE_AUTH_CANCELLED"
              )
            ) {
              return;
            }

            alert(
              "Appleログインに失敗しました。"
            );
          });
        }
      );
    }
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
