const express =
  require("express");

const {
  getEntitlements,
} = require(
  "../services/EntitlementService"
);

const {
  syncLocalSubscription,
  syncVerifiedAppleSubscription,
  syncVerifiedGoogleSubscription,
} = require(
  "../services/SubscriptionService"
);

const {
  verifySignedTransaction,
} = require(
  "../services/AppleSubscriptionVerificationService"
);

const {
  verifyGoogleSubscription,
  acknowledgeGoogleSubscription,
} = require(
  "../services/GooglePlaySubscriptionVerificationService"
);

const router =
  express.Router();

router.get(
  "/subscription/status",
  (req, res) => {
    try {
      const entitlements =
        getEntitlements(
          req.userId
        );

      return res.json({
        success: true,
        subscription:
          entitlements,
      });

    } catch (error) {
      console.error(
        "Subscription status error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "課金状態の取得に失敗しました。",
        });
    }
  }
);

router.post(
  "/subscription/sync",
  async (req, res) => {
    try {
      const {
        signedTransaction,
      } = req.body || {};

      if (
        typeof signedTransaction !==
          "string" ||
        !signedTransaction
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "SIGNED_TRANSACTION_REQUIRED",
            error:
              "signedTransactionが必要です。",
          });
      }

      const transaction =
        await verifySignedTransaction(
          signedTransaction
        );

      const subscription =
        await syncVerifiedAppleSubscription({
          userId:
            req.userId,
          transaction,
        });

      const entitlements =
        getEntitlements(
          req.userId
        );

      return res.json({
        success: true,
        subscription,
        entitlements,
      });

    } catch (error) {
      console.error(
        "Subscription sync error:",
        error
      );

      if (
        error.code ===
          "SUBSCRIPTION_ALREADY_LINKED"
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              error.code,
            error:
              "このApp Storeの購入は、別のNotiaアカウントに紐づいています。",
          });
      }

      if (
        error.code ===
          "SIGNED_TRANSACTION_REQUIRED" ||
        error.code ===
          "INVALID_PRODUCT_ID"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              error.code,
            error:
              error.message,
          });
      }

      return res
        .status(400)
        .json({
          success: false,
          code:
            "APPLE_TRANSACTION_VERIFICATION_FAILED",
          error:
            "Appleの購入情報を確認できませんでした。",
        });
    }
  }
);


router.post(
  "/subscription/google-sync",
  async (req, res) => {
    try {
      const {
        productId,
        purchaseToken,
      } = req.body || {};

      if (
        typeof productId !==
          "string" ||
        !productId
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "PRODUCT_ID_REQUIRED",
            error:
              "productIdが必要です。",
          });
      }

      if (
        typeof purchaseToken !==
          "string" ||
        !purchaseToken
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "PURCHASE_TOKEN_REQUIRED",
            error:
              "purchaseTokenが必要です。",
          });
      }

      const purchase =
        await verifyGoogleSubscription({
          productId,
          purchaseToken,
        });

      const shouldAcknowledge =
        purchase
          ?.acknowledgementState ===
          "ACKNOWLEDGEMENT_STATE_PENDING" &&
        purchase?.status !==
          "inactive" &&
        purchase?.status !==
          "expired" &&
        purchase?.status !==
          "revoked";

      if (shouldAcknowledge) {
        await acknowledgeGoogleSubscription({
          productId:
            purchase.productId,
          purchaseToken:
            purchase.purchaseToken,
        });
      }

      const subscription =
        await syncVerifiedGoogleSubscription({
          userId:
            req.userId,
          purchase,
        });

      const entitlements =
        getEntitlements(
          req.userId
        );

      return res.json({
        success: true,
        subscription,
        entitlements,
      });

    } catch (error) {
      console.error(
        "Google subscription sync error:",
        error
      );

      if (
        error.code ===
          "GOOGLE_PLAY_VERIFICATION_NOT_CONFIGURED" ||
        error.code ===
          "GOOGLE_PLAY_VERIFICATION_NOT_IMPLEMENTED"
      ) {
        return res
          .status(503)
          .json({
            success: false,
            code:
              error.code,
            error:
              "Google Playの購入検証は現在準備中です。",
          });
      }

      if (
        error.code ===
          "PRODUCT_ID_REQUIRED" ||
        error.code ===
          "PURCHASE_TOKEN_REQUIRED" ||
        error.code ===
          "INVALID_PRODUCT_ID"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              error.code,
            error:
              error.message,
          });
      }

      if (
        error.code ===
          "SUBSCRIPTION_ALREADY_LINKED"
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              error.code,
            error:
              "このGoogle Playの購入は、別のNotiaアカウントに紐づいています。",
          });
      }

      if (
        error.code ===
          "GOOGLE_PLAY_ACKNOWLEDGEMENT_FAILED"
      ) {
        return res
          .status(502)
          .json({
            success: false,
            code:
              error.code,
            error:
              "Google Playで購入の確定処理に失敗しました。",
          });
      }

      if (
        error.code ===
          "GOOGLE_PLAY_VERIFICATION_FAILED"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              error.code,
            error:
              "Google Playの購入情報を確認できませんでした。",
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          code:
            "GOOGLE_SUBSCRIPTION_SYNC_FAILED",
          error:
            "Google Playの購入情報を確認できませんでした。",
        });
    }
  }
);

router.post(
  "/subscription/dev-sync",
  (req, res) => {
    try {
      const {
        productId,
        originalTransactionId,
        expirationDate,
      } = req.body || {};

      if (
        typeof productId !==
          "string" ||
        !productId
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "PRODUCT_ID_REQUIRED",
            error:
              "productIdが必要です。",
          });
      }

      const subscription =
        syncLocalSubscription({
          userId:
            req.userId,
          productId,
          originalTransactionId:
            originalTransactionId ||
            null,
          expirationDate:
            expirationDate ||
            null,
        });

      const entitlements =
        getEntitlements(
          req.userId
        );

      return res.json({
        success: true,
        subscription,
        entitlements,
      });

    } catch (error) {
      console.error(
        "Subscription dev sync error:",
        error
      );

      if (
        error.code ===
        "LOCAL_SUBSCRIPTION_SYNC_DISABLED"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              error.code,
            error:
              "本番環境では開発用課金同期を利用できません。",
          });
      }

      if (
        error.code ===
          "INVALID_PRODUCT_ID" ||
        error.code ===
          "INVALID_EXPIRATION_DATE"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              error.code,
            error:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          error:
            "課金状態の同期に失敗しました。",
        });
    }
  }
);

module.exports =
  router;
