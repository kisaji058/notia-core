const crypto = require("crypto");

const {
  createNativeAuthCodeRecord,
  getNativeAuthCodeByHash,
  markNativeAuthCodeUsed,
  createNativeAuthTokenRecord,
  getNativeAuthTokenByHash,
  markNativeAuthTokenUsed,
  revokeNativeAuthTokenByHash,
} = require("../../database");

const AUTH_CODE_TTL_MS =
  5 * 60 * 1000;

const AUTH_TOKEN_TTL_MS =
  30 * 24 * 60 * 60 * 1000;

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

function createAuthCode(userId) {
  if (!userId) {
    throw new Error(
      "NativeAuthService: userId is required"
    );
  }

  const code =
    createRandomValue(32);

  const codeHash =
    hashValue(code);

  const expiresAt =
    new Date(
      Date.now() +
      AUTH_CODE_TTL_MS
    );

  createNativeAuthCodeRecord(
    userId,
    codeHash,
    toSqliteDate(expiresAt)
  );

  return {
    code,
    expiresAt,
  };
}

function exchangeAuthCode(code) {
  if (!code) {
    return null;
  }

  const codeHash =
    hashValue(code);

  const row =
    getNativeAuthCodeByHash(
      codeHash
    );

  if (!row || row.used_at) {
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
    markNativeAuthCodeUsed(
      row.id
    );

  if (used.changes !== 1) {
    return null;
  }

  const token =
    createRandomValue(48);

  const tokenHash =
    hashValue(token);

  const tokenExpiresAt =
    new Date(
      Date.now() +
      AUTH_TOKEN_TTL_MS
    );

  createNativeAuthTokenRecord(
    row.user_id,
    tokenHash,
    toSqliteDate(
      tokenExpiresAt
    )
  );

  return {
    token,
    userId:
      row.user_id,
    expiresAt:
      tokenExpiresAt,
  };
}

function authenticateToken(token) {
  if (!token) {
    return null;
  }

  const tokenHash =
    hashValue(token);

  const row =
    getNativeAuthTokenByHash(
      tokenHash
    );

  if (!row || row.revoked_at) {
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

  markNativeAuthTokenUsed(
    row.id
  );

  return {
    userId:
      row.user_id,
    tokenId:
      row.id,
  };
}

function revokeToken(token) {
  if (!token) {
    return false;
  }

  const result =
    revokeNativeAuthTokenByHash(
      hashValue(token)
    );

  return result.changes > 0;
}

module.exports = {
  createAuthCode,
  exchangeAuthCode,
  authenticateToken,
  revokeToken,
};
