import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPageMobile.css";

const ORANGE = "#FF681F";
const ORANGE_HOVER = "#FF4500";

const features = [
  {
    icon: "📊",
    title: "Player stats & profiles",
    desc: "Minutes, performance trends and clean cards with photos.",
  },
  {
    icon: "✅",
    title: "Season grades",
    desc: "Role-specific evaluation scores for fast rating.",
  },
  {
    icon: "📈",
    title: "Compare players",
    desc: "Two-player comparison with metrics and role context.",
  },
  {
    icon: "👜",
    title: "Match reports",
    desc: "Upload PDFs, review lineups and grade every match.",
  },
];

const steps = [
  { id: "1", title: "Create an account", desc: "Managers register in seconds." },
  { id: "2", title: "Explore players", desc: "Profiles, grades and match stats." },
  { id: "3", title: "Compare & decide", desc: "Use leaderboards to scout smarter." },
];

const plans = [
  {
    title: "Free",
    price: "0",
    badge: "Try it",
    features: ["Browse core features", "Limited leaderboards", "Basic profiles"],
  },
  {
    title: "Pro",
    price: "€3.99",
    badge: "Most popular",
    highlight: true,
    features: [
      "Full leaderboards",
      "Player compare",
      "Match analysis",
      "Season grades",
    ],
  },
  {
    title: "Club",
    price: "Contact",
    badge: "For teams",
    features: [
      "Multi-user access",
      "Custom reports",
      "Priority onboarding",
    ],
  },
];

export default function LandingPageMobile() {
  const navigate = useNavigate();
  const heroBadges = useMemo(
    () => ["Match grades & key stats", "Season grades", "Compare players", "Leaderboards"],
    []
  );
  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="landing-mobile-shell">
      <header className="landing-mobile-header">
        <div className="landing-mobile-brand">
          <span className="landing-mobile-logo">⚡</span>
          <div>
            <div className="landing-mobile-title">Scoutify</div>
            <div className="landing-mobile-subtitle">Women’s Football Romania · 1st Division</div>
          </div>
        </div>
        <button
          type="button"
          className="landing-mobile-header-cta"
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </header>

      <section className="landing-mobile-hero">
        <div className="landing-mobile-hero-pill">✨ Data → Decisions</div>
        <h1>Scout smarter in the Romanian Women’s League.</h1>
        <p>
          Scoutify bundles match grades, player stats, season evaluations, and leaderboards into one
          fast platform built for coaches, analysts, and managers.
        </p>
        <div className="landing-mobile-hero-actions">
          <button
            type="button"
            className="landing-mobile-btn primary"
            onClick={() => navigate("/register")}
          >
            Create account 🚀
          </button>
          <button
            type="button"
            className="landing-mobile-btn secondary"
            onClick={() => scrollTo("landing-mobile-features")}
          >
            Explore features 👀
          </button>
        </div>
        <div className="landing-mobile-hero-badges">
          {heroBadges.map((text) => (
            <span key={text} className="landing-mobile-pill small">
              ✓ {text}
            </span>
          ))}
        </div>
      </section>

      <section
        id="landing-mobile-features"
        className="landing-mobile-section"
      >
        <h2>Everything your staff needs</h2>
        <p className="landing-mobile-subtext">
          Simplified navigation and insight tailored for Romania’s top women’s division.
        </p>
        <div className="landing-mobile-feature-grid">
          {features.map(({ icon, title, desc }) => (
            <article key={title} className="landing-mobile-feature-card">
              <div className="landing-mobile-feature-icon">{icon}</div>
              <div className="landing-mobile-feature-title">{title}</div>
              <p className="landing-mobile-feature-desc">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-mobile-section landing-mobile-leaderboards">
        <div>
          <h2>Leaderboards that feel like a TV broadcast</h2>
          <p>
            Switch categories, toggle totals, and spot the podium instantly. Perfect for weekly
            reports and recruitment meetings.
          </p>
        </div>
        <div className="landing-mobile-leaderboard-card">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="landing-mobile-leaderboard-row">
              <span className="landing-mobile-leaderboard-rank">{`#${n}`}</span>
              <div>
                <div className="landing-mobile-leaderboard-name">Player {n}</div>
                <div className="landing-mobile-leaderboard-team">Team Name</div>
              </div>
              <div className="landing-mobile-leaderboard-value">
                {Math.round(520 - n * 77)}
                <span className="landing-mobile-leaderboard-label">total</span>
              </div>
            </div>
          ))}
        </div>
        <div className="landing-mobile-leaderboard-actions">
          <button
            type="button"
            className="landing-mobile-btn primary"
            onClick={() => navigate("/register")}
          >
            Start scouting now ⚡
          </button>
          <button
            type="button"
            className="landing-mobile-btn ghost"
            onClick={() => scrollTo("landing-mobile-pricing")}
          >
            See plans →
          </button>
        </div>
      </section>

      <section className="landing-mobile-section">
        <h2>How it works</h2>
        <p className="landing-mobile-subtext">Create an account, pick your club, and start using data daily.</p>
        <div className="landing-mobile-steps">
          {steps.map(({ id, title, desc }) => (
            <article key={title} className="landing-mobile-step-card">
              <div className="landing-mobile-step-num">{id}</div>
              <div>
                <div className="landing-mobile-step-title">{title}</div>
                <p className="landing-mobile-step-desc">{desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="landing-mobile-pricing"
        className="landing-mobile-section landing-mobile-pricing"
      >
        <h2>Plans (subscription-ready)</h2>
        <div className="landing-mobile-pricing-grid">
          {plans.map((plan) => (
            <article
              key={plan.title}
              className={`landing-mobile-price-card ${plan.highlight ? "highlight" : ""}`}
            >
              <div className="landing-mobile-price-header">
                <div>{plan.title}</div>
                <span className="landing-mobile-price-badge">{plan.badge}</span>
              </div>
              <div className="landing-mobile-price-value">
                <span>{plan.price}</span>
                {plan.price !== "Contact" && <span className="landing-mobile-price-unit">/mo</span>}
              </div>
              <ul className="landing-mobile-price-list">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <span>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`landing-mobile-btn ${plan.highlight ? "primary" : "secondary"}`}
                onClick={() => (plan.title === "Club" ? navigate("/register") : alert("Coming soon"))}
              >
                {plan.highlight ? "Go Pro" : plan.title === "Club" ? "Request access" : "Get started"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-mobile-footer">
        <div>
          <div className="landing-mobile-footer-title">Scoutify</div>
          <div className="landing-mobile-footer-subtitle">
            Women’s Football Romania · 1st Division
          </div>
        </div>
        <div className="landing-mobile-footer-actions">
          <button
            type="button"
            onClick={() => scrollTo("landing-mobile-features")}
            className="landing-mobile-footer-link"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => scrollTo("landing-mobile-pricing")}
            className="landing-mobile-footer-link"
          >
            Pricing
          </button>
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="landing-mobile-btn primary"
          >
            Create account
          </button>
        </div>
      </footer>
    </div>
  );
}
