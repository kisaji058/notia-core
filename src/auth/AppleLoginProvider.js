const crypto = require("crypto");

const APPLE_ISSUER =
  "https://appleid.apple.com";

const APPLE_JWKS_URL =
  new URL(
    "https://appleid.apple.com/auth/keys"
  );

const APPLE_CLIENT_ID =
  "com.kisajistudio.notia";

let josePromise = null;
let appleJwks = null;

async function getJose() {
  if (!josePromise) {
    josePromise =
      import("jose");
  }

  return josePromise;
}

function hashNonce(nonce) {
  return crypto
    .createHash("sha256")
    .update(nonce)
    .digest("hex");
}

async function authenticate(
  identityToken,
  nonce
) {
  if (
    typeof identityToken !==
      "string" ||
    !identityToken
  ) {
    throw new Error(
      "Apple identity token is required"
    );
  }

  if (
    typeof nonce !== "string" ||
    !nonce
  ) {
    throw new Error(
      "Apple nonce is required"
    );
  }

  const {
    createRemoteJWKSet,
    jwtVerify,
  } = await getJose();

  if (!appleJwks) {
    appleJwks =
      createRemoteJWKSet(
        APPLE_JWKS_URL
      );
  }

  const {
    payload,
  } = await jwtVerify(
    identityToken,
    appleJwks,
    {
      issuer:
        APPLE_ISSUER,
      audience:
        APPLE_CLIENT_ID,
      algorithms: [
        "RS256",
      ],
    }
  );

  if (
    typeof payload.sub !==
      "string" ||
    !payload.sub
  ) {
    throw new Error(
      "Apple user identifier is missing"
    );
  }

  const expectedNonce =
    hashNonce(nonce);

  if (
    typeof payload.nonce !==
      "string" ||
    payload.nonce !==
      expectedNonce
  ) {
    throw new Error(
      "Apple nonce verification failed"
    );
  }

  const email =
    typeof payload.email ===
      "string" &&
    payload.email
      ? payload.email
      : null;

  return {
    appleSub:
      payload.sub,
    email,
  };
}

module.exports = {
  authenticate,
};
