const crypto = require("crypto");

const {
  createNativeGoogleCalendarStateRecord,
  getNativeGoogleCalendarStateByHash,
  markNativeGoogleCalendarStateUsed,
} = require("../../database");

const STATE_TTL_MS =
  5 * 60 * 1000;

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function createRandomValue(
  size = 32
) {
  return crypto
    .randomBytes(size)
    .toString("base64url");
}

function toSqliteDate(date) {
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
}

function createState(userId) {
  if (!userId) {
    throw new Error(
      "NativeGoogleCalendarOAuthService: userId is required"
    );
  }

  const state =
    createRandomValue(32);

  const stateHash =
    hashValue(state);

  const expiresAt =
    new Date(
      Date.now() +
      STATE_TTL_MS
    );

  createNativeGoogleCalendarStateRecord(
    userId,
    stateHash,
    toSqliteDate(expiresAt)
  );

  return {
    state,
    expiresAt,
  };
}

function consumeState(state) {
  if (
    typeof state !== "string" ||
    !state
  ) {
    return null;
  }

  const stateHash =
    hashValue(state);

  const row =
    getNativeGoogleCalendarStateByHash(
      stateHash
    );

  if (
    !row ||
    row.used_at
  ) {
    return null;
  }

  const expiresAt =
    new Date(
      `${row.expires_at}Z`
    );

  if (
    Number.isNaN(
      expiresAt.getTime()
    ) ||
    expiresAt.getTime() <=
      Date.now()
  ) {
    return null;
  }

  const used =
    markNativeGoogleCalendarStateUsed(
      row.id
    );

  if (
    used.changes !== 1
  ) {
    return null;
  }

  return {
    userId:
      row.user_id,
  };
}

module.exports = {
  createState,
  consumeState,
};
