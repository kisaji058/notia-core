(function () {
  const originalFetch =
    window.fetch.bind(window);

  function isApiRequest(input) {
    if (typeof input !== "string") {
      return false;
    }

    if (input.startsWith("/api/")) {
      return true;
    }

    const apiOrigin =
      "https://notia.cecily-ai.top";

    return input.startsWith(
      `${apiOrigin}/api/`
    );
  }

  window.fetch = async function (
    input,
    init = {}
  ) {
    let requestInput = input;

    if (
      typeof input === "string" &&
      window.NotiaRuntime
    ) {
      requestInput =
        window.NotiaRuntime.apiUrl(
          input
        );
    }

    const requestInit = {
      ...init,
    };

    if (
      window.NotiaRuntime
        ?.isNativeApp?.() &&
      isApiRequest(
        requestInput
      )
    ) {
      const token =
        await window.NotiaRuntime
          .getAuthToken();

      if (token) {
        const headers =
          new Headers(
            requestInit.headers || {}
          );

        headers.set(
          "Authorization",
          `Bearer ${token}`
        );

        requestInit.headers =
          headers;
      }
    }

    const response =
      await originalFetch(
        requestInput,
        requestInit
      );

    if (response.status === 401) {
      const isNative =
        window.NotiaRuntime
          ?.isNativeApp?.() === true;

      if (
        isNative &&
        isApiRequest(
          requestInput
        )
      ) {
        try {
          await window.NotiaRuntime
            .removeAuthToken();
        } catch (error) {
          console.warn(
            "Auth token removal failed:",
            error
          );
        }
      }

      const loginUrl =
        window.NotiaRuntime
          ?.loginUrl?.() ||
        "/login";

      const currentPath =
        window.location.pathname;

      if (
        currentPath !== "/login" &&
        currentPath !== "/login.html"
      ) {
        window.location.replace(
          loginUrl
        );
      }
    }

    return response;
  };
})();
