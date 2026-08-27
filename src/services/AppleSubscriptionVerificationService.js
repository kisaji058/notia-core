const fs = require("fs");
const path = require("path");

const {
  Environment,
  SignedDataVerifier,
} = require(
  "@apple/app-store-server-library"
);

const BUNDLE_ID =
  "com.kisajistudio.notia";

const ROOT_CERT_PATH =
  path.join(
    __dirname,
    "../../certs/apple/AppleRootCA-G3.cer"
  );

function getAppleEnvironment() {
  const value =
    String(
      process.env.APPLE_STORE_ENV ||
      ""
    )
      .trim()
      .toUpperCase();

  if (value === "PRODUCTION") {
    return Environment.PRODUCTION;
  }

  if (value === "SANDBOX") {
    return Environment.SANDBOX;
  }

  const error =
    new Error(
      "APPLE_STORE_ENV must be SANDBOX or PRODUCTION."
    );

  error.code =
    "INVALID_APPLE_STORE_ENV";

  throw error;
}

function getAppAppleId() {
  const value =
    process.env.APPLE_APP_ID;

  if (
    process.env.NODE_ENV === "production" &&
    !value
  ) {
    const error =
      new Error(
        "APPLE_APP_ID is required in production."
      );

    error.code =
      "APPLE_APP_ID_REQUIRED";

    throw error;
  }

  if (!value) {
    return undefined;
  }

  const parsed =
    Number(value);

  if (!Number.isSafeInteger(parsed)) {
    const error =
      new Error(
        "APPLE_APP_ID must be an integer."
      );

    error.code =
      "INVALID_APPLE_APP_ID";

    throw error;
  }

  return parsed;
}

function createVerifier() {
  const rootCertificate =
    fs.readFileSync(
      ROOT_CERT_PATH
    );

  return new SignedDataVerifier(
    [rootCertificate],
    true,
    getAppleEnvironment(),
    BUNDLE_ID,
    getAppAppleId()
  );
}

async function verifySignedTransaction(
  signedTransaction
) {
  if (
    typeof signedTransaction !== "string" ||
    !signedTransaction
  ) {
    const error =
      new Error(
        "signedTransaction is required."
      );

    error.code =
      "SIGNED_TRANSACTION_REQUIRED";

    throw error;
  }

  const verifier =
    createVerifier();

  return verifier.verifyAndDecodeTransaction(
    signedTransaction
  );
}

module.exports = {
  verifySignedTransaction,
};
