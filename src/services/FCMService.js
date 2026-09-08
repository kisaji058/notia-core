const fs = require("fs");

const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const {
  getMessaging,
} = require("firebase-admin/messaging");

function getFirebaseApp() {
  const existingApps =
    getApps();

  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const serviceAccountPath =
    process.env
      .FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH is not configured"
    );
  }

  const serviceAccount =
    JSON.parse(
      fs.readFileSync(
        serviceAccountPath,
        "utf8"
      )
    );

  return initializeApp({
    credential:
      cert(serviceAccount),
  });
}

async function sendFCMPush({
  deviceToken,
  title,
  body,
  route = "/today",
}) {
  if (
    typeof deviceToken !== "string" ||
    !deviceToken
  ) {
    throw new Error(
      "FCM device token is required"
    );
  }

  const app =
    getFirebaseApp();

  const messaging =
    getMessaging(app);

  const message = {
    token:
      deviceToken,

    notification: {
      title,
      body,
    },

    data: {
      route,
    },

    android: {
      priority:
        "high",

      notification: {
        sound:
          "default",
      },
    },
  };

  const messageId =
    await messaging.send(
      message
    );

  return {
    success: true,
    messageId,
  };
}

module.exports = {
  sendFCMPush,
};
