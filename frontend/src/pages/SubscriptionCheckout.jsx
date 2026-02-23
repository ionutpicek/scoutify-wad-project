import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NTPLogo from "ntp-logo-react";
import { getCurrentUser } from "../services/sessionStorage.js";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPlan,
  CLUB_CONTACT_EMAIL,
  buildClubContactMailto,
  getPayablePlanIdForRole,
  isPlanAllowedForRole
} from "../services/subscriptionCatalog.js";

const ORANGE = "#FF681F";
const BG = "#F7F8FA";
const TEXT = "#101828";
const MUTED = "#667085";

const NETOPIA_URL = import.meta.env?.VITE_NETOPIA_CHECKOUT_URL || "";
const EUPLATESC_URL = import.meta.env?.VITE_EUPLATESC_CHECKOUT_URL || "";
const NETOPIA_PLAYER_URL = import.meta.env?.VITE_NETOPIA_PLAYER_URL || "";
const NETOPIA_MANAGER_URL = import.meta.env?.VITE_NETOPIA_MANAGER_URL || "";
const EUPLATESC_PLAYER_URL = import.meta.env?.VITE_EUPLATESC_PLAYER_URL || "";
const EUPLATESC_MANAGER_URL = import.meta.env?.VITE_EUPLATESC_MANAGER_URL || "";

const PAYMENT_LINKS = {
  netopia: {
    player: NETOPIA_PLAYER_URL,
    manager: NETOPIA_MANAGER_URL,
    default: NETOPIA_URL
  },
  euplatesc: {
    player: EUPLATESC_PLAYER_URL,
    manager: EUPLATESC_MANAGER_URL,
    default: EUPLATESC_URL
  }
};

const PAYMENT_LINK_ENV_KEYS = {
  netopia: {
    player: "VITE_NETOPIA_PLAYER_URL",
    manager: "VITE_NETOPIA_MANAGER_URL",
    default: "VITE_NETOPIA_CHECKOUT_URL"
  },
  euplatesc: {
    player: "VITE_EUPLATESC_PLAYER_URL",
    manager: "VITE_EUPLATESC_MANAGER_URL",
    default: "VITE_EUPLATESC_CHECKOUT_URL"
  }
};

export default function SubscriptionCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = getCurrentUser();
  const [error, setError] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const routeState = location.state || {};
  const role = routeState.role || storedUser?.role || "manager";
  const username = routeState.username || storedUser?.username || "Scout";
  const userTeam = routeState.userTeam || storedUser?.teamName || "Your team";
  const suggestedPlanId = getPayablePlanIdForRole(role);

  const searchParams = new URLSearchParams(location.search);
  const requestedPlanId = searchParams.get("plan") || suggestedPlanId;
  const selectedPlan = useMemo(() => {
    const requestedPlan = getSubscriptionPlan(requestedPlanId);
    if (isPlanAllowedForRole(requestedPlan.id, role)) {
      return requestedPlan;
    }
    return getSubscriptionPlan(suggestedPlanId);
  }, [requestedPlanId, role, suggestedPlanId]);

  const switchPlan = planId => {
    if (!isPlanAllowedForRole(planId, role)) {
      setError(`Your account can only purchase the ${suggestedPlanId === "player" ? "Player" : "Manager"} plan.`);
      return;
    }
    setError("");
    navigate(`/subscription-checkout?plan=${encodeURIComponent(planId)}`, {
      replace: true,
      state: routeState
    });
  };

  const getPaymentLink = provider => {
    const byProvider = PAYMENT_LINKS[provider] || {};
    const preferred = byProvider[selectedPlan.id];
    if (preferred) {
      return { url: preferred, envKey: PAYMENT_LINK_ENV_KEYS[provider]?.[selectedPlan.id] || null };
    }

    if (byProvider.default) {
      return { url: byProvider.default, envKey: PAYMENT_LINK_ENV_KEYS[provider]?.default || null };
    }

    return { url: "", envKey: PAYMENT_LINK_ENV_KEYS[provider]?.[selectedPlan.id] || PAYMENT_LINK_ENV_KEYS[provider]?.default || null };
  };

  const startPayment = provider => {
    setError("");
    if (!isPlanAllowedForRole(selectedPlan.id, role)) {
      setError(`Your account can only purchase the ${suggestedPlanId === "player" ? "Player" : "Manager"} plan.`);
      return;
    }
    if (!selectedPlan.isPaid || selectedPlan.id === "free") {
      setError("Free plan has no payment step. Pick Player or Manager to continue.");
      return;
    }
    if (!acceptedPolicies) {
      setError("Accept Terms & Conditions and Privacy Policy before continuing.");
      return;
    }
    if (selectedPlan.id === "club") {
      handleClubContact();
      return;
    }

    const { url: baseUrl, envKey } = getPaymentLink(provider);
    if (!baseUrl) {
      const providerName = provider === "netopia" ? "Netopia" : "EuPlatesc";
      setError(`${providerName} payment link is missing. Set ${envKey || "the corresponding VITE_* URL"} in frontend env.`);
      return;
    }

    const target = new URL(baseUrl, window.location.origin);
    target.searchParams.set("plan", selectedPlan.id);
    if (storedUser?.email) target.searchParams.set("email", storedUser.email);
    if (userTeam) target.searchParams.set("team", userTeam);
    if (username) target.searchParams.set("user", username);
    window.location.assign(target.toString());
  };

  const handleClubContact = () => {
    if (!acceptedPolicies) {
      setError("Accept Terms & Conditions and Privacy Policy before continuing.");
      return;
    }
    window.location.href = buildClubContactMailto({
      teamName: userTeam,
      username,
      source: "subscription-checkout"
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          background: "white",
          borderRadius: 20,
          border: "1px solid rgba(16, 24, 40, 0.08)",
          boxShadow: "0 18px 42px rgba(16, 24, 40, 0.1)",
          padding: "28px 22px",
          display: "grid",
          gap: 18
        }}
      >
        <div style={checkoutHeaderRow}>
          <div style={checkoutHeaderText}>
            <h1 style={{ margin: 0, color: TEXT, fontSize: 30, fontWeight: 900 }}>
              Payment step
            </h1>
            <p style={{ margin: 0, color: MUTED, lineHeight: 1.6 }}>
              Select a subscription and continue with your preferred payment provider.
            </p>
            <p style={{ margin: 0, color: "#475467", fontSize: 13 }}>
              Your account role can purchase only the{" "}
              <strong>{suggestedPlanId === "player" ? "Player" : "Manager"}</strong> subscription.
            </p>
          </div>
          <div style={checkoutLogoWrap}>
            <NTPLogo version="vertical" secret="160839" />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10
          }}
        >
          {SUBSCRIPTION_PLANS.map(plan => {
            const disabled = !isPlanAllowedForRole(plan.id, role);
            const selected = selectedPlan.id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={disabled ? undefined : () => switchPlan(plan.id)}
                disabled={disabled}
                style={{
                  textAlign: "left",
                  borderRadius: 14,
                  border: selected
                    ? "2px solid rgba(255,104,31,0.55)"
                    : "1px solid rgba(16, 24, 40, 0.1)",
                  background: selected ? "#FFF8F3" : "white",
                  padding: "12px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "grid",
                  gap: 6,
                  ...(disabled
                    ? {
                        opacity: 0.5,
                        filter: "grayscale(0.3)",
                        background: "#F8FAFC"
                      }
                    : {})
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 16 }}>{plan.title}</strong>
                  <span style={{ fontSize: 11, color: "#475467", fontWeight: 700 }}>
                    {disabled
                      ? plan.id === "player" || plan.id === "free"
                        ? "Player only"
                        : plan.id === "manager"
                        ? "Manager only"
                        : "Locked"
                      : plan.badge}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: ORANGE }}>{plan.price}</span>
                  {plan.period ? <span style={{ color: MUTED }}>{plan.period}</span> : null}
                </div>
                <span style={{ color: MUTED, fontSize: 12 }}>
                  {plan.features[0]}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            border: "1px solid rgba(16, 24, 40, 0.1)",
            borderRadius: 14,
            padding: "14px",
            background: "#FCFCFD",
            display: "grid",
            gap: 10
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 18 }}>Selected plan: {selectedPlan.title}</strong>
              <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 14 }}>
                {selectedPlan.id === "club"
                  ? "Club subscriptions are activated manually after email confirmation."
                  : selectedPlan.isPaid
                  ? "Proceed to payment to unlock dashboard access."
                  : "Free plan remains limited and does not unlock dashboard access."}
              </p>
            </div>
            <span
              style={{
                alignSelf: "flex-start",
                fontWeight: 900,
                color: ORANGE,
                background: "rgba(255,104,31,0.12)",
                borderRadius: 999,
                padding: "6px 10px"
              }}
            >
              {selectedPlan.price} {selectedPlan.period}
            </span>
          </div>

          <div style={policyConsentWrap}>
            <label style={policyConsentLabel}>
              <input
                type="checkbox"
                checked={acceptedPolicies}
                onChange={event => {
                  setAcceptedPolicies(event.target.checked);
                  if (event.target.checked) setError("");
                }}
                style={{ marginTop: 2 }}
              />
              <span>
                I agree to the{" "}
                <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={policyLink}>
                  Terms & Conditions
                </Link>{" "}
                and{" "}
                <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" style={policyLink}>
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {selectedPlan.id === "club" ? (
              <>
                <button
                  type="button"
                  style={{
                    ...primaryBtn,
                    ...(!acceptedPolicies
                      ? { opacity: 0.6, cursor: "not-allowed" }
                      : {}),
                  }}
                  onClick={handleClubContact}
                  disabled={!acceptedPolicies}
                >
                  Email for club payment
                </button>
                <a href={`mailto:${CLUB_CONTACT_EMAIL}`} style={{ ...emailBadge, alignSelf: "center" }}>
                  {CLUB_CONTACT_EMAIL}
                </a>
              </>
            ) : selectedPlan.id === "free" ? (
              <div style={infoBadge}>
                Free trial has no payment link.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  style={{
                    ...primaryBtn,
                    ...(!acceptedPolicies
                      ? { opacity: 0.6, cursor: "not-allowed" }
                      : {}),
                  }}
                  onClick={() => startPayment("netopia")}
                  disabled={!acceptedPolicies}
                >
                  Pay with Netopia
                </button>
              </>
            )}
            <button
              type="button"
              style={ghostBtn}
              onClick={() =>
                navigate("/subscription-required", {
                  replace: true,
                  state: routeState
                })
              }
            >
              Back
            </button>
          </div>

          {error ? (
            <div
              style={{
                color: "#B42318",
                background: "#FEF3F2",
                border: "1px solid rgba(217, 45, 32, 0.2)",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const primaryBtn = {
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  background: ORANGE,
  color: "white",
  fontWeight: 800,
  cursor: "pointer"
};

const ghostBtn = {
  border: "1px solid rgba(16, 24, 40, 0.08)",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#F9FAFB",
  color: "#475467",
  fontWeight: 700,
  cursor: "pointer"
};

const emailBadge = {
  color: "#C2410C",
  background: "#FFF7ED",
  border: "1px solid rgba(255,104,31,0.35)",
  borderRadius: 999,
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none"
};

const infoBadge = {
  color: "#334155",
  background: "#F8FAFC",
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 999,
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none"
};

const policyConsentWrap = {
  border: "1px solid rgba(16, 24, 40, 0.08)",
  borderRadius: 10,
  background: "#fff",
  padding: "10px 12px",
};

const policyConsentLabel = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  color: "#344054",
  fontSize: 13,
  lineHeight: 1.5,
};

const policyLink = {
  color: ORANGE,
  fontWeight: 700,
  textDecoration: "none",
};

const checkoutHeaderRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap"
};

const checkoutHeaderText = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: "1 1 320px"
};

const checkoutLogoWrap = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(16, 24, 40, 0.08)",
  background: "#fff",
  borderRadius: 10,
  padding: "6px 10px",
  maxWidth: 220
};
