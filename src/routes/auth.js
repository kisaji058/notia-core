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

router.get("/google", (req, res) => {
  const state =
    crypto.randomBytes(32).toString("hex");

  req.session.googleLoginState =
    state;

  res.redirect(
    googleLoginProvider.getAuthUrl(
      state
    )
  );
});

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

      delete req.session.googleLoginState;

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