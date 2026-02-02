import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiUrl } from "../../config/api.js";
import { getCurrentUser } from "../../services/sessionStorage.js";
import "./DashboardMobile.css";

const PRIMARY_ACTIONS = [
  {
    key: "players",
    title: "Explore Players",
    desc: "Browse player profiles and season ratings quickly.",
    icon: "🧑‍🤝‍🧑",
    badge: "",
    path: "/players",
  },
  {
    key: "matches",
    title: "Analyze Matches",
    desc: "Review game performances and match uploads.",
    icon: "⚽",
    badge: "",
    path: "/matches",
  },
  {
    key: "compare",
    title: "Compare players",
    desc: "Side-by-side comparisons to inform recruit decisions.",
    icon: "📊",
    badge: "",
    path: "/compare",
    restrictedTo: ["manager", "admin"],
  },
  {
    key: "teams",
    title: "Manage Teams",
    desc: "Manage squads, coaches and context for every club.",
    icon: "🛡️",
    badge: "",
    path: "/teams",
  },
  {
    key: "leaderboard",
    title: "View Leaderboards",
    desc: "Rankings for goals, assists, duels and more.",
    icon: "🏆",
    badge: "",
    path: "/leaderboard",
  },
];

const MANAGEMENT_ACTIONS = [
  {
    key: "player-stats",
    title: "Player stats",
    desc: "Update minutes, goals, clearances and more.",
    icon: "📈",
    badge: "Update",
    path: "/player-stats",
    adminOnly: true,
  },
  {
    key: "season-grades",
    title: "Season grades",
    desc: "Compute grades and export scouting verdicts.",
    icon: "🔍",
    badge: "Compute",
    path: "/season-grades",
    adminOnly: true,
  },
];

export default function DashboardMobile() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = getCurrentUser();
  const savedState = location.state || {};
  const role = savedState.role || storedUser?.role || "manager";
  const userTeam = savedState.userTeam || storedUser?.teamName || "Your team";
  const username = savedState.username || storedUser?.username || "Scout";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canAccessManagement = isAdmin || isManager;

  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      setPendingLoading(true);
      setPendingError("");
      try {
        const res = await fetch(apiUrl("/admin/pending-verifications"));
        if (!res.ok) {
          throw new Error("Unable to load pending approvals.");
        }
        const body = await res.json();
        if (!cancelled) {
          setPendingUsers(body.users || []);
        }
      } catch (err) {
        if (!cancelled) {
          setPendingError(err.message || "Unable to load pending approvals.");
        }
      } finally {
        if (!cancelled) {
          setPendingLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const primaryActions = useMemo(
    () =>
      PRIMARY_ACTIONS.map((action) => ({
        ...action,
        disabled: !!action.restrictedTo && !action.restrictedTo.includes(role),
      })),
    [role]
  );

  const managementActions = useMemo(
    () =>
      MANAGEMENT_ACTIONS.map((action) => ({
        ...action,
        disabled: !!action.adminOnly && !isAdmin,
      })),
    [isAdmin]
  );

  const go = (path) => () => navigate(path, { state: { userTeam, userRole: role, username } });

  const handleLogout = () => navigate("/login");

  return (
    <div className="dashboard-mobile-shell">
      <header className="dashboard-mobile-header">
        <div>
          <p className="dashboard-mobile-greeting">Welcome, {username} ⚡</p>
          <p className="dashboard-mobile-subtitle">
            {role.charAt(0).toUpperCase() + role.slice(1)} · {userTeam}
          </p>
        </div>
        <button className="dashboard-mobile-logout" type="button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="dashboard-mobile-section">
        <div className="dashboard-mobile-section-head">
          <div>
            <h2>Daily workflow</h2>
            <p>Most-used actions at your fingertips.</p>
          </div>
          <span className="dashboard-mobile-section-badge">Superliga 2025/2026</span>
        </div>

        <div className="dashboard-mobile-card-grid">
          {primaryActions.map((action) => (
            <button
              type="button"
              key={action.key}
              className={`dashboard-mobile-card ${action.disabled ? "disabled" : ""}`}
              onClick={action.disabled ? undefined : go(action.path)}
              disabled={action.disabled}
            >
              <div className="dashboard-mobile-card-top">
                <span className="dashboard-mobile-card-icon">{action.icon}</span>
                <div className="dashboard-mobile-card-title-group">
                  <strong>{action.title}</strong>
                </div>
              </div>
              <p className="dashboard-mobile-card-desc">{action.desc}</p>
              <div className="dashboard-mobile-card-foot">
                <span>{action.disabled ? "Staff only" : "Open →"}</span>
                <span>Quick access</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {canAccessManagement && (
        <section className="dashboard-mobile-section">
          <div className="dashboard-mobile-section-head">
            <div>
              <h2>Management & tools</h2>
              <p>Setup, grades, and approvals.</p>
            </div>
          </div>
          <div className="dashboard-mobile-card-grid">
            {managementActions.map((action) => (
              <button
                type="button"
                key={action.key}
                className={`dashboard-mobile-card ${action.disabled ? "disabled" : ""}`}
                onClick={action.disabled ? undefined : go(action.path)}
                disabled={action.disabled}
              >
                <div className="dashboard-mobile-card-top">
                  <span className="dashboard-mobile-card-icon">{action.icon}</span>
                  <div className="dashboard-mobile-card-title-group">
                    <strong>{action.title}</strong>
                    <span className="dashboard-mobile-card-badge">{action.badge}</span>
                  </div>
                </div>
                <p className="dashboard-mobile-card-desc">{action.desc}</p>
                <div className="dashboard-mobile-card-foot">
                  <span>{action.disabled ? "Admin only" : "Open →"}</span>
                  <span>Admin module</span>
                </div>
              </button>
            ))}

            {isAdmin && (
              <button
                type="button"
                className="dashboard-mobile-card"
                onClick={() =>
                  navigate("/verification-queue", {
                    state: { role, username, userTeam },
                  })
                }
              >
                <div className="dashboard-mobile-card-top">
                  <span className="dashboard-mobile-card-icon">!</span>
                  <div className="dashboard-mobile-card-title-group">
                    <strong>Verification queue</strong>
                    <span className="dashboard-mobile-card-badge">Admin</span>
                  </div>
                </div>
                <div className="dashboard-mobile-card-desc">
                  {pendingLoading
                    ? "Loading pending approvals…"
                    : pendingError
                    ? pendingError
                    : `${pendingUsers.length} account${
                        pendingUsers.length === 1 ? "" : "s"
                      } pending review.`}
                </div>
                <div className="dashboard-mobile-card-foot">
                  <span>Open →</span>
                  <span>Admin queue</span>
                </div>
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
