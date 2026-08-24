const crypto = require("crypto");

const {
  createNativeAppleAuthNonceRecord,
  getNativeAppleAuthNonceByHash,
  markNativeAppleAuthNonceUsed,
} = require("../../database");

const NONCE_TTL_MS =
  5 * 60 * 1000;

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function toSqliteDate(date) {
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
}

function createNonce() {
  const nonce =
    crypto
      .randomBytes(32)
      .toString("base64url");

  const nonceHash =
    hashValue(nonce);

  const expiresAt =
    new Date(
      Date.now() +
      NONCE_TTL_MS
    );

  createNativeAppleAuthNonceRecord(
    nonceHash,
    toSqliteDate(expiresAt)
  );

  return {
    nonce,
    expiresAt,
  };
}

function consumeNonce(nonce) {
  if (
    typeof nonce !== "string" ||
    !nonce
  ) {
    return false;
  }

  const nonceHash =
    hashValue(nonce);

  const row =
    getNativeAppleAuthNonceByHash(
      nonceHash
    );

  if (
    !row ||
    row.used_at
  ) {
    return false;
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
    return false;
  }

  const result =
    markNativeAppleAuthNonceUsed(
      row.id
    );

  return result.changes === 1;
}

module.exports = {
  createNonce,
  consumeNonce,
};
