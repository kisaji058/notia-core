const express = require("express");

const {
  deleteUserAccount,
} = require("../../database");

const router = express.Router();

router.delete(
  "/account",
  (req, res) => {
    const userId =
      req.session.userId;

    try {
      const deleted =
        deleteUserAccount(userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error:
            "アカウントが見つかりません。",
        });
      }

      req.session.destroy((error) => {
        if (error) {
          console.error(
            "Account session destroy error:",
            error
          );

          res.clearCookie("connect.sid");

          return res.status(500).json({
            success: false,
            error:
              "アカウントは削除されましたが、ログアウト処理に失敗しました。",
          });
        }

        res.clearCookie("connect.sid");

        return res.json({
          success: true,
        });
      });
    } catch (error) {
      console.error(
        "Account deletion error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "アカウントの削除に失敗しました。",
      });
    }
  }
);

module.exports = router;
