import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { clearCurrentUser, getCurrentUser } from "../services/sessionStorage.js";
import {
  SUBSCRIPTION_PLANS,
  CLUB_CONTACT_EMAIL,
  buildClubContactMailto,
  getPayablePlanIdForRole,
  isPlanAllowedForRole
} from "../services/subscriptionCatalog.js";

const ORANGE = "#FF681F";
const BG = "#F7F8FA";
const TEXT = "#101828";
const MUTED = "#667085";

export default function SubscriptionRequired() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = getCurrentUser();
  const routeState = location.state || {};
  const [trialUsed, setTrialUsed] = useState(false);
  const [trialLoading, setTrialLoading] = useState(true);

  const username = routeState.username || storedUser?.username || "Scout";
  const role = routeState.role || storedUser?.role || "manager";
  const userTeam = routeState.userTeam || storedUser?.teamName || "Your team";
  const subscriptionStatus = routeState.subscriptionStatus || "inactive";

  const statusLabel = useMemo(() => {
    return String(subscriptionStatus)
      .replace(/_/g, " ")
      .trim()
      .toUpperCase();
  }, [subscriptionStatus]);

  const suggestedPlanId = getPayablePlanIdForRole(role);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser?.uid) {
        if (!cancelled) {
          setTrialUsed(false);
          setTrialLoading(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        const used = Boolean(snap.exists() && snap.data()?.trialUsed);
        if (!cancelled) {
          setTrialUsed(used);
        }
      } catch (error) {
        console.error("Failed to read trial status:", error);
      } finally {
        if (!cancelled) {
          setTrialLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleTryAgain = () => {
    navigate("/dashboard", { replace: true });
  };

  const handleGoToPayment = (planId = suggestedPlanId) => {
    navigate(`/subscription-checkout?plan=${encodeURIComponent(planId)}`, {
      state: {
        role,
        username,
        userTeam
      }
    });
  };

  const handleClubContact = () => {
    window.location.href = buildClubContactMailto({
      teamName: userTeam,
      username,
      source: "subscription-required"
    });
  };

  const handleGoHome = () => {
    navigate("/landing", { replace: true });
  };

  const handleStartTrial = async () => {
    if (String(role || "").toLowerCase() !== "player") {
      window.alert("7-day free trial is available only for player accounts.");
      return;
    }

    if (trialUsed) {
      window.alert("Free trial is no longer available for this account.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      window.alert("Session expired. Please log in again.");
      navigate("/login", { replace: true });
      return;
    }

    try {
      const now = new Date();
      const subscriptionUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await updateDoc(doc(db, "users", currentUser.uid), {
        subscriptionPlan: "free",
        subscriptionStatus: "trialing",
        subscriptionActive: true,
        subscriptionSource: "in_app_trial",
        trialUsed: true,
        trialStartedAt: now,
        subscriptionStartedAt: now,
        subscriptionUntil
      });

      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Failed to start trial:", error);
      window.alert("Could not start free trial. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn("Logout warning:", error);
    }
    clearCurrentUser();
    navigate("/login", { replace: true });
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
          maxWidth: 640,
          background: "white",
          borderRadius: 20,
          border: "1px solid rgba(16, 24, 40, 0.08)",
          boxShadow: "0 16px 40px rgba(16, 24, 40, 0.1)",
          padding: "30px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18
        }}
      >

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems:"center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(255,104,31,0.1)",
              color: ORANGE,
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 700
            }}
          >
            !
          </div>
          <h1 style={{ margin: 0, color: TEXT, fontSize: 28, fontWeight: 900 }}>
            Subscription required
          </h1>
          </div>
          <p style={{ margin: 0, color: MUTED, lineHeight: 1.6 }}>
            Your account does not have an active subscription, so dashboard access is currently blocked.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10
          }}
        >
          <InfoChip label="User" value={username} />
          <InfoChip label="Role" value={role} />
          <InfoChip label="Team" value={userTeam} />
          <InfoChip label="Status" value={statusLabel} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: TEXT }}>
            Available subscriptions
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>
            Pick a plan and continue to payment. Club subscriptions are handled by email.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#475467" }}>
            {suggestedPlanId === "player"
              ? "Player accounts can start the 7-day trial and purchase the Player subscription."
              : "Manager accounts can purchase only the Manager subscription."}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#475467" }}>
            Club contact:{" "}
            <a href={`mailto:${CLUB_CONTACT_EMAIL}`} style={{ color: ORANGE, fontWeight: 700 }}>
              {CLUB_CONTACT_EMAIL}
            </a>
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10
            }}
          >
            {SUBSCRIPTION_PLANS.map(plan => (
              (() => {
                const isFreePlan = plan.id === "free";
                const roleLocked = !isPlanAllowedForRole(plan.id, role);
                const trialLocked = isFreePlan && (trialUsed || trialLoading);
                const disabled = roleLocked || trialLocked;

                let disabledLabel = "Unavailable";
                if (roleLocked) {
                  disabledLabel = plan.id === "player" || plan.id === "free"
                    ? "Player account only"
                    : plan.id === "manager"
                    ? "Manager account only"
                    : "Not available for your role";
                } else if (trialLoading) {
                  disabledLabel = "Checking availability...";
                } else if (trialUsed) {
                  disabledLabel = "Trial already used";
                }

                return (
              <PlanCard
                key={plan.id}
                plan={plan}
                disabled={disabled}
                roleLocked={roleLocked}
                disabledLabel={disabledLabel}
                onChoose={() =>
                  plan.id === "free"
                    ? handleStartTrial()
                    : plan.id === "club"
                    ? handleClubContact()
                    : handleGoToPayment(plan.id)
                }
              />
                );
              })()
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" style={primaryBtn} onClick={() => handleGoToPayment()}>
            Go to payment
          </button>
          <button type="button" style={secondaryBtn} onClick={handleTryAgain}>
            Re-check access
          </button>
          <button type="button" style={secondaryBtn} onClick={handleGoHome}>
            Back to landing
          </button>
          <button type="button" style={dangerBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
          7-day free trial is available only for player accounts. After plan activation, click <strong>Re-check access</strong>.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Review our{" "}
          <Link to="/terms-and-conditions" style={policyLink}>
            Terms & Conditions
          </Link>{" "}
          and{" "}
          <Link to="/privacy-policy" style={policyLink}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onChoose,
  disabled = false,
  roleLocked = false,
  disabledLabel = "Unavailable"
}) {
  const isFree = !plan.isPaid;
  const isClub = plan.id === "club";
  const buttonStyle = isFree ? neutralBtn : plan.highlight ? smallPrimaryBtn : smallSecondaryBtn;

  return (
    <div
      style={{
        borderRadius: 14,
        border: plan.highlight
          ? "1px solid rgba(255,104,31,0.45)"
          : "1px solid rgba(16, 24, 40, 0.1)",
        background: plan.highlight ? "#FFF8F3" : "white",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...(roleLocked
          ? {
              opacity: 0.5,
              filter: "grayscale(0.3)",
              background: "#F8FAFC",
              border: "1px solid rgba(16, 24, 40, 0.12)"
            }
          : {})
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 16 }}>{plan.title}</strong>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: plan.highlight ? "#C2410C" : "#475467",
            background: plan.highlight ? "rgba(255,104,31,0.14)" : "#F2F4F7",
            border: "1px solid rgba(16, 24, 40, 0.08)",
            borderRadius: 999,
            padding: "4px 8px"
          }}
        >
          {plan.badge}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: plan.highlight ? ORANGE : TEXT }}>
          {plan.price}
        </span>
        {plan.period ? <span style={{ color: MUTED, fontWeight: 700 }}>{plan.period}</span> : null}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {plan.features.map(feature => (
          <div
            key={feature}
            style={{ display: "flex", gap: 8, alignItems: "center", color: "#344054", fontSize: 13 }}
          >
            <span style={{ color: ORANGE, fontWeight: 900 }}>+</span>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        style={{
          ...buttonStyle,
          ...(disabled
            ? {
                opacity: 0.6,
                cursor: "not-allowed"
              }
            : {})
        }}
        onClick={disabled ? undefined : onChoose}
        disabled={disabled}
      >
        {disabled
          ? disabledLabel
          : isFree
          ? "Start"
          : isClub
          ? `${CLUB_CONTACT_EMAIL}`
          : "Choose and pay"}
      </button>
      {isFree ? (
        <p style={{ margin: 0, color: MUTED, fontSize: 12 }}>
          Free plan is available only for players.
        </p>
      ) : null}
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div
      style={{
        background: "#F9FAFB",
        border: "1px solid rgba(16, 24, 40, 0.08)",
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4
      }}
    >
      <span style={{ color: "#475467", fontSize: 12, fontWeight: 700 }}>{label}</span>
      <span
        style={{
          color: "#111827",
          fontSize: 14,
          fontWeight: 700,
          wordBreak: "break-word"
        }}
      >
        {value || "-"}
      </span>
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

const secondaryBtn = {
  border: "1px solid rgba(16, 24, 40, 0.15)",
  borderRadius: 10,
  padding: "10px 14px",
  background: "white",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer"
};

const dangerBtn = {
  border: "1px solid rgba(217, 45, 32, 0.25)",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#FEF3F2",
  color: "#B42318",
  fontWeight: 700,
  cursor: "pointer"
};

const smallPrimaryBtn = {
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  background: ORANGE,
  color: "white",
  fontWeight: 800,
  cursor: "pointer"
};

const smallSecondaryBtn = {
  border: "1px solid rgba(16, 24, 40, 0.15)",
  borderRadius: 10,
  padding: "9px 12px",
  background: "white",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer"
};

const neutralBtn = {
  border: "1px solid rgba(16, 24, 40, 0.15)",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#F9FAFB",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer"
};

const policyLink = {
  color: ORANGE,
  fontWeight: 700,
  textDecoration: "none"
};
