import React, { useMemo, useState, useEffect } from "react";
import Photo from "../assets/ScoutifyBackground.png";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, collection } from "firebase/firestore";
import { getDocsLogged as getDocs } from "../firebase";
import { findPlayerByNameAndTeam } from "../services/playerServices.jsx";

const ORANGE = "#FF681F";
const ORANGE_HOVER = "#FF4500";
const SOFT_ORANGE = "#FFF2E8";
const ERROR = "#EF4444";
const SUCCESS = "#16A34A";

const Register = () => {
  const navigate = useNavigate();

  const [inputs, setInputs] = useState({
    fullName: "",
    username: "",
    teamName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // role: "manager" or "other"
  const [role, setRole] = useState("");

  const [teamsList, setTeamsList] = useState([]);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 380);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({ ...prev, [name]: value }));

    // clear field error when user edits
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (generalError) setGeneralError("");
  };

  // Load teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsSnapshot = await getDocs(collection(db, "team"));
        const teamsData = teamsSnapshot.docs.map((d) => d.data());
        setTeamsList(teamsData);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
    fetchTeams();
  }, []);

  const validate = () => {
    const next = {};
    let ok = true;

    const required = ["fullName", "username", "email", "password", "confirmPassword"];
    if (role === "manager" || role === "player") required.push("teamName");

    for (const f of required) {
      if (!String(inputs[f] || "").trim()) {
        next[f] = "Required.";
        ok = false;
      }
    }

    if (inputs.email && !/^\S+@\S+\.\S+$/.test(inputs.email.trim())) {
      next.email = "Enter a valid email.";
      ok = false;
    }

    if (inputs.password && inputs.password.length < 6) {
      next.password = "Min 6 characters.";
      ok = false;
    }

    if (inputs.password !== inputs.confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
      ok = false;
    }

    if (!role) {
      setGeneralError("Please select whether you're registering as a player or manager.");
      ok = false;
    }

    setErrors(next);
    if (!ok) triggerShake();
    return ok;
  };

  const handleRegister = async () => {
    if (isSubmitting) return;

    setErrors({});
    setGeneralError("");
    setDidSucceed(false);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        inputs.email.trim(),
        inputs.password
      );

      const user = userCredential.user;

      // Send email verification link
      // Save registration info in Firestore
      const wantsTeam = role === "manager" || role === "player";
      const teamNameToSave = wantsTeam && inputs.teamName ? inputs.teamName : "Select a Team";
      const roleValue = role === "manager" ? "manager" : "player";

      let matchedPlayer = null;
      if (role === "player") {
        try {
          matchedPlayer = await findPlayerByNameAndTeam({
            fullName: inputs.fullName.trim(),
            teamName: inputs.teamName,
          });
        } catch (matchError) {
          console.error("Player auto-match failed:", matchError);
        }
      }

      await setDoc(doc(db, "users", user.uid), {
        fullName: inputs.fullName,
        username: inputs.username,
        teamName: teamNameToSave,
        email: inputs.email,
        createdAt: new Date(),
        role: roleValue,
        verifyUser: false,
        verifyEmail: false,
        playerDocId: matchedPlayer?.docId ?? null,
        playerID: matchedPlayer?.playerID ?? null,
        matchedPlayerName: matchedPlayer?.name ?? null,
      });

      try {
        await sendEmailVerification(user);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }

      setDidSucceed(true);

      // show popup after a short success feel
      setTimeout(() => {
        setShowPopup(true);
      }, 350);
    } catch (error) {
      console.error("Registration error:", error);

      let msg = "Registration failed. Please try again.";
      if (error.code === "auth/email-already-in-use") msg = "Email already in use.";
      if (error.code === "auth/weak-password") msg = "Password is too weak.";
      if (error.code === "auth/invalid-email") msg = "Invalid email address.";

      setGeneralError(msg);
      triggerShake();
      setIsSubmitting(false);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    navigate("/login");
  };

  const styles = useMemo(() => {
    const baseInput = {
      padding: "12px 15px",
      width: 280,
      borderRadius: 10,
      border: `1px solid ${ORANGE}`,
      backgroundColor: "#fffffa",
      boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
      fontSize: 16,
      outline: "none",
      color: "#000",
      transition: "transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease",
    };

    const focusInput = {
      borderColor: ORANGE_HOVER,
      boxShadow: "0 0 0 4px rgba(255,104,31,0.22)",
      transform: "translateY(-1px)",
    };

    const errorInput = {
      borderColor: ERROR,
      boxShadow: "0 0 0 4px rgba(239,68,68,0.18)",
    };

    const fieldErrorText = {
      width: 280,
      fontSize: 12,
      color: ERROR,
      fontWeight: 800,
      marginTop: -10,
      textAlign: "left",
    };

    const generalErrorBox = {
      width: 340,
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: "#991B1B",
      borderRadius: 12,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 800,
      display: generalError ? "block" : "none",
      textAlign: "center",
    };

    const submitBtn = {
      marginTop: 10,
      padding: "12px 25px",
      width: 280,
      backgroundColor: didSucceed ? SUCCESS : ORANGE,
      color: "white",
      border: "none",
      borderRadius: 10,
      cursor: isSubmitting ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: 16,
      transition: "transform 120ms ease, background 200ms ease, box-shadow 200ms ease",
      boxShadow: "0 10px 20px rgba(0,0,0,0.10)",
      opacity: isSubmitting ? 0.92 : 1,
    };

    const managerLabel = {
      display: "flex",
      flex: 10,
      borderRadius: 10,
      border: "1px solid #E5E7EB",
      backgroundColor: "#fff",
      color: "#111",
      fontWeight: 900,
      fontSize: 14,
      justifyContent: "center",
      alignItems: "center",
      padding: "0 10px",
    };

    const roleBtn = (active) => ({
      display: "flex",
      flex: 2,
      borderRadius: 10,
      border: active ? `2px solid ${ORANGE}` : "1px solid #E5E7EB",
      backgroundColor: active ? SOFT_ORANGE : "#fff",
      color: "#111",
      cursor: "pointer",
      fontWeight: 900,
      transition: "all 0.2s ease",
      justifyContent: "center",
      alignItems: "center",
    });

    return {
      baseInput,
      focusInput,
      errorInput,
      fieldErrorText,
      generalErrorBox,
      submitBtn,
      managerLabel,
      roleBtn,
    };
  }, [generalError, isSubmitting, didSucceed]);

  const inputStyleFor = (fieldName) => ({
    ...styles.baseInput,
    ...(focused === fieldName ? styles.focusInput : {}),
    ...(errors[fieldName] ? styles.errorInput : {}),
  });

  const shouldSelectTeam = role === "manager" || role === "player";

  return (
    <div
      style={{
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        display: "flex",
        backgroundImage: `url(${Photo})`,
        width: "100vw",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          border: "1px solid rgba(0,0,0,0.2)",
          borderRadius: 20,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          height: "90vh",
          boxShadow: "0px 10px 25px rgba(0, 0, 0, 0.2)",
          width: "49vw",
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

        <p
          style={{
            fontSize: 48,
            color: ORANGE,
            fontFamily: "cursive",
            marginBottom: 24,
          }}
        >
          Register ✍️
        </p>

        {/* general error box */}
        <div style={styles.generalErrorBox}>⚠️ {generalError}</div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 15,
            color: "#000",
          }}
        >
          {/* Full name, username, email */}
        {[
        { name: "fullName", placeholder: "Full Name", type: "text" },
        { name: "username", placeholder: "Username", type: "text" },
        { name: "email", placeholder: "Email", type: "email" },
        ].map((field) => (
        <React.Fragment key={field.name}>
            <input
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            value={inputs[field.name]}
            onChange={handleChange}
            style={inputStyleFor(field.name)}
            onFocus={() => setFocused(field.name)}
            onBlur={() => setFocused(null)}
            />
            {errors[field.name] && (
            <div style={styles.fieldErrorText}>{errors[field.name]}</div>
            )}
        </React.Fragment>
        ))}

        {/* Password */}
        <div style={{ position: "relative", width: "100%" }}>
        <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={inputs.password}
            onChange={handleChange}
            style={{ ...inputStyleFor("password"), paddingRight: "4%" }}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
        />
        <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 16,
            padding: 6,
            borderRadius: 8,
            color: "#6B7280",
            }}
            onMouseDown={(e) => e.preventDefault()}
            title={showPassword ? "Hide password" : "Show password"}
        >
            {showPassword ? "🙈" : "👁️"}
        </button>
        </div>
        {errors.password && (
        <div style={styles.fieldErrorText}>{errors.password}</div>
        )}

        {/* Confirm Password */}
        <div style={{ position: "relative", width: "100%" }}>
        <input
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={inputs.confirmPassword}
            onChange={handleChange}
            style={{ ...inputStyleFor("confirmPassword"), paddingRight: "4%" }}
            onFocus={() => setFocused("confirmPassword")}
            onBlur={() => setFocused(null)}
        />
        <button
            type="button"
            onClick={() => setShowConfirmPassword((s) => !s)}
            style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 16,
            padding: 6,
            borderRadius: 8,
            color: "#6B7280",
            }}
            onMouseDown={(e) => e.preventDefault()}
            title={showConfirmPassword ? "Hide password" : "Show password"}
        >
            {showConfirmPassword ? "🙈" : "👁️"}
        </button>
        </div>
        {errors.confirmPassword && (
        <div style={styles.fieldErrorText}>{errors.confirmPassword}</div>
        )}


        {/* Team selection */}
        {shouldSelectTeam ? (
          <>
            <select
              name="teamName"
              value={inputs.teamName}
              onChange={handleChange}
              style={{
                ...inputStyleFor("teamName"),
                width: "100%",
                cursor: "pointer",
                appearance: "none",
              }}
              onFocus={() => setFocused("teamName")}
              onBlur={() => setFocused(null)}
            >
              <option value="">Select a Team</option>
              {teamsList.map((team) => (
                <option key={team.teamID || team.name} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
            {errors.teamName ? <div style={styles.fieldErrorText}>{errors.teamName}</div> : null}
          </>
        ) : (
          <input
            name="teamName"
            type="text"
            placeholder="Team Name"
            value={"Team Name"}
            style={{ ...styles.baseInput, backgroundColor: "#f3f4f6", cursor: "not-allowed" }}
            disabled
          />
        )}

        {/* Player toggle */}
        <div style={{ display: "flex", flexDirection: "row", width: "100%", height: 46, justifyContent: "space-between" }}>
          <div style={styles.managerLabel}>Are you a player?</div>

          <button
            type="button"
            onClick={() => {
              setRole("player");
              setGeneralError("");
            }}
            style={styles.roleBtn(role === "player")}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => {
              if (role === "player") setRole("");
              setInputs((prev) => ({ ...prev, teamName: "" }));
              setGeneralError("");
            }}
            style={styles.roleBtn(role === "" || role === "other")}
          >
            No
          </button>
        </div>

        {/* Manager toggle */}
        <div style={{ display: "flex", flexDirection: "row", width: "100%", height: 46, justifyContent: "space-between" }}>
          <div style={styles.managerLabel}>Are you a manager?</div>

          <button
            type="button"
            onClick={() => {
              setRole("manager");
              setGeneralError("");
            }}
            style={styles.roleBtn(role === "manager")}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => {
              if (role === "manager") setRole("");
              setInputs((prev) => ({ ...prev, teamName: "" }));
              setGeneralError("");
            }}
            style={styles.roleBtn(role === "" || role === "player")}
          >
            No
          </button>
        </div>

          <button
            style={styles.submitBtn}
            onClick={handleRegister}
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
            {isSubmitting ? "Creating account…" : didSucceed ? "Created ✅" : "Submit"}
          </button>
        </div>
      </div>

      {/* Popup */}
      {showPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              width: "60vw",
              height: "30vh",
              padding: "30px 50px",
              borderRadius: 15,
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ color: ORANGE, marginBottom: 10 }}>Account Under Verification</h2>
            <p style={{ color: "#333", fontSize: 16, padding: "0 10vw" }}>
              Thank you for registering! Your account is currently under review. You'll receive an email once you're ready
              to go!
            </p>
            <button
              onClick={closePopup}
              style={{
                marginTop: 20,
                backgroundColor: ORANGE,
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 20px",
                fontWeight: 900,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = ORANGE_HOVER)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = ORANGE)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
