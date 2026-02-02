import React from "react";
import { useNavigate } from "react-router-dom";
import { useRegisterForm } from "../../hooks/useRegisterForm";
import "./RegisterMobile.css";

export default function RegisterMobile() {
  const navigate = useNavigate();
  const {
    inputs,
    role,
    teamsList,
    showPassword,
    showConfirmPassword,
    errors,
    generalError,
    isSubmitting,
    shouldSelectTeam,
    showPopup,
    closePopup,
    selectPlayerRole,
    deselectPlayerRole,
    selectManagerRole,
    deselectManagerRole,
    handleChange,
    handleRegister,
    setShowPassword,
    setShowConfirmPassword,
  } = useRegisterForm(navigate);

  return (
    <div className="register-mobile-shell">
      <div className="register-mobile-card">
        <header className="register-mobile-header">
          <p className="register-mobile-title">Register</p>
          <p className="register-mobile-subtitle">Join Scoutify for faster scouting</p>
        </header>

        {generalError ? <div className="register-mobile-error">{generalError}</div> : null}

        <form
          className="register-mobile-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleRegister();
          }}
        >
          {[
            { name: "fullName", label: "Full name" },
            { name: "username", label: "Username" },
            { name: "email", label: "Email" },
          ].map(({ name, label }) => (
            <label key={name} className="register-mobile-label">
              {label}
              <input
                className="register-mobile-input"
                name={name}
                type={name === "email" ? "email" : "text"}
                value={inputs[name]}
                onChange={handleChange}
                autoComplete={name === "username" ? "username" : "name"}
              />
              {errors[name] ? (
                <span className="register-mobile-error">{errors[name]}</span>
              ) : null}
            </label>
          ))}

          <label className="register-mobile-label">
            Password
            <div className="login-mobile-password-row">
              <input
                className="register-mobile-input"
                name="password"
                type={showPassword ? "text" : "password"}
                value={inputs.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="login-mobile-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password ? (
              <span className="register-mobile-error">{errors.password}</span>
            ) : null}
          </label>

          <label className="register-mobile-label">
            Confirm password
            <div className="login-mobile-password-row">
              <input
                className="register-mobile-input"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={inputs.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="login-mobile-password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.confirmPassword ? (
              <span className="register-mobile-error">{errors.confirmPassword}</span>
            ) : null}
          </label>

          {shouldSelectTeam ? (
            <label className="register-mobile-label">
              Team
              <select
                className="register-mobile-select"
                name="teamName"
                value={inputs.teamName}
                onChange={handleChange}
              >
                <option value="">Select a team</option>
                {teamsList.map((team) => (
                  <option key={team.teamID || team.name} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
              {errors.teamName ? (
                <span className="register-mobile-error">{errors.teamName}</span>
              ) : null}
            </label>
          ) : (
            <div className="register-mobile-error">
              Select whether you’re registering as a player or manager to pick a team.
            </div>
          )}

          <div className="register-mobile-role-grid">
            <div className="register-mobile-role-row">
              <span className="register-mobile-role-label">Player?</span>
              <button
                type="button"
                className={`register-mobile-role-button ${role === "player" ? "active" : ""}`}
                onClick={selectPlayerRole}
              >
                Yes
              </button>
              <button
                type="button"
                className={`register-mobile-role-button ${role !== "player" ? "active" : ""}`}
                onClick={deselectPlayerRole}
              >
                No
              </button>
            </div>
            <div className="register-mobile-role-row">
              <span className="register-mobile-role-label">Manager?</span>
              <button
                type="button"
                className={`register-mobile-role-button ${role === "manager" ? "active" : ""}`}
                onClick={selectManagerRole}
              >
                Yes
              </button>
              <button
                type="button"
                className={`register-mobile-role-button ${role !== "manager" ? "active" : ""}`}
                onClick={deselectManagerRole}
              >
                No
              </button>
            </div>
          </div>

          <button type="submit" className="register-mobile-submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Submit"}
          </button>
        </form>

        <div className="register-mobile-page-footer">
          <button
            type="button"
            className="register-mobile-link-btn"
            onClick={() => navigate("/login")}
          >
            Back to login
          </button>
        </div>
      </div>

      {showPopup && (
        <div className="register-mobile-popup-backdrop">
          <div className="register-mobile-popup">
            <h2>Account Under Review</h2>
            <p>
              Thank you for registering! Your account is being verified. You’ll get an email once
              everything is ready.
            </p>
            <button type="button" onClick={closePopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
