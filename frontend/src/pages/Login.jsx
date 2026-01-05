import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Photo from '../assets/ScoutifyPromo.png';
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, getDocLogged as getDoc } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const ORANGE = '#FF681F';
const ORANGE_HOVER = '#FF4500';
const SOFT_ORANGE = '#FFF2E8';
const ERROR = '#EF4444';

const LoginPage = () => {
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // UX state
  const [focused, setFocused] = useState(null); // "email" | "password" | null
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
  };

  const setFieldError = (field, message) => {
    setErrors(prev => ({ ...prev, [field]: message, general: '' }));
  };

  const setGeneralError = (message) => {
    setErrors(prev => ({ ...prev, general: message }));
  };

  const clearErrors = () => setErrors({ email: '', password: '', general: '' });

  const validate = () => {
    let ok = true;
    const next = { email: '', password: '', general: '' };

    if (!loginData.email.trim()) {
      next.email = "Email is required.";
      ok = false;
    } else if (!/^\S+@\S+\.\S+$/.test(loginData.email.trim())) {
      next.email = "Enter a valid email address.";
      ok = false;
    }

    if (!loginData.password) {
      next.password = "Password is required.";
      ok = false;
    } else if (loginData.password.length < 6) {
      next.password = "Password must be at least 6 characters.";
      ok = false;
    }

    setErrors(next);
    if (!ok) triggerShake();
    return ok;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));

    // clear per-field error as user types
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (errors.general) setErrors(prev => ({ ...prev, general: '' }));
  };

  const handleLogin = async () => {
    if (isSubmitting) return;

    clearErrors();
    setDidSucceed(false);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        loginData.email.trim(),
        loginData.password
      );

      const user = userCredential.user;

      // Check email verification
      if (!user.emailVerified) {
        setGeneralError("Please verify your email before logging in. Check your inbox.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      // Load Firestore user
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        setGeneralError("User record not found in Firestore.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      const userData = userDoc.data();

      // If verified in Firebase but Firestore false, update it
      if (!userData.verified) {
        await updateDoc(doc(db, "users", user.uid), { verified: true });
      }

      // Manager rule
      if (userData.role === "manager" && !userData.verified) {
        setGeneralError("Your manager account is under verification.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      // Success transition
      setDidSucceed(true);

      // tiny delay so the user sees success state (feels premium)
      window.setTimeout(() => {
        navigate("/dashboard", {
          state: {
            userTeam: userData.teamName,
            role: userData.role,
            username: userData.username,
          },
        });
      }, 450);

    } catch (error) {
      console.error("Login error:", error.code, error.message);

      // Map Firebase errors to friendly UI
      if (error.code === "auth/user-not-found") {
        setFieldError("email", "No user found with this email.");
      } else if (error.code === "auth/wrong-password") {
        setFieldError("password", "Incorrect password.");
      } else if (error.code === "auth/invalid-credential") {
        setGeneralError("Invalid email or password.");
      } else {
        setGeneralError("Login failed. Please try again.");
      }

      triggerShake();
      setIsSubmitting(false);
    }
  };

  const styles = useMemo(() => {
    const baseInput = {
      padding: '12px 15px',
      width: 280,
      borderRadius: 10,
      border: `1px solid ${ORANGE}`,
      backgroundColor: '#fffffd',
      boxShadow: '0 2px 6px rgba(0,0,0,0.16)',
      fontSize: 16,
      outline: 'none',
      color: '#000',
      transition: 'transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease',
    };

    const focusInput = {
      borderColor: ORANGE_HOVER,
      boxShadow: `0 0 0 4px rgba(255,104,31,0.22)`,
      transform: 'translateY(-1px)',
    };

    const errorInput = {
      borderColor: ERROR,
      boxShadow: `0 0 0 4px rgba(239,68,68,0.18)`,
    };

    const fieldErrorText = {
      width: 280,
      fontSize: 12,
      color: ERROR,
      fontWeight: 700,
      marginTop: -8,
      textAlign: "left",
    };

    const generalErrorBox = {
      width: 280,
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: "#991B1B",
      borderRadius: 12,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 700,
      display: errors.general ? "block" : "none",
    };

    const submitBtn = {
      marginTop: 10,
      backgroundColor: didSucceed ? "#16A34A" : ORANGE,
      color: 'white',
      border: 'none',
      cursor: isSubmitting ? "not-allowed" : "pointer",
      padding: '12px 20px',
      width: "100%",
      borderRadius: 10,
      fontSize: 16,
      fontWeight: 900,
      transition: 'transform 120ms ease, background 200ms ease, box-shadow 200ms ease',
      boxShadow: "0 10px 20px rgba(0,0,0,0.10)",
      opacity: isSubmitting ? 0.9 : 1,
    };

    return {
      baseInput,
      focusInput,
      errorInput,
      fieldErrorText,
      generalErrorBox,
      submitBtn,
    };
  }, [errors.general, isSubmitting, didSucceed]);

  const inputStyleFor = (field) => {
    const isFocused = focused === field;
    const hasError = Boolean(errors[field]);
    return {
      ...styles.baseInput,
      ...(isFocused ? styles.focusInput : {}),
      ...(hasError ? styles.errorInput : {}),
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw' }}>
      {/* Left side: Login form */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p style={{ fontSize: 54, margin: 0, color: ORANGE, fontFamily: 'cursive' }}>
          Login
        </p>

        <div
          style={{
            marginTop: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 15,
            width: 280,
            transform: shake ? "translateX(0)" : "translateX(0)",
            animation: shake ? "shake 380ms ease" : "none",
          }}
        >
          {/* Inline keyframes (since you're using inline styles) */}
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

          {/* General error */}
          <div style={styles.generalErrorBox}>
            ⚠️ {errors.general}
          </div>

        <div style={{display:"flex", flexDirection:"column", gap: 15, width: "100%"}}>
          <div style={{ position: "relative", width: "100%"}}>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={handleChange}
              style={{ ...inputStyleFor("email"), width: "100%" }}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              aria-invalid={Boolean(errors.email)}
            />
          </div>
          {errors.email ? <div style={styles.fieldErrorText}>{errors.email}</div> : null}

          <div style={{ position: "relative", width: "90%"}}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={loginData.password}
              onChange={handleChange}
              style={{ ...inputStyleFor("password"), width: "100%", paddingRight: 44 }}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              aria-invalid={Boolean(errors.password)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{
                position: "absolute",
                top: "50%",
                left:"105%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 16,
                padding: 6,
                borderRadius: 8,
                color: "#6B7280",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF2E8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

          {errors.password ? <div style={styles.fieldErrorText}>{errors.password}</div> : null}

          {/* Keep your “Forgot • Register” row exactly conceptually the same */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              marginTop: 10,
              fontSize: 13,
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: ORANGE,
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Forgot password
            </button>

            <span style={{ color: "#9CA3AF" }}>•</span>

            <div style={{ color: "#6B7280" }}>
              <button
                type="button"
                onClick={() => navigate("/register")}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: ORANGE,
                  fontWeight: 800,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Register here
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            style={styles.submitBtn}
            disabled={isSubmitting}
            onMouseOver={(e) => {
              if (!isSubmitting && !didSucceed) {
                e.currentTarget.style.backgroundColor = ORANGE_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = didSucceed ? "#16A34A" : ORANGE;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {isSubmitting ? "Signing in…" : didSucceed ? "Success ✅" : "Submit"}
          </button>
        </div>
      </div>

      {/* Right side: image */}
      <div
        style={{
          flex: 1,
          backgroundColor: ORANGE,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <img src={Photo} alt="Scoutify Logo" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default LoginPage;
