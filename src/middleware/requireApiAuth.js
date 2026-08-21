const {
  getUserById,
} = require("../../database");

const {
  authenticateToken,
} = require(
  "../services/NativeAuthService"
);

function getBearerToken(req) {
  const authorization =
    req.get("authorization");

  if (
    typeof authorization !==
    "string"
  ) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (!match) {
    return null;
  }

  return match[1].trim();
}

function requireApiAuth(
  req,
  res,
  next
) {
  const sessionUserId =
    req.session?.userId;

  if (sessionUserId) {
    const user =
      getUserById(
        sessionUserId
      );

    if (user) {
      req.userId =
        sessionUserId;

      req.authType =
        "session";

      return next();
    }

    req.session.destroy(
      () => {}
    );

    res.clearCookie(
      "connect.sid"
    );
  }

  const token =
    getBearerToken(req);

  if (token) {
    const authenticated =
      authenticateToken(token);

    if (authenticated) {
      const user =
        getUserById(
          authenticated.userId
        );

      if (user) {
        req.userId =
          authenticated.userId;

        req.authTokenId =
          authenticated.tokenId;

        req.authType =
          "bearer";

        return next();
      }
    }
  }

  return res.status(401).json({
    error:
      "ログインが必要です。",
  });
}

module.exports =
  requireApiAuth;
