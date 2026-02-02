import React from "react";
import { Link } from "react-router-dom";
import { useForgotPasswordForm } from "../../hooks/useForgotPasswordForm";
import "./ForgotPasswordMobile.css";

export default function ForgotPasswordMobile() {
  const {
    email,
    setEmail,
    focused,
    setFocused,
    status,
    isSubmitting,
    didSucceed,
    handleReset,
  } = useForgotPasswordForm();

  return (
    <div className="forgot-mobile-shell">
      <div className="forgot-mobile-card">
        <h1 className="forgot-mobile-title">Forgot Password</h1>
        <p className="forgot-mobile-subtitle">Reset your Scoutify access</p>
        <p className="forgot-mobile-description">
          Enter the email you registered with and we’ll send a reset link shortly.
        </p>

        <form
          className="forgot-mobile-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleReset();
          }}
        >
          <input
            className="forgot-mobile-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />

          {status.message ? (
            <div className={`forgot-mobile-status ${status.type === "success" ? "success" : "error"}`}>
              {status.type === "success" ? "✔" : "⚠"} {status.message}
            </div>
          ) : null}

          <button
            type="submit"
            className="forgot-mobile-submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Sending…"
              : didSucceed
              ? "Email sent ✓"
              : "Send reset link"}
          </button>
        </form>

        <div className="forgot-mobile-footer">
          <Link className="forgot-mobile-link" to="/login">
            Back to login
          </Link>
          <Link className="forgot-mobile-link" to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
