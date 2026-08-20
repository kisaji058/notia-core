const fs = require("fs");
const path = require("path");

const LOG_DIR =
  path.resolve(
    process.cwd(),
    "logs"
  );

function ensureLogDirectory() {
  fs.mkdirSync(
    LOG_DIR,
    {
      recursive: true,
    }
  );
}

function getJapanDate() {
  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function serializeError(error) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || null,
    };
  }

  return {
    message: String(error),
  };
}

function sanitizeContext(context) {
  if (
    !context ||
    typeof context !== "object"
  ) {
    return {};
  }

  const blockedKeys =
    new Set([
      "password",
      "accessToken",
      "access_token",
      "refreshToken",
      "refresh_token",
      "authorization",
      "cookie",
      "clientSecret",
      "client_secret",
    ]);

  return Object.fromEntries(
    Object.entries(context)
      .filter(
        ([key]) =>
          !blockedKeys.has(key)
      )
  );
}

function writeError({
  source,
  error,
  context = {},
}) {
  try {
    ensureLogDirectory();

    const entry = {
      timestamp:
        new Date().toISOString(),
      source:
        source || "unknown",
      error:
        serializeError(error),
      context:
        sanitizeContext(context),
    };

    const filePath =
      path.join(
        LOG_DIR,
        `error-${getJapanDate()}.log`
      );

    fs.appendFileSync(
      filePath,
      `${JSON.stringify(entry)}\n`,
      "utf8"
    );

    return entry;
  } catch (loggingError) {
    console.error(
      "AppLogger failed:",
      loggingError
    );

    return null;
  }
}

function error(
  source,
  originalError,
  context = {}
) {
  const entry =
    writeError({
      source,
      error: originalError,
      context,
    });

  console.error(
    `[${source}]`,
    originalError
  );

  return entry;
}

module.exports = {
  error,
  writeError,
};
