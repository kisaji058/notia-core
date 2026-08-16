const express = require("express");
const router = express.Router();

const googleLoginProvider =
  require("../auth/GoogleLoginProvider");

const {
  getUserById,
  getUserByGoogleSub,
  createUser,
} = require("../../database");

router.get("/google", (req, res) => {
  res.redirect(
    googleLoginProvider.getAuthUrl()
  );
});

router.get(
  "/google/callback",
  async (req, res) => {
    try {
      const { code } = req.query;

      const identity =
        await googleLoginProvider.authenticate(
          code
        );

      let user =
        getUserByGoogleSub(
          identity.googleSub
        );

      if (!user) {
        user = createUser(identity);
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