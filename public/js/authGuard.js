(function () {
  const originalFetch =
    window.fetch.bind(window);

  window.fetch = async function (
    input,
    init
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

    const response =
      await originalFetch(
        requestInput,
        init
      );

    if (response.status === 401) {
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
