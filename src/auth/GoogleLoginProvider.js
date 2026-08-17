const { google } = require("googleapis");

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_LOGIN_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oauth2Client =
    createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "select_account",
    state,
  });
}

async function authenticate(code) {
  if (!code) {
    throw new Error(
      "Google認証コードが指定されていません。"
    );
  }

  const oauth2Client =
    createOAuth2Client();

  const { tokens } =
    await oauth2Client.getToken(code);

  if (!tokens.id_token) {
    throw new Error(
      "Google ID tokenを取得できませんでした。"
    );
  }

  const ticket =
    await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience:
        process.env.GOOGLE_CLIENT_ID,
    });

  const payload =
    ticket.getPayload();

  if (
    !payload ||
    !payload.sub ||
    !payload.email
  ) {
    throw new Error(
      "Googleアカウント情報を取得できませんでした。"
    );
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    displayName:
      payload.name || null,
  };
}

module.exports = {
  getAuthUrl,
  authenticate,
};