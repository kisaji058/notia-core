const express = require("express");
const router = express.Router();

const googleProvider =
  require("../calendar/providers/GoogleCalendarProvider");

router.post("/google/logout", (req, res) => {
  try {
    
    googleProvider.disconnect();

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
  res.redirect(
  googleProvider.getAuthUrl()
);
});

// Google認証コールバック
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send(
        "認証コードがありません。"
      );
    }

    const account =
  await googleProvider.connect(code);

console.log(
  "Google OAuth completed:",
  account.email
);

    res.send(
      "Google Calendarとの接続に成功しました。"
    );
  } catch (error) {
    console.error(
      "Google OAuth callback error:",
      error
    );

    res.status(500).send(
      "Google Calendarとの接続に失敗しました。"
    );
  }
});

// Google Calendarの予定取得
router.get(
  "/google/callback",
  async (req, res) => {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).send(
          "認証コードがありません。"
        );
      }

      const account =
        await googleProvider.connect(code);

      console.log(
        "Google OAuth completed:",
        account.email
      );

      res.send(
        "Google Calendarとの接続に成功しました。"
      );
    } catch (error) {
      console.error(
        "Google OAuth callback error:",
        error
      );

      res.status(500).send(
        "Google Calendarとの接続に失敗しました。"
      );
    }
  }
);

module.exports = router;