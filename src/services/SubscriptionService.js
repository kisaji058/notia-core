const {
  upsertUserSubscription,
  getUserSubscription,
  getSubscriptionByOriginalTransactionId,
} = require("../../database");

const PRODUCT_PLANS = {
  "com.kisajistudio.notia.standard.monthly":
    "standard",

  "com.kisajistudio.notia.unlimited.monthly":
    "unlimited",
};

function getPlanFromProductId(
  productId
) {
  return (
    PRODUCT_PLANS[productId] ||
    null
  );
}

function syncLocalSubscription({
  userId,
  productId,
  originalTransactionId = null,
  expirationDate = null,
}) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    const error = new Error(
      "Local subscription sync is disabled in production."
    );

    error.code =
      "LOCAL_SUBSCRIPTION_SYNC_DISABLED";

    throw error;
  }

  const plan =
    getPlanFromProductId(
      productId
    );

  if (!plan) {
    const error = new Error(
      "Unknown subscription product."
    );

    error.code =
      "INVALID_PRODUCT_ID";

    throw error;
  }

  let expiresAt =
    expirationDate || null;

  let status = "active";

  if (expiresAt) {
    const expiresAtMs =
      new Date(
        expiresAt
      ).getTime();

    if (
      Number.isNaN(
        expiresAtMs
      )
    ) {
      const error =
        new Error(
          "Invalid expiration date."
        );

      error.code =
        "INVALID_EXPIRATION_DATE";

      throw error;
    }

    if (
      expiresAtMs <=
      Date.now()
    ) {
      status =
        "expired";
    }
  }

  upsertUserSubscription({
    userId,
    platform:
      "apple",
    plan,
    productId,
    originalTransactionId,
    status,
    expiresAt,
    autoRenewStatus:
      status === "active"
        ? 1
        : 0,

    // ローカルStoreKitなので
    // Appleサーバー検証済みとは扱わない
    lastVerifiedAt:
      null,
  });

  return getUserSubscription(
    userId
  );
}

async function syncVerifiedAppleSubscription({
  userId,
  transaction,
}) {
  const productId =
    transaction.productId;

  const plan =
    getPlanFromProductId(
      productId
    );

  if (!plan) {
    const error =
      new Error(
        "Unknown subscription product."
      );

    error.code =
      "INVALID_PRODUCT_ID";

    throw error;
  }

  const originalTransactionId =
    transaction.originalTransactionId
      ? String(
          transaction.originalTransactionId
        )
      : null;

  const expiresAt =
    transaction.expiresDate
      ? new Date(
          transaction.expiresDate
        ).toISOString()
      : null;

  if (originalTransactionId) {
    const existing =
      getSubscriptionByOriginalTransactionId(
        originalTransactionId
      );

    if (
      existing &&
      Number(existing.user_id) !==
        Number(userId)
    ) {
      const error =
        new Error(
          "This App Store subscription is already linked to another Notia account."
        );

      error.code =
        "SUBSCRIPTION_ALREADY_LINKED";

      throw error;
    }
  }

  let status =
    "active";

  if (
    expiresAt &&
    new Date(
      expiresAt
    ).getTime() <=
      Date.now()
  ) {
    status =
      "expired";
  }

  upsertUserSubscription({
    userId,
    platform:
      "apple",
    plan,
    productId,
    originalTransactionId,
    status,
    expiresAt,
    autoRenewStatus:
      status === "active"
        ? 1
        : 0,
    lastVerifiedAt:
      new Date().toISOString(),
  });

  return getUserSubscription(
    userId
  );
}

module.exports = {
  getPlanFromProductId,
  syncLocalSubscription,
  syncVerifiedAppleSubscription,
};
