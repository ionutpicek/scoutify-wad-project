import React from "react";
import { useNavigate } from "react-router-dom";
import { useLoginForm } from "../../hooks/useLoginForm";
import "./LoginMobile.css";

export default function LoginMobile() {
  const navigate = useNavigate();
  const {
    loginData,
    errors,
    isSubmitting,
    didSucceed,
    showPassword,
    setShowPassword,  
    handleChange,
    handleLogin,
    setFocused,
  } = useLoginForm(navigate);

  return (
    <div className="login-mobile-shell">
      <div className="login-mobile-card">
        <header className="login-mobile-header">
          <span className="login-mobile-logo">⚡</span>
          <div>
            <p className="login-mobile-title">Scoutify</p>
            <p className="login-mobile-subtitle">Romanian Women’s League scouting</p>
          </div>
        </header>

        <p className="login-mobile-lead">
          Sign in to access dashboards, player profiles, and match reports in one place.
        </p>

        {errors.general ? (
          <div className="login-mobile-error">{errors.general}</div>
        ) : null}

        {didSucceed ? <div className="login-mobile-success">Welcome back — redirecting…</div> : null}

        <form
          className="login-mobile-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}
        >
          <label className="login-mobile-label">
            Email
            <input
              type="email"
              name="email"
              value={loginData.email}
              onChange={handleChange}
              className={`login-mobile-input ${errors.email ? "login-mobile-has-error" : ""}`}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              autoComplete="username"
            />
            {errors.email && <span className="login-mobile-field-error">{errors.email}</span>}
          </label>

          <label className="login-mobile-label">
            Password
            <div className="login-mobile-password-row">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={loginData.password}
                onChange={handleChange}
                className={`login-mobile-input ${
                  errors.password ? "login-mobile-has-error" : ""
                }`}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-mobile-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <span className="login-mobile-field-error">{errors.password}</span>
            )}
          </label>

          <button type="submit" className="login-mobile-submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : didSucceed ? "Success ✓" : "Sign in"}
          </button>
        </form>

        <div className="login-mobile-actions">
          <button
            type="button"
            className="login-mobile-link-btn"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot password
          </button>
          <button
            type="button"
            className="login-mobile-link-btn"
            onClick={() => navigate("/register")}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
