import React from "react";
import { useNavigate } from "react-router-dom";

const BG = "#F7F8FA";
const TEXT = "#101828";
const MUTED = "#667085";
const ORANGE = "#FF681F";

export default function PrivacyPolicy() {
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
              Privacy Policy
            </h1>
            <p style={{ margin: 0, color: MUTED }}>Last updated: February 15, 2026</p>
          </div>
          <button type="button" onClick={() => navigate(-1)} style={backBtn}>
            Back
          </button>
        </div>

        <Section
          title="1. Data We Collect"
          text="We may collect account identifiers, profile details, subscription metadata, usage logs, and uploaded scouting-related data required to provide platform features."
        />
        <Section
          title="2. How We Use Data"
          text="Data is used to authenticate users, provide analytics features, generate reports, manage subscriptions, and improve service reliability and security."
        />
        <Section
          title="3. Legal Basis and Consent"
          text="Where required, processing is based on contract performance, legitimate interest, legal obligations, or user consent."
        />
        <Section
          title="4. Sharing and Processors"
          text="We may share data with infrastructure, analytics, and payment providers strictly as needed to run the service and process payments."
        />
        <Section
          title="5. Retention"
          text="Data is retained only as long as needed for service delivery, compliance, dispute resolution, and security operations."
        />
        <Section
          title="6. Security"
          text="We apply reasonable technical and organizational controls to protect data against unauthorized access, alteration, disclosure, or destruction."
        />
        <Section
          title="7. Your Rights"
          text="Depending on your jurisdiction, you may request access, correction, deletion, export, or restriction of personal data processing."
        />
        <Section
          title="8. Contact"
          text="For privacy requests, use the support/contact channels shown in the product and subscription pages."
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

