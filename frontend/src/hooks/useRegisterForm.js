import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import { getTeams } from "../api/teams.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { findPlayerByNameAndTeam } from "../services/playerServices.jsx";
import { registerUser } from "../api/users.js";

export function useRegisterForm(navigate) {
  const [inputs, setInputs] = useState({
    fullName: "",
    username: "",
    teamName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [role, setRole] = useState("");
  const [teamsList, setTeamsList] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsData = await getTeams();
        setTeamsList(teamsData);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
    fetchTeams();
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      return { ...prev, [name]: "" };
    });
    if (generalError) setGeneralError("");
  }, [generalError]);

  const shouldSelectTeam = role === "manager" || role === "player";

  const validate = useCallback(() => {
    const next = {};
    let ok = true;
    const required = ["fullName", "username", "email", "password", "confirmPassword"];
    if (shouldSelectTeam) required.push("teamName");

    required.forEach((field) => {
      if (!String(inputs[field] || "").trim()) {
        next[field] = "Required.";
        ok = false;
      }
    });

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
  }, [inputs, role, shouldSelectTeam, triggerShake]);

  const resetTeamName = useCallback(() => {
    setInputs((prev) => ({ ...prev, teamName: "" }));
  }, []);

  const selectPlayerRole = useCallback(() => {
    setGeneralError("");
    resetTeamName();
    setRole("player");
  }, [resetTeamName]);

  const deselectPlayerRole = useCallback(() => {
    if (role === "player") {
      setGeneralError("");
      resetTeamName();
      setRole("");
    }
  }, [role, resetTeamName]);

  const selectManagerRole = useCallback(() => {
    setGeneralError("");
    resetTeamName();
    setRole("manager");
  }, [resetTeamName]);

  const deselectManagerRole = useCallback(() => {
    if (role === "manager") {
      setGeneralError("");
      resetTeamName();
      setRole("");
    }
  }, [role, resetTeamName]);

  const handleRegister = useCallback(async () => {
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
      const wantsTeam = shouldSelectTeam;
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

      await registerUser({
        uid: user.uid,
        fullName: inputs.fullName,
        username: inputs.username,
        teamName: teamNameToSave,
        email: inputs.email,
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
  }, [inputs, role, shouldSelectTeam, triggerShake, isSubmitting]);

  const closePopup = useCallback(() => {
    setShowPopup(false);
    navigate("/login");
  }, [navigate]);

  return {
    inputs,
    role,
    teamsList,
    showPassword,
    showConfirmPassword,
    focused,
    errors,
    generalError,
    isSubmitting,
    didSucceed,
    shake,
    showPopup,
    shouldSelectTeam,
    setShowPassword,
    setShowConfirmPassword,
    setFocused,
    handleChange,
    handleRegister,
    selectPlayerRole,
    deselectPlayerRole,
    selectManagerRole,
    deselectManagerRole,
    resetTeamName,
    closePopup,
  };
}
