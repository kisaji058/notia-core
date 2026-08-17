const {
  getUserByAuthIdentity,
  createUserWithAuthIdentity,
} = require("../../database");

function findOrCreateUser({
  provider,
  providerUserId,
  email,
  displayName = null,
}) {
  if (!provider) {
    throw new Error(
      "AuthService: provider is required"
    );
  }

  if (!providerUserId) {
    throw new Error(
      "AuthService: providerUserId is required"
    );
  }

  let user =
    getUserByAuthIdentity(
      provider,
      providerUserId
    );

  if (user) {
    return user;
  }

  if (!email) {
    throw new Error(
      "AuthService: email is required when creating a user"
    );
  }

  user =
    createUserWithAuthIdentity({
      provider,
      providerUserId,
      email,
      displayName,
    });

  return user;
}

module.exports = {
  findOrCreateUser,
};
