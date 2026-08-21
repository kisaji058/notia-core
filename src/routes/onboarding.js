const express = require("express");

const {
  getUserById,
  markOnboardingCompleted,
} = require("../../database");

const router = express.Router();

router.get(
  "/onboarding",
  (req, res) => {
    try {
      const user = getUserById(
        req.userId
      );

      if (!user) {
        return res.status(404).json({
          error:
            "ユーザーが見つかりません。",
        });
      }

      return res.json({
        completed:
          user.onboarding_completed === 1,
      });
    } catch (error) {
      console.error(
        "Onboarding status error:",
        error
      );

      return res.status(500).json({
        error:
          "オンボーディング状態の取得に失敗しました。",
      });
    }
  }
);

router.post(
  "/onboarding/complete",
  (req, res) => {
    try {
      const result =
        markOnboardingCompleted(
          req.userId
        );

      if (result.changes === 0) {
        return res.status(404).json({
          error:
            "ユーザーが見つかりません。",
        });
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Onboarding completion error:",
        error
      );

      return res.status(500).json({
        error:
          "オンボーディング完了状態の保存に失敗しました。",
      });
    }
  }
);

module.exports = router;
