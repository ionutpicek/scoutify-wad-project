const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "grace_period",
  "paid",
  "approved",
  "succeeded"
]);

const toMillis = value => {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const asDate = value.toDate();
    return asDate instanceof Date ? asDate.getTime() : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const stringifyStatus = value => {
  if (value == null) return "inactive";
  const normalized = String(value).trim().toLowerCase();
  return normalized || "inactive";
};

export const getSubscriptionStatus = userData => {
  if (!userData || typeof userData !== "object") return "inactive";

  const candidates = [
    userData.subscriptionStatus,
    userData.subscription?.status,
    userData.billing?.status,
    userData.billing?.subscriptionStatus,
    userData.orgSubscription?.status,
    userData.organization?.subscriptionStatus
  ];

  const firstDefined = candidates.find(value => value != null);
  return stringifyStatus(firstDefined);
};

export const hasActiveSubscription = userData => {
  if (!userData || typeof userData !== "object") return false;

  const untilCandidates = [
    userData.subscriptionUntil,
    userData.subscription?.until,
    userData.billing?.until,
    userData.subscriptionExpiresAt
  ];
  const untilRaw = untilCandidates.find(value => value != null);
  const untilMillis = toMillis(untilRaw);
  if (untilMillis != null) {
    return untilMillis > Date.now();
  }

  if (userData.subscriptionActive === true) return true;
  if (userData.subscription?.active === true) return true;
  if (userData.billing?.active === true) return true;

  const status = getSubscriptionStatus(userData);
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
};
