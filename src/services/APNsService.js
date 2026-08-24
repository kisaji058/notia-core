const fs = require("fs");
const http2 = require("http2");

let josePromise = null;
const jwtCache = new Map();

const JWT_MAX_AGE_MS =
  50 * 60 * 1000;

async function getJose() {
  if (!josePromise) {
    josePromise =
      import("jose");
  }

  return josePromise;
}

function getConfig(
  requestedEnvironment
) {
  const environment =
    requestedEnvironment ===
      "production"
      ? "production"
      : "sandbox";

  const isProduction =
    environment === "production";

  const keyId =
    isProduction
      ? process.env
          .APNS_PRODUCTION_KEY_ID
      : process.env.APNS_KEY_ID;

  const keyPath =
    isProduction
      ? process.env
          .APNS_PRODUCTION_KEY_PATH
      : process.env.APNS_KEY_PATH;

  const teamId =
    process.env.APNS_TEAM_ID;

  const bundleId =
    process.env.APNS_BUNDLE_ID;

  if (
    !keyId ||
    !teamId ||
    !bundleId ||
    !keyPath
  ) {
    throw new Error(
      "APNs configuration is incomplete"
    );
  }

  return {
    keyId,
    teamId,
    bundleId,
    keyPath,
    environment,
  };
}

async function createProviderToken(
  environment
) {
  const {
    SignJWT,
    importPKCS8,
  } = await getJose();

  const {
    keyId,
    teamId,
    keyPath,
  } = getConfig(environment);

  const cacheKey =
    `${environment}:${keyId}`;

  const cached =
    jwtCache.get(cacheKey);

  if (
    cached &&
    Date.now() -
      cached.createdAt <
      JWT_MAX_AGE_MS
  ) {
    return cached.token;
  }

  const privateKeyPem =
    fs.readFileSync(
      keyPath,
      "utf8"
    );

  const privateKey =
    await importPKCS8(
      privateKeyPem,
      "ES256"
    );

  const now =
    Math.floor(
      Date.now() / 1000
    );

  const token =
    await new SignJWT({})
      .setProtectedHeader({
        alg: "ES256",
        kid: keyId,
      })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .sign(privateKey);

  jwtCache.set(
    cacheKey,
    {
      token,
      createdAt:
        Date.now(),
    }
  );

  return token;
}

async function sendPush({
  deviceToken,
  title,
  body,
  badge = null,
  sound = "default",
  route = "/today",
  environment = "sandbox",
}) {
  if (
    typeof deviceToken !==
      "string" ||
    !deviceToken
  ) {
    throw new Error(
      "APNs device token is required"
    );
  }

  const {
    bundleId,
    environment:
      resolvedEnvironment,
  } = getConfig(environment);

  const providerToken =
    await createProviderToken(
      resolvedEnvironment
    );

  const origin =
    resolvedEnvironment ===
      "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

  const payload = {
    aps: {
      alert: {
        title,
        body,
      },
      sound,
    },
    route,
  };

  if (
    Number.isInteger(badge)
  ) {
    payload.aps.badge =
      badge;
  }

  return new Promise(
    (resolve, reject) => {
      const client =
        http2.connect(origin);

      client.on(
        "error",
        reject
      );

      const request =
        client.request({
          ":method": "POST",
          ":path":
            `/3/device/${deviceToken}`,
          authorization:
            `bearer ${providerToken}`,
          "apns-topic":
            bundleId,
          "apns-push-type":
            "alert",
          "apns-priority":
            "10",
          "content-type":
            "application/json",
        });

      let status = null;
      let responseBody = "";

      request.on(
        "response",
        (headers) => {
          status =
            headers[":status"];
        }
      );

      request.setEncoding(
        "utf8"
      );

      request.on(
        "data",
        (chunk) => {
          responseBody +=
            chunk;
        }
      );

      request.on(
        "end",
        () => {
          client.close();

          if (
            status === 200
          ) {
            return resolve({
              success: true,
            });
          }

          let reason = null;

          try {
            reason =
              JSON.parse(
                responseBody
              )?.reason ||
              null;
          } catch {
            reason =
              responseBody ||
              null;
          }

          reject(
            new Error(
              `APNs request failed (${status}): ${reason || "unknown"}`
            )
          );
        }
      );

      request.on(
        "error",
        (error) => {
          client.close();
          reject(error);
        }
      );

      request.end(
        JSON.stringify(
          payload
        )
      );
    }
  );
}

module.exports = {
  sendPush,
};
