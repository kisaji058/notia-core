const {
  getUserSubscription,
} = require("../../database");

const PLAN_FEATURES = {
  free: {
    googleCalendar: false,
    ads: true,
    documentPageLimit: 3,
  },

  standard: {
    googleCalendar: true,
    ads: false,
    documentPageLimit: 30,
  },

  unlimited: {
    googleCalendar: true,
    ads: false,
    documentPageLimit: null,
  },
};

function isExpired(
  expiresAt
) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs =
    new Date(expiresAt).getTime();

  if (
    Number.isNaN(
      expiresAtMs
    )
  ) {
    return true;
  }

  return expiresAtMs <= Date.now();
}

function getEffectivePlan(
  userId
) {
  const subscription =
    getUserSubscription(userId);

  if (!subscription) {
    return "free";
  }

  const activeStatuses = new Set([
    "active",
    "grace_period",
    "billing_retry",
  ]);

  if (
    !activeStatuses.has(
      subscription.status
    )
  ) {
    return "free";
  }

  if (
    isExpired(
      subscription.expires_at
    )
  ) {
    return "free";
  }

  if (
    subscription.plan !== "standard" &&
    subscription.plan !== "unlimited"
  ) {
    return "free";
  }

  return subscription.plan;
}

function getEntitlements(
  userId
) {
  const plan =
    getEffectivePlan(userId);

  return {
    plan,
    ...PLAN_FEATURES[plan],
  };
}

function canUseGoogleCalendar(
  userId
) {
  return getEntitlements(
    userId
  ).googleCalendar;
}

function getDocumentPageLimit(
  userId
) {
  return getEntitlements(
    userId
  ).documentPageLimit;
}

module.exports = {
  getEffectivePlan,
  getEntitlements,
  canUseGoogleCalendar,
  getDocumentPageLimit,
};
