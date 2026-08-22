const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const googleProvider =
  require("../calendar/providers/GoogleCalendarProvider");

const {
  consumeState,
} = require("../services/NativeGoogleCalendarOAuthService");

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: "ログインが必要です。",
    });
  }

  next();
}


router.post(
  "/google/logout",
  requireAuth,
  (req, res) => {
  try {
    
    googleProvider.disconnect(
  req.session.userId
);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Google logout error:",
      error
    );

    res.status(500).json({
      success: false,
    });
  }
  }
);

// Google認証開始
router.get(
  "/google",
  requireAuth,
  (req, res) => {
  const state =
    crypto.randomBytes(32).toString("hex");

  req.session.googleCalendarState =
    state;

  res.redirect(
    googleProvider.getAuthUrl(
      state
    )
  );
  }
);

// Google認証コールバック
router.get(
  "/google/callback",
  async (req, res) => {
    let isNativeFlow = false;

    try {
      const {
        code,
        state,
      } = req.query;

      if (
        typeof code !== "string" ||
        !code ||
        typeof state !== "string" ||
        !state
      ) {
        return res
          .status(400)
          .send(
            "認証情報が不足しています。"
          );
      }

      const isWebFlow =
        Boolean(
          req.session?.userId &&
          req.session
            ?.googleCalendarState &&
          state ===
            req.session
              .googleCalendarState
        );

      let userId;

      if (isWebFlow) {
        userId =
          req.session.userId;

        delete req.session
          .googleCalendarState;
      } else {
        const nativeState =
          consumeState(state);

        if (!nativeState) {
          return res
            .status(400)
            .send(
              "認証状態の確認に失敗しました。"
            );
        }

        isNativeFlow = true;
        userId =
          nativeState.userId;
      }

      const account =
        await googleProvider.connect(
          userId,
          code
        );

      console.log(
        "Google OAuth completed:",
        account.email
      );

      if (isNativeFlow) {
        return res.redirect(
          "notia://calendar/google/callback?success=1"
        );
      }

      return res.redirect(
        "/calendar"
      );
    } catch (error) {
      console.error(
        "Google OAuth callback error:",
        error
      );

      if (isNativeFlow) {
        return res.redirect(
          "notia://calendar/google/callback?success=0"
        );
      }

      return res
        .status(500)
        .send(
          "Google予定との接続に失敗しました。"
        );
    }
  }
);


module.exports = router;