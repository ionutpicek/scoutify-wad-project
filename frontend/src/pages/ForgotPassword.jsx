import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useForgotPasswordForm } from "../hooks/useForgotPasswordForm";

const ORANGE = "#FF681F";
const ORANGE_HOVER = "#FF4500";
const ERROR = "#EF4444";
const SUCCESS = "#16A34A";

const ForgotPassword = () => {
  const {
    email,
    setEmail,
    focused,
    setFocused,
    status,
    isSubmitting,
    didSucceed,
    shake,
    handleReset,
  } = useForgotPasswordForm();

  const styles = useMemo(() => {
    const baseInput = {
      padding: "12px 15px",
      width: 280,
      borderRadius: 10,
      border: `1px solid ${ORANGE}`,
      backgroundColor: "#fffffd",
      boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
      fontSize: 16,
      outline: "none",
      color: "#000",
      transition: "transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease",
    };

    const focusInput = {
      borderColor: ORANGE_HOVER,
      boxShadow: `0 0 0 4px rgba(255,104,31,0.22)`,
      transform: "translateY(-1px)",
    };

    const errorInput = {
      borderColor: ERROR,
      boxShadow: `0 0 0 4px rgba(239,68,68,0.18)`,
    };

    const messageBox = {
      width: 280,
      borderRadius: 12,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 700,
      textAlign: "center",
      border:
        status.type === "success"
          ? "1px solid rgba(22,163,74,0.25)"
          : "1px solid rgba(239,68,68,0.25)",
      background:
        status.type === "success"
          ? "rgba(22,163,74,0.08)"
          : "rgba(239,68,68,0.08)",
      color: status.type === "success" ? SUCCESS : "#991B1B",
      display: status.message ? "flex" : "none",
      gap: 6,
      justifyContent: "center",
      alignItems: "center",
    };

    const submitBtn = {
      backgroundColor: didSucceed ? SUCCESS : ORANGE,
      color: "white",
      border: "none",
      cursor: isSubmitting ? "not-allowed" : "pointer",
      padding: "12px 20px",
      width: 280,
      borderRadius: 10,
      fontSize: 16,
      fontWeight: 900,
      transition: "transform 120ms ease, background 200ms ease, box-shadow 200ms ease",
      boxShadow: "0 10px 20px rgba(0,0,0,0.10)",
      opacity: isSubmitting ? 0.9 : 1,
    };

    return { baseInput, focusInput, errorInput, messageBox, submitBtn };
  }, [didSucceed, isSubmitting, status]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {/* Left side */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p style={{ fontSize: 42, margin: 0, color: ORANGE, fontFamily: "cursive" }}>
          Forgot Password
        </p>

        <div
          style={{
            marginTop: 26,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            animation: shake ? "shake 380ms ease" : "none",
          }}
        >
          <style>
            {`
              @keyframes shake {
                0% { transform: translateX(0); }
                20% { transform: translateX(-8px); }
                40% { transform: translateX(8px); }
                60% { transform: translateX(-6px); }
                80% { transform: translateX(6px); }
                100% { transform: translateX(0); }
              }
            `}
          </style>

          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              ...styles.baseInput,
              ...(focused ? styles.focusInput : {}),
              ...(status.type === "error" ? styles.errorInput : {}),
            }}
            onKeyDown={(e) => e.key === "Enter" && handleReset()}
          />

          <div style={styles.messageBox}>
            {status.type === "success" ? "✔" : "⚠"} {status.message}
          </div>

          <button
            onClick={handleReset}
            style={styles.submitBtn}
            disabled={isSubmitting}
            onMouseOver={(e) => {
              if (!isSubmitting && !didSucceed) {
                e.currentTarget.style.backgroundColor = ORANGE_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = didSucceed ? SUCCESS : ORANGE;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {isSubmitting ? "Sending…" : didSucceed ? "Email sent ✔" : "Send reset link"}
          </button>

          <Link
            to="/login"
            style={{
              marginTop: 6,
              color: ORANGE,
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Back to login
          </Link>
        </div>
      </div>

      {/* Right side */}
      <div
        style={{
          flex: 1,
          backgroundColor: ORANGE,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "cursive",
        }}
      >
        Scoutify
      </div>
    </div>
  );
};

export default ForgotPassword;
