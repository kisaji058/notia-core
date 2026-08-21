const express = require("express");

const {
  getNotificationSettings,
  updateNotificationSettings,
} = require("../../database");

const router = express.Router();

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

router.get(
  "/notification-settings",
  (req, res) => {
    try {
      return res.json(
        getNotificationSettings(
          req.userId
        )
      );
    } catch (error) {
      console.error(
        "通知設定取得エラー:",
        error
      );

      return res.status(500).json({
        error:
          "通知設定の取得に失敗しました。",
      });
    }
  }
);

router.put(
  "/notification-settings",
  (req, res) => {
    try {
      const {
        morningEnabled,
        morningTime,
        eveningEnabled,
        eveningTime,
      } = req.body;

      if (
        typeof morningEnabled !==
          "boolean" ||
        typeof eveningEnabled !==
          "boolean"
      ) {
        return res.status(400).json({
          error:
            "通知設定が正しくありません。",
        });
      }

      if (
        !TIME_PATTERN.test(
          morningTime
        ) ||
        !TIME_PATTERN.test(
          eveningTime
        )
      ) {
        return res.status(400).json({
          error:
            "通知時刻が正しくありません。",
        });
      }

      updateNotificationSettings(
        req.userId,
        {
          morningEnabled,
          morningTime,
          eveningEnabled,
          eveningTime,
        }
      );

      return res.json({
        success: true,
        settings:
          getNotificationSettings(
            req.userId
          ),
      });
    } catch (error) {
      console.error(
        "通知設定更新エラー:",
        error
      );

      return res.status(500).json({
        error:
          "通知設定の更新に失敗しました。",
      });
    }
  }
);

module.exports = router;
