const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const googleLoginProvider =
  require("../auth/GoogleLoginProvider");

const {
  getUserById,
} = require("../../database");

const authService =
  require("../services/AuthService");

const {
  createAuthCode,
  exchangeAuthCode,
  revokeToken,
} = require(
  "../services/NativeAuthService"
);

router.get("/google", (req, res) => {
  const state =
    crypto.randomBytes(32).toString("hex");

  req.session.googleLoginState =
    state;

  delete req.session.googleLoginMode;

  res.redirect(
    googleLoginProvider.getAuthUrl(
      state
    )
  );
});

router.get(
  "/native/google",
  (req, res) => {
    const state =
      crypto.randomBytes(32)
        .toString("hex");

    req.session.googleLoginState =
      state;

    req.session.googleLoginMode =
      "native";

    res.redirect(
      googleLoginProvider.getAuthUrl(
        state
      )
    );
  }
);

router.get(
  "/google/callback",
  async (req, res) => {
    try {
      const {
        code,
        state,
      } = req.query;

      if (
        !state ||
        !req.session.googleLoginState ||
        state !==
          req.session.googleLoginState
      ) {
        return res
          .status(400)
          .send(
            "認証状態の確認に失敗しました。"
          );
      }

      const isNativeLogin =
        req.session.googleLoginMode ===
        "native";

      delete req.session.googleLoginState;
      delete req.session.googleLoginMode;

      const identity =
        await googleLoginProvider.authenticate(
          code
        );

      const user =
        authService.findOrCreateUser({
          provider: "google",
          providerUserId:
            identity.googleSub,
          email: identity.email,
          displayName:
            identity.displayName,
        });

      if (isNativeLogin) {
        const {
          code: nativeCode,
        } = createAuthCode(
          user.id
        );

        return res.redirect(
          "notia://auth/callback?code=" +
          encodeURIComponent(
            nativeCode
          )
        );
      }

      req.session.userId = user.id;

      req.session.save((error) => {
        if (error) {
          console.error(
            "Session save error:",
            error
          );

          return res
            .status(500)
            .send(
              "ログイン情報の保存に失敗しました。"
            );
        }

        res.redirect("/");
      });
    } catch (error) {
      console.error(
        "Notia login error:",
        error
      );

      res
        .status(500)
        .send(
          "Googleログインに失敗しました。"
        );
    }
  }
);

router.post(
  "/native/exchange",
  express.json(),
  (req, res) => {
    try {
      const code =
        req.body?.code;

      if (
        typeof code !== "string" ||
        !code
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "認証コードが必要です。",
        });
      }

      const result =
        exchangeAuthCode(code);

      if (!result) {
        return res.status(401).json({
          ok: false,
          error:
            "認証コードが無効です。",
        });
      }

      return res.json({
        ok: true,
        token:
          result.token,
        expiresAt:
          result.expiresAt
            .toISOString(),
      });
    } catch (error) {
      console.error(
        "Native auth exchange error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "ログイン処理に失敗しました。",
      });
    }
  }
);

router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({
      authenticated: false,
    });
  }

  const user =
    getUserById(
      req.session.userId
    );

  if (!user) {
    return res.json({
      authenticated: false,
    });
  }

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName:
        user.display_name,
    },
  });
});

router.post(
  "/native/logout",
  (req, res) => {
    try {
      const authorization =
        req.get("authorization") || "";

      const match =
        authorization.match(
          /^Bearer\s+(.+)$/i
        );

      if (match?.[1]) {
        revokeToken(
          match[1].trim()
        );
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Native logout error:",
        error
      );

      return res.status(500).json({
        success: false,
      });
    }
  }
);

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(
        "Logout error:",
        error
      );

      return res.status(500).json({
        success: false,
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      success: true,
    });
  });
});

module.exports = router;