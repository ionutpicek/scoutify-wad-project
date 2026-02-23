import React from "react";
import { useNavigate } from "react-router-dom";

const BG = "#F7F8FA";
const TEXT = "#101828";
const MUTED = "#667085";
const ORANGE = "#FF681F";

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        padding: "24px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 940,
          background: "#fff",
          borderRadius: 20,
          border: "1px solid rgba(16, 24, 40, 0.08)",
          boxShadow: "0 16px 40px rgba(16, 24, 40, 0.08)",
          padding: "28px 24px",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, color: TEXT, fontSize: 30, fontWeight: 900 }}>
              Terms & Conditions
            </h1>
            <p style={{ margin: 0, color: MUTED }}>Last updated: February 15, 2026</p>
          </div>
          <button type="button" onClick={() => navigate(-1)} style={backBtn}>
            Back
          </button>
        </div>

        <Section
          title="1. Scope"
          text="These terms govern access to and use of the Scoutify platform, including player analytics, team reports, and subscription services."
        />
        <Section
          title="2. Account and Access"
          text="You are responsible for account security and all activity under your account. Access may be suspended for misuse, fraud, or policy violations."
        />
        <Section
          title="3. Subscription and Payments"
          text="Paid plans are billed according to the selected pricing plan. Access features depend on active subscription status. Trial and promotional eligibility may be limited."
        />
        <Section
          title="4. Cancellation and Changes"
          text="You may cancel according to your subscription terms and payment provider rules. Plan prices, features, and billing providers may change with notice."
        />
        <Section
          title="5. Acceptable Use"
          text="You agree not to abuse the service, reverse engineer restricted components, scrape protected data, or use the platform for unlawful purposes."
        />
        <Section
          title="6. Data and Content"
          text="You retain ownership of your uploaded data. By using the service, you grant Scoutify rights necessary to process, store, and display content to provide the product."
        />
        <Section
          title="7. Liability"
          text="The platform is provided as-is. To the maximum extent allowed by law, Scoutify disclaims indirect damages and limits liability related to service availability or outcomes."
        />
        <Section
          title="8. Contact"
          text="For legal or subscription questions, contact support through the email address shown on the subscription pages."
        />
      </div>
    </div>
  );
}

function Section({ title, text }) {
  return (
    <section style={{ display: "grid", gap: 6 }}>
      <h2 style={{ margin: 0, color: ORANGE, fontSize: 18, fontWeight: 800 }}>{title}</h2>
      <p style={{ margin: 0, color: TEXT, lineHeight: 1.65 }}>{text}</p>
    </section>
  );
}

const backBtn = {
  border: "1px solid rgba(16, 24, 40, 0.15)",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#fff",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
  height: "fit-content",
};

