const {
  google,
} = require("googleapis");

const PACKAGE_NAME =
  "com.kisajistudio.notia";

const ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

function getGooglePlayCredentials() {
  const raw =
    process.env
      .GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    const error =
      new Error(
        "Google Play verification is not configured."
      );

    error.code =
      "GOOGLE_PLAY_VERIFICATION_NOT_CONFIGURED";

    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (cause) {
    const error =
      new Error(
        "Google Play service account JSON is invalid."
      );

    error.code =
      "GOOGLE_PLAY_CREDENTIALS_INVALID";

    error.cause =
      cause;

    throw error;
  }
}

function mapSubscriptionState(
  subscriptionState
) {
  switch (subscriptionState) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";

    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "grace_period";

    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "billing_retry";

    case "SUBSCRIPTION_STATE_CANCELED":
      /*
       * 解約済みでも expiryTime までは
       * 利用可能なので、期限判定は後段で行う。
       */
      return "active";

    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";

    case "SUBSCRIPTION_STATE_PAUSED":
      return "inactive";

    case "SUBSCRIPTION_STATE_PENDING":
    case "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
      return "inactive";

    default:
      return "inactive";
  }
}

async function verifyGoogleSubscription({
  productId,
  purchaseToken,
}) {
  if (
    typeof productId !== "string" ||
    !productId
  ) {
    const error =
      new Error(
        "Google Play productId is required."
      );

    error.code =
      "PRODUCT_ID_REQUIRED";

    throw error;
  }

  if (
    typeof purchaseToken !== "string" ||
    !purchaseToken
  ) {
    const error =
      new Error(
        "Google Play purchaseToken is required."
      );

    error.code =
      "PURCHASE_TOKEN_REQUIRED";

    throw error;
  }

  const credentials =
    getGooglePlayCredentials();

  const auth =
    new google.auth.GoogleAuth({
      credentials,
      scopes: [
        ANDROID_PUBLISHER_SCOPE,
      ],
    });

  const androidPublisher =
    google.androidpublisher({
      version: "v3",
      auth,
    });

  let response;

  try {
    response =
      await androidPublisher
        .purchases
        .subscriptionsv2
        .get({
          packageName:
            PACKAGE_NAME,
          token:
            purchaseToken,
        });
  } catch (cause) {
    const error =
      new Error(
        "Google Play subscription verification failed."
      );

    error.code =
      "GOOGLE_PLAY_VERIFICATION_FAILED";

    error.cause =
      cause;

    throw error;
  }

  const data =
    response?.data;

  if (!data) {
    const error =
      new Error(
        "Google Play returned no subscription data."
      );

    error.code =
      "GOOGLE_PLAY_VERIFICATION_FAILED";

    throw error;
  }

  const lineItems =
    Array.isArray(
      data.lineItems
    )
      ? data.lineItems
      : [];

  const matchingLineItem =
    lineItems.find(
      (item) =>
        item?.productId ===
        productId
    );

  if (!matchingLineItem) {
    const error =
      new Error(
        "Google Play product does not match."
      );

    error.code =
      "INVALID_PRODUCT_ID";

    throw error;
  }

  const expiresAt =
    matchingLineItem
      ?.expiryTime ||
    null;

  let status =
    mapSubscriptionState(
      data.subscriptionState
    );

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
          "Google Play returned invalid expiryTime."
        );

      error.code =
        "GOOGLE_PLAY_VERIFICATION_FAILED";

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

  if (
    data.subscriptionState ===
      "SUBSCRIPTION_STATE_PENDING" ||
    data.subscriptionState ===
      "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"
  ) {
    status =
      "inactive";
  }

  const autoRenewStatus =
    matchingLineItem
      ?.autoRenewingPlan
      ?.autoRenewEnabled === true;

  return {
    productId,

    purchaseToken,

    status,

    expiresAt,

    autoRenewStatus,

    subscriptionState:
      data.subscriptionState ||
      null,

    acknowledgementState:
      data.acknowledgementState ||
      null,

    testPurchase:
      Boolean(
        data.testPurchase
      ),
  };
}


async function acknowledgeGoogleSubscription({
  productId,
  purchaseToken,
}) {
  const credentials =
    getGooglePlayCredentials();

  const auth =
    new google.auth.GoogleAuth({
      credentials,
      scopes: [
        ANDROID_PUBLISHER_SCOPE,
      ],
    });

  const androidPublisher =
    google.androidpublisher({
      version: "v3",
      auth,
    });

  try {
    await androidPublisher
      .purchases
      .subscriptions
      .acknowledge({
        packageName:
          PACKAGE_NAME,
        subscriptionId:
          productId,
        token:
          purchaseToken,
        requestBody: {},
      });

    return true;
  } catch (cause) {
    const error =
      new Error(
        "Google Play subscription acknowledgement failed."
      );

    error.code =
      "GOOGLE_PLAY_ACKNOWLEDGEMENT_FAILED";

    error.cause =
      cause;

    throw error;
  }
}

module.exports = {
  PACKAGE_NAME,
  verifyGoogleSubscription,
  acknowledgeGoogleSubscription,
};
