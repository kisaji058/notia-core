const express =
  require("express");

const {
  upsertNativePushToken,
  deleteNativePushToken,
} = require("../../database");

const router =
  express.Router();

router.post(
  "/native/push/register",
  express.json(),
  (req, res) => {
    try {
      const deviceToken =
        req.body?.deviceToken;

      const environment =
        req.body?.environment;

      if (
        typeof deviceToken !==
          "string" ||
        !deviceToken.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Device tokenが必要です。",
        });
      }

      const apnsEnvironment =
        environment === "production"
          ? "production"
          : "sandbox";

      upsertNativePushToken({
        userId:
          req.userId,
        deviceToken:
          deviceToken.trim(),
        platform:
          "ios",
        apnsEnvironment,
      });

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Push token register error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Push通知端末の登録に失敗しました。",
      });
    }
  }
);

router.post(
  "/native/push/unregister",
  express.json(),
  (req, res) => {
    try {
      const deviceToken =
        req.body?.deviceToken;

      if (
        typeof deviceToken !==
          "string" ||
        !deviceToken.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Device tokenが必要です。",
        });
      }

      deleteNativePushToken(
        req.userId,
        deviceToken.trim()
      );

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Push token unregister error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Push通知端末の解除に失敗しました。",
      });
    }
  }
);

module.exports =
  router;
