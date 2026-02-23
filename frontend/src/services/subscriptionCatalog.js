export const CLUB_CONTACT_EMAIL =
  (import.meta.env?.VITE_CLUB_CONTACT_EMAIL || "").trim() || "gp.scoutify@gmail.com";

export const buildClubContactMailto = ({ teamName, username, source } = {}) => {
  const subject = `Club subscription request${teamName ? ` - ${teamName}` : ""}`;
  const lines = [
    "Hello,",
    "",
    "We would like to activate a Club subscription.",
    teamName ? `Club/team: ${teamName}` : null,
    username ? `Contact person: ${username}` : null,
    source ? `Source: ${source}` : null,
    "",
    "Please share the payment link/details.",
    "",
    "Thank you."
  ].filter(Boolean);

  const params = new URLSearchParams({
    subject,
    body: lines.join("\n")
  });

  return `mailto:${CLUB_CONTACT_EMAIL}?${params.toString()}`;
};

export const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    title: "Free",
    price: "",
    period: "7 days trial",
    badge: "Try it",
    isPaid: false,
    features: [
      "Full leaderboards (total + per90)",
      "Player compare",
      "Match analysis + lineups",
      "Season grades"
    ]
  },
  {
    id: "player",
    title: "Player",
    price: "EUR 2.99",
    period: "/mo",
    badge: "Most popular",
    isPaid: true,
    highlight: true,
    features: [
      "Full leaderboards (total + per90)",
      "Own stats/insights",
      "Match analysis + lineups",
      "Season grades"
    ]
  },
  {
    id: "manager",
    title: "Manager",
    price: "EUR 39.99",
    period: "/mo",
    badge: "For managers",
    isPaid: true,
    highlight: true,
    features: [
      "Full leaderboards (total + per90)",
      "Player compare",
      "Match analysis + lineups",
      "Own team stats/insights",
      "Team report",
      "Season grades"
    ]
  },
  {
    id: "club",
    title: "Club",
    price: "EUR 59.99",
    period: "/mo",
    badge: "For teams",
    isPaid: true,
    features: [
      "Multi-user access",
      "Priority support",
      "All features of Manager plan",
      "Please contact us for more details"
    ]
  }
];

export const getSubscriptionPlan = planId =>
  SUBSCRIPTION_PLANS.find(plan => plan.id === planId) || SUBSCRIPTION_PLANS[2];

const normalizeRole = role => String(role || "").trim().toLowerCase();

export const getPayablePlanIdForRole = role =>
  normalizeRole(role) === "player" ? "player" : "manager";

export const getAllowedPlanIdsForRole = role => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "player") {
    return ["free", "player"];
  }
  return ["manager"];
};

export const isPlanAllowedForRole = (planId, role) =>
  getAllowedPlanIdsForRole(role).includes(String(planId || "").trim().toLowerCase());
