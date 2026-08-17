(function () {
  const originalFetch =
    window.fetch.bind(window);

  window.fetch = async function (
    input,
    init
  ) {
    const response =
      await originalFetch(
        input,
        init
      );

    if (response.status === 401) {
      const currentPath =
        window.location.pathname;

      if (
        currentPath !== "/login"
      ) {
        window.location.replace(
          "/login"
        );
      }
    }

    return response;
  };
})();
