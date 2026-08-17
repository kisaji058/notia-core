const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const googleProvider =
  require("../calendar/providers/GoogleCalendarProvider");

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: "ログインが必要です。",
    });
  }

  next();
}

router.use(requireAuth);

router.post("/google/logout", (req, res) => {
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
});

// Google認証開始
router.get("/google", (req, res) => {
  const state =
    crypto.randomBytes(32).toString("hex");

  req.session.googleCalendarState =
    state;

  res.redirect(
    googleProvider.getAuthUrl(
      state
    )
  );
});

// Google認証コールバック
router.get("/google/callback", async (req, res) => {
  try {
    const {
  code,
  state,
} = req.query;

if (
  !state ||
  !req.session.googleCalendarState ||
  state !==
    req.session.googleCalendarState
) {
  return res
    .status(400)
    .send(
      "認証状態の確認に失敗しました。"
    );
}

delete req.session.googleCalendarState;

    if (!code) {
      return res.status(400).send(
        "認証コードがありません。"
      );
    }

    const account =
  await googleProvider.connect(
    req.session.userId,
    code
  );

console.log(
  "Google OAuth completed:",
  account.email
);

    res.redirect("/calendar");
  } catch (error) {
    console.error(
      "Google OAuth callback error:",
      error
    );

    res.status(500).send(
      "Google予定との接続に失敗しました。"
    );
  }
});

module.exports = router;