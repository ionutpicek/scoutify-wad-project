import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const ORANGE = "#FF681F";
const ORANGE_HOVER = "#FF4500";
const SOFT = "#FFF2E8";

export default function LandingPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const styles = useMemo(() => {
    const pill = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 14px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.35)",
      background: "rgba(255,255,255,0.16)",
      color: "white",
      fontWeight: 800,
      fontSize: 13,
      letterSpacing: 0.2,
    };

    const btn = (variant = "primary") => ({
      border: "none",
      cursor: "pointer",
      borderRadius: 14,
      padding: "12px 16px",
      fontWeight: 900,
      fontSize: 14,
      transition: "transform 120ms ease, background 160ms ease, box-shadow 160ms ease",
      boxShadow: "0 14px 26px rgba(0,0,0,0.14)",
      ...(variant === "primary"
        ? { background: "white", color: ORANGE }
        : {
            background: "rgba(255,255,255,0.16)",
            border: "1px solid rgba(255,255,255,0.35)",
            color: "white",
            boxShadow: "none",
          }),
    });

    const card = {
      background: "white",
      borderRadius: 20,
      padding: 18,
      border: "1px solid rgba(255,104,31,0.15)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
    };

    return { pill, btn, card };
  }, []);

  return (
    <div style={page} className="landing-page-shell">
      <style>{`
        @keyframes floaty {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-10px) translateX(6px); }
          100% { transform: translateY(0) translateX(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fadeUp { animation: fadeUp 520ms ease both; }
        .fadeUp2 { animation: fadeUp 620ms ease both; }
        .fadeUp3 { animation: fadeUp 720ms ease both; }
        .btnHover:hover { transform: translateY(-1px); }
      `}</style>

      {/* Top nav */}
      <header style={topNav} className="landing-top-nav">
        <div style={navInner} className="landing-nav-inner">
          <div
            style={{ display: "flex", alignItems: "center", gap: 10 }}
            className="landing-nav-links"
          >
            <div style={logoMark}>⚽</div>
            <div style={brand}>Scoutify</div>
            <div style={tag}>Women’s Football Romania · 1st Division</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => goTo("features")}
              style={navLink}
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => goTo("leaderboards")}
              style={navLink}
            >
              Leaderboards
            </button>
            <button
              type="button"
              onClick={() => goTo("pricing")}
              style={navLink}
            >
              Pricing
            </button>

            <button
              type="button"
              className="landing-nav-cta btnHover"
              style={navCta}
              onClick={() => navigate("/login")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF2E8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={hero}>
        {/* floating decorations */}
        <div style={blobA} aria-hidden="true" />
        <div style={blobB} aria-hidden="true" />
        <div style={blobC} aria-hidden="true" />

        <div style={heroInner} className="landing-hero-inner">
          <div style={{ maxWidth: 640 }}>
            <div className={mounted ? "fadeUp" : ""} style={{ marginBottom: 12 }}>
              <span style={styles.pill}>✨ Data → Decisions</span>
              <span style={{ ...styles.pill, marginLeft: 10 }}>🏆 League-ready scouting</span>
            </div>

            <h1 className={mounted ? "fadeUp2" : ""} style={heroTitle}>
              Scout smarter in the{"  "}
              <span style={titleAccent}>Romanian Women's League</span>.
            </h1>

            <p className={mounted ? "fadeUp3" : ""} style={heroSub}>
              Scoutify brings match grades, player stats, season evaluations, comparisons and
              leaderboards — all in one fast platform designed for coaches, analysts, and managers.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <button
                type="button"
                className="btnHover"
                style={styles.btn("primary")}
                onClick={() => navigate("/register")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF2E8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                Create account 🚀
              </button>

              <button
                type="button"
                className="btnHover"
                style={styles.btn("secondary")}
                onClick={() => goTo("features")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.24)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
              >
                Explore features 👀
              </button>

              <button
                type="button"
                className="btnHover"
                style={{
                  ...styles.btn("secondary"),
                  borderStyle: "dashed",
                }}
                onClick={() => goTo("pricing")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.24)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
              >
                See plans 💳
              </button>
            </div>

            <div style={heroBadges}>
              <Badge text="✅ Match grades & key stats" />
              <Badge text="✅ Season grades (overall + role)" />
              <Badge text="✅ Compare players by position" />
              <Badge text="✅ Leaderboards: goals, assists, duels, clean sheets, saves" />
            </div>
          </div>

          {/* Right mock panel */}
          <div style={heroPanel} className="landing-hero-panel">
            <div style={panelHeader}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={dot("#FF5F57")} />
                <div style={dot("#FFBD2E")} />
                <div style={dot("#28C840")} />
              </div>
              <div style={{ fontWeight: 900, color: "#111" }}>Live Snapshot</div>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={miniCard}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>🏅 Leaderboards</div>
                <div style={{ color: "#6B7280", fontSize: 12 }}>
                  Spot top performers instantly.
                </div>
                <div style={chipsRow}>
                  <Chip text="Goals" />
                  <Chip text="Duels Won" />
                  <Chip text="Saves" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={miniCard}>
                  <div style={kpiTitle}>⭐ Season Grade</div>
                  <div style={kpiValue}>7.4</div>
                  <div style={kpiSub}>Confidence 100%</div>
                </div>
                <div style={miniCard}>
                  <div style={kpiTitle}>📊 Matches analyzed</div>
                  <div style={kpiValue}>14</div>
                  <div style={kpiSub}>This season</div>
                </div>
              </div>

              <div style={miniCard}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>🧩 Compare Players</div>
                <div style={{ color: "#6B7280", fontSize: 12 }}>
                  Pick two players and compare by metrics & roles.
                </div>
                <div style={compareBar}>
                  <div style={{ ...compareFill, width: "62%" }} />
                </div>
              </div>
            </div>

            <div style={panelFooter}>
              <span style={{ fontWeight: 900, color: ORANGE }}>Scoutify</span>
              <span style={{ color: "#6B7280", fontWeight: 700 }}>
                Faster scouting. Better decisions.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={section}>
        <div style={container}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>Everything your staff needs</h2>
            <p style={sectionSub}>
              Built for women’s football in Romania’s top division: simple UX, fast navigation,
              and scouting-focused insight.
            </p>
          </div>

          <div style={featureGrid} className="landing-feature-grid">
            <FeatureCard
              icon="📈"
              title="Player stats & profiles"
              desc="Minutes, performance stats and clean player profiles with photos."
            />
            <FeatureCard
              icon="⭐"
              title="Season grades"
              desc="A season evaluation score with role-specific breakdown."
            />
            <FeatureCard
              icon="🆚"
              title="Compare players"
              desc="Compare two players across key metrics and position context."
            />
            <FeatureCard
              icon="🎯"
              title="Match analysis"
              desc="Upload match reports, view lineups, grades, and match-level stats."
            />
            <FeatureCard
              icon="🏆"
              title="Leaderboards"
              desc="Goals, assists, duels won, clean sheets, saves — total and per 90."
            />
            <FeatureCard
              icon="🧠"
              title="Decision-ready scouting"
              desc="Designed for managers: quick answers, no clutter, all in one place."
            />
          </div>
        </div>
      </section>

      {/* Leaderboards highlight */}
      <section id="leaderboards" style={sectionAlt}>
        <div style={container}>
            <div style={split} className="landing-split">
            <div>
              <h2 style={sectionTitle}>Leaderboards that feel like a TV broadcast</h2>
              <p style={sectionSub}>
                Switch categories, toggle total/per90 and instantly see the podium. Perfect for
                weekly reports and recruitment meetings.
              </p>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <Callout text="🔥 Quick spotting of top performers" />
                <Callout text="📌 Podium with photos and clean layout" />
                <Callout text="⚡ Fast navigation, built for daily use" />
              </div>

              <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btnHover"
                  style={primaryCta}
                  onClick={() => navigate("/register")}
                  onMouseEnter={(e) => (e.currentTarget.style.background = ORANGE_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                >
                  Start scouting now 🎬
                </button>

                <button
                  type="button"
                  className="btnHover"
                  style={ghostCta}
                  onClick={() => goTo("pricing")}
                >
                  See plans →
                </button>
              </div>
            </div>

            <div style={mockLeaderboard} className="landing-mock-leaderboard">
              <div style={mockTopRow}>
                <span style={mockPill}>Goals</span>
                <span style={mockPill}>Assists</span>
                <span style={{ ...mockPill, background: SOFT, borderColor: ORANGE, color: "#111" }}>
                  Duels Won
                </span>
              </div>

              <div style={mockBody}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} style={mockRow} className="landing-mock-row">
                    <div style={mockRank}>{n}</div>
                    <div style={mockName}>
                      <div style={{ fontWeight: 900 }}>Player {n}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Team Name</div>
                    </div>
                    <div style={mockVal} className="landing-mock-val">
                      <div style={{ fontWeight: 900 }}>{Math.round(520 - n * 77)}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>total</div>
                    </div>
                  </div>
                ))}
              </div>

            <div style={mockPodium} className="landing-mock-podium">
                <div style={podBoxSmall}>
                  <div style={podBadge}>2</div>
                  <div style={podAvatar}>E</div>
                  <div style={podName}>Erika</div>
                </div>
                <div style={podBoxBig}>
                  <div style={podBadge}>1</div>
                  <div style={{ ...podAvatar, width: 56, height: 56 }}>N</div>
                  <div style={podName}>Nadin</div>
                </div>
                <div style={podBoxSmall}>
                  <div style={podBadge}>3</div>
                  <div style={podAvatar}>C</div>
                  <div style={podName}>Cristina</div>
                </div>
                <div style={sparkA}>✨</div>
                <div style={sparkB}>⭐</div>
                <div style={sparkC}>✦</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={section}>
        <div style={container}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>How it works</h2>
            <p style={sectionSub}>Create an account, pick your club, and start using data daily.</p>
          </div>

          <div style={stepsGrid} className="landing-steps-grid">
            <Step n="1" title="Create an account" desc="Managers and staff register in seconds." />
            <Step n="2" title="Explore players & matches" desc="Profiles, grades, games and stats." />
            <Step n="3" title="Compare & decide" desc="Use leaderboards and comparisons to scout." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={sectionAlt}>
        <div style={container}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>Plans (subscription-ready)</h2>
            <p style={sectionSub}>
              Start free, upgrade when you’re ready. Built for clubs, analysts and staff.
            </p>
          </div>

          <div style={pricingGrid} className="landing-pricing-grid">
            <PriceCard
              title="Free"
              price="0"
              badge="Try it"
              features={[
                "Browse core features",
                "Limited leaderboards",
                "Basic player profiles",
              ]}
            />
            <PriceCard
              title="Pro"
              price="€3.99"
              badge="Most popular"
              highlight
              features={[
                "Full leaderboards (total + per90)",
                "Player compare",
                "Match analysis + lineups",
                "Season grades",
              ]}
            />
            <PriceCard
              title="Club"
              price="Contact"
              badge="For teams"
              features={[
                "Multi-user access",
                "Custom reports & exports",
                "Priority support",
                "Club onboarding",
              ]}
              ctaText="Request access"
              onCta={() => navigate("/register")}
            />
          </div>

          <div style={pricingFoot} className="landing-pricing-foot">
            <button
              type="button"
              className="btnHover"
              style={primaryCta}
              onClick={() => navigate("/register")}
              onMouseEnter={(e) => (e.currentTarget.style.background = ORANGE_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
            >
              Create account & start 🚀
            </button>
            <button
              type="button"
              className="btnHover"
              style={ghostCta}
              onClick={() => navigate("/login")}
            >
              I already have an account →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={footer}>
        <div style={footerInner}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: ORANGE }}>Scoutify</div>
            <div style={{ color: "#6B7280", fontWeight: 700, marginTop: 6 }}>
              Women’s Football Romania · 1st Division
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => goTo("features")} style={footerLink}>
              Features
            </button>
            <button type="button" onClick={() => goTo("pricing")} style={footerLink}>
              Pricing
            </button>
            <button type="button" onClick={() => navigate("/register")} style={footerCta}>
              Create account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------- components -------------------- */

function Badge({ text }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.25)",
        color: "white",
        fontWeight: 800,
        fontSize: 13,
      }}
    >
      <span>✅</span> <span>{text}</span>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={featureCard}>
      <div style={featureIcon}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
      <div style={{ color: "#6B7280", fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>
        {desc}
      </div>
    </div>
  );
}

function Callout({ text }) {
  return (
    <div style={callout}>
      <span style={{ fontSize: 16 }}>✨</span>
      <span style={{ fontWeight: 800 }}>{text}</span>
    </div>
  );
}

function Chip({ text }) {
  return (
    <span
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        background: SOFT,
        border: "1px solid rgba(255,104,31,0.18)",
        fontWeight: 900,
        fontSize: 12,
        color: "#111",
      }}
    >
      {text}
    </span>
  );
}

function Step({ n, title, desc }) {
  return (
    <div style={stepCard}>
      <div style={stepNum}>{n}</div>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        <div style={{ color: "#6B7280", fontWeight: 700, marginTop: 6 }}>{desc}</div>
      </div>
    </div>
  );
}

function PriceCard({ title, price, badge, features, highlight, ctaText, onCta }) {
  return (
    <div
      style={{
        ...priceCard,
        ...(highlight
          ? {
              borderColor: "rgba(255,104,31,0.40)",
              boxShadow: "0 22px 46px rgba(255,104,31,0.14)",
              transform: "translateY(-2px)",
            }
          : {}),
      }}
    >
      <div style={priceTop}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        <div style={priceBadge}>{badge}</div>
      </div>

      <div style={priceValue}>
        <span style={{ fontSize: 34, fontWeight: 1000, color: ORANGE }}>{price}</span>
        {price !== "Contact" ? <span style={{ color: "#6B7280", fontWeight: 800 }}>/mo</span> : null}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {features.map((f) => (
          <div key={f} style={priceLine}>
            <span style={{ color: ORANGE, fontWeight: 900 }}>✓</span>
            <span style={{ fontWeight: 800 }}>{f}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btnHover"
        style={{
          marginTop: 16,
          width: "100%",
          borderRadius: 14,
          border: highlight ? "none" : "1px solid rgba(255,104,31,0.25)",
          background: highlight ? ORANGE : "white",
          color: highlight ? "white" : ORANGE,
          padding: "12px 14px",
          fontWeight: 1000,
          cursor: "pointer",
        }}
        onClick={onCta || (() => window.alert("Coming soon 👀"))}
        onMouseEnter={(e) => {
          if (highlight) e.currentTarget.style.background = ORANGE_HOVER;
          else e.currentTarget.style.background = "#FFF2E8";
        }}
        onMouseLeave={(e) => {
          if (highlight) e.currentTarget.style.background = ORANGE;
          else e.currentTarget.style.background = "white";
        }}
      >
        {ctaText || (highlight ? "Go Pro" : "Get started")}
      </button>
    </div>
  );
}

/* -------------------- styles -------------------- */

const page = {
  minHeight: "100vh",
  width: "100%",
  background: "#fffaf8",
  color: "#111",
};

const topNav = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};

const navInner = {
  width: "100%",
  padding: "12px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const logoMark = {
  width: 36,
  height: 36,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: SOFT,
  color: ORANGE,
  fontWeight: 1000,
  border: "1px solid rgba(255,104,31,0.25)",
};

const brand = { fontWeight: 1000, fontSize: 16 };

const tag = {
  marginLeft: 10,
  fontSize: 12,
  fontWeight: 800,
  color: "#6B7280",
  display: "none",
};

const navLink = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 900,
  color: "#111",
  padding: "10px 10px",
  borderRadius: 12,
};

const navCta = {
  border: "none",
  background: "white",
  color: ORANGE,
  fontWeight: 1000,
  padding: "10px 14px",
  borderRadius: 14,
  cursor: "pointer",
  boxShadow: "0 14px 26px rgba(0,0,0,0.10)",
};

const hero = {
  position: "relative",
  background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_HOVER} 100%)`,
  color: "white",
  overflow: "hidden",
};

const heroInner = {
  width: "100%",
  padding: "60px 18px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 22,
  alignItems: "center",
};

const heroTitle = {
  margin: 0,
  fontSize: "clamp(2.8rem, 4vw, 3.6rem)",
  fontWeight: 1000,
  lineHeight: 1.1,
  letterSpacing: 0.2,
};

const titleAccent = {
  background: "rgba(255,255,255,0.16)",
  padding: "0px 8px",
  margin: "12px -8px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
};

const heroSub = {
  marginTop: 14,
  marginBottom: 0,
  fontSize: 16,
  lineHeight: 1.55,
  fontWeight: 800,
  opacity: 0.95,
};

const heroBadges = {
  marginTop: 18,
  display: "grid",
  gap: 10,
};

const heroPanel = {
  borderRadius: 22,
  background: "rgba(255,255,255,0.92)",
  color: "#111",
  border: "1px solid rgba(255,255,255,0.35)",
  boxShadow: "0 30px 70px rgba(0,0,0,0.20)",
  overflow: "hidden",
};

const panelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.75)",
};

const panelFooter = {
  padding: "12px 14px",
  borderTop: "1px solid rgba(0,0,0,0.06)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const dot = (c) => ({
  width: 10,
  height: 10,
  borderRadius: 999,
  background: c,
});

const miniCard = {
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.06)",
  background: "white",
  padding: 14,
  boxShadow: "0 14px 28px rgba(0,0,0,0.06)",
};

const chipsRow = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 };

const kpiTitle = { fontWeight: 900, color: "#6B7280", fontSize: 12 };
const kpiValue = { fontWeight: 1000, fontSize: 30, color: ORANGE, marginTop: 6 };
const kpiSub = { marginTop: 2, color: "#6B7280", fontWeight: 800, fontSize: 12 };

const compareBar = {
  marginTop: 12,
  height: 10,
  borderRadius: 999,
  background: "#F3F4F6",
  overflow: "hidden",
};

const compareFill = {
  height: "100%",
  borderRadius: 999,
  background: ORANGE,
  opacity: 0.9,
};

const section = { padding: "64px 0" };
const sectionAlt = { padding: "64px 0", background: "#fff" };

const container = { width: "100%", padding: "0 18px" };

const sectionHead = {};
const sectionTitle = {
  margin: 0,
  fontSize: "clamp(1.9rem, 2.4vw, 2.5rem)",
  fontWeight: 1000,
  letterSpacing: 0.2,
};
const sectionSub = { marginTop: 10, color: "#6B7280", fontWeight: 800, lineHeight: 1.55 };

const featureGrid = {
  marginTop: 26,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const featureCard = {
  background: "white",
  borderRadius: 20,
  padding: 18,
  border: "1px solid rgba(255,104,31,0.14)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
};

const featureIcon = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: SOFT,
  border: "1px solid rgba(255,104,31,0.22)",
  marginBottom: 10,
  fontSize: 20,
};

const split = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
  alignItems: "center",
};

const callout = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 16,
  background: "rgba(255,104,31,0.08)",
  border: "1px solid rgba(255,104,31,0.16)",
};

const primaryCta = {
  background: ORANGE,
  color: "white",
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 18px 30px rgba(255,104,31,0.20)",
};

const ghostCta = {
  background: "transparent",
  color: "#111",
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 1000,
  cursor: "pointer",
};

const mockLeaderboard = {
  borderRadius: 22,
  background: "white",
  border: "1px solid rgba(255,104,31,0.14)",
  boxShadow: "0 22px 46px rgba(0,0,0,0.10)",
  overflow: "hidden",
};

const mockTopRow = {
  display: "flex",
  gap: 10,
  padding: 14,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  flexWrap: "wrap",
};

const mockPill = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.10)",
  fontWeight: 1000,
  background: "#fff",
};

const mockBody = { padding: 14, display: "grid", gap: 10 };

const mockRow = {
  display: "grid",
  gridTemplateColumns: "42px 1fr 70px",
  alignItems: "center",
  gap: 10,
  padding: "10px 10px",
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.06)",
  background: "#fffaf8",
};

const mockRank = {
  width: 36,
  height: 36,
  borderRadius: 14,
  background: ORANGE,
  color: "white",
  display: "grid",
  placeItems: "center",
  fontWeight: 1000,
};

const mockName = { minWidth: 0 };
const mockVal = { textAlign: "right" };

const mockPodium = {
  position: "relative",
  display: "flex",
  gap: 12,
  justifyContent: "center",
  alignItems: "flex-end",
  padding: 16,
  borderTop: "1px solid rgba(0,0,0,0.06)",
  background: "#fff",
};

const podBoxSmall = {
  width: 120,
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255,104,31,0.16), rgba(255,104,31,0.05))",
  border: "1px solid rgba(255,104,31,0.20)",
  padding: 12,
  display: "grid",
  gap: 8,
  justifyItems: "center",
};

const podBoxBig = {
  width: 140,
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255,104,31,0.22), rgba(255,104,31,0.06))",
  border: "1px solid rgba(255,104,31,0.28)",
  padding: 12,
  display: "grid",
  gap: 8,
  justifyItems: "center",
};

const podBadge = {
  width: 26,
  height: 26,
  borderRadius: 10,
  background: ORANGE,
  color: "white",
  display: "grid",
  placeItems: "center",
  fontWeight: 1000,
  justifySelf: "end",
};

const podAvatar = {
  width: 48,
  height: 48,
  borderRadius: 18,
  background: SOFT,
  border: "1px solid rgba(255,104,31,0.22)",
  display: "grid",
  placeItems: "center",
  color: ORANGE,
  fontWeight: 1000,
};

const podName = { fontWeight: 1000 };

const sparkA = { position: "absolute", top: 12, left: 18, fontSize: 18 };
const sparkB = { position: "absolute", top: 18, right: 20, fontSize: 18 };
const sparkC = { position: "absolute", bottom: 14, right: 90, fontSize: 16 };

const stepsGrid = {
  marginTop: 22,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const stepCard = {
  borderRadius: 20,
  padding: 18,
  background: "white",
  border: "1px solid rgba(255,104,31,0.14)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const stepNum = {
  width: 44,
  height: 44,
  borderRadius: 18,
  background: SOFT,
  border: "1px solid rgba(255,104,31,0.22)",
  display: "grid",
  placeItems: "center",
  color: ORANGE,
  fontWeight: 1000,
};

const pricingGrid = {
  marginTop: 22,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  alignItems: "start",
};

const priceCard = {
  borderRadius: 22,
  padding: 18,
  background: "white",
  border: "1px solid rgba(255,104,31,0.14)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
};

const priceTop = { display: "flex", justifyContent: "space-between", alignItems: "center" };

const priceBadge = {
  padding: "8px 10px",
  borderRadius: 999,
  background: SOFT,
  border: "1px solid rgba(255,104,31,0.22)",
  color: ORANGE,
  fontWeight: 1000,
  fontSize: 12,
};

const priceValue = { display: "flex", gap: 10, alignItems: "baseline", marginTop: 12 };

const priceLine = { display: "flex", gap: 10, alignItems: "center" };

const pricingFoot = {
  marginTop: 18,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const footer = {
  padding: "26px 0",
  borderTop: "1px solid rgba(0,0,0,0.06)",
  background: "#fff",
};

const footerInner = {
  width: "100%",
  padding: "0 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const footerLink = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#111",
  fontWeight: 900,
  padding: "10px 12px",
  borderRadius: 12,
};

const footerCta = {
  border: "none",
  background: ORANGE,
  color: "white",
  fontWeight: 1000,
  padding: "10px 14px",
  borderRadius: 14,
  cursor: "pointer",
  boxShadow: "0 18px 30px rgba(255,104,31,0.20)",
};

const blobA = {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.12)",
  top: -120,
  left: -140,
  filter: "blur(2px)",
  animation: "floaty 7s ease-in-out infinite",
};

const blobB = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.10)",
  bottom: -220,
  right: -240,
  filter: "blur(2px)",
  animation: "floaty 9s ease-in-out infinite",
};

const blobC = {
  position: "absolute",
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.10)",
  bottom: 60,
  left: "52%",
  filter: "blur(2px)",
  animation: "floaty 8s ease-in-out infinite",
};
