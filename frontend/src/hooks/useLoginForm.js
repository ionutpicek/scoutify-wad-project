import { useCallback, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { setCurrentUser } from "../services/sessionStorage.js";
import { findPlayerByNameAndTeam } from "../services/playerServices.jsx";
import { getUserByUid, updateUser } from "../api/users.js";

export function useLoginForm(navigate) {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({ email: "", password: "", general: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
  }, []);

  const setFieldError = useCallback((field, message) => {
    setErrors((prev) => ({ ...prev, [field]: message, general: "" }));
  }, []);

  const setGeneralError = useCallback((message) => {
    setErrors((prev) => ({ ...prev, general: message }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({ email: "", password: "", general: "" });
  }, []);

  const validate = useCallback(() => {
    let ok = true;
    const next = { email: "", password: "", general: "" };

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
  }, [loginData, triggerShake]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));

    setErrors((prev) => {
      let next = prev;
      if (prev[name]) {
        next = { ...next, [name]: "" };
      }
      if (prev.general) {
        next = { ...next, general: "" };
      }
      return next;
    });
  }, []);

  const handleLogin = useCallback(async () => {
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

      if (!user.emailVerified) {
        setGeneralError("Please verify your email before logging in. Check your inbox.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      let userData = null;
      try {
        const userRes = await getUserByUid(user.uid);
        userData = userRes?.user || null;
      } catch (err) {
        userData = null;
      }

      if (!userData) {
        setGeneralError("User record not found.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      if (!userData.verifyUser) {
        setGeneralError("Your account is pending approval from an administrator.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      if (!userData.verifyEmail && user.emailVerified) {
        try {
          await updateUser(user.uid, { verifyEmail: true });
          userData.verifyEmail = true;
        } catch (err) {
          console.error("Failed to update verifyEmail:", err);
        }
      }

      if (!userData.verifyEmail) {
        setGeneralError("Please verify your email; the confirmation link was sent to you.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      if (userData.role === "player" && !userData.playerDocId) {
        try {
          const resolvedPlayer = await findPlayerByNameAndTeam({
            fullName: (userData.fullName || "").trim(),
            teamName: userData.teamName,
          });
          if (resolvedPlayer) {
            await updateUser(user.uid, {
              playerDocId: resolvedPlayer.docId,
              playerID: resolvedPlayer.playerID ?? null,
              matchedPlayerName: resolvedPlayer.name ?? null
            });
            userData.playerDocId = resolvedPlayer.docId;
            userData.playerID = resolvedPlayer.playerID;
          } else {
            console.warn("No player matched for", userData.username);
          }
        } catch (matchError) {
          console.error("Player auto-link failed:", matchError);
        }
      }

      setCurrentUser({
        role: userData.role,
        username: userData.username,
        teamName: userData.teamName,
        email: userData.email,
        playerDocId: userData.playerDocId || null,
        playerID: userData.playerID || null,
      });

      setDidSucceed(true);

      window.setTimeout(() => {
        navigate("/dashboard", {
          state: {
            userTeam: userData.teamName,
            role: userData.role,
            username: userData.username,
            playerDocId: userData.playerDocId || null,
            playerID: userData.playerID || null,
          },
        });
      }, 450);
    } catch (error) {
      console.error("Login error:", error.code, error.message);
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
  }, [
    clearErrors,
    isSubmitting,
    loginData,
    navigate,
    setFieldError,
    setGeneralError,
    triggerShake,
    validate,
  ]);

  return {
    loginData,
    errors,
    isSubmitting,
    didSucceed,
    shake,
    showPassword,
    focused,
    setFocused,
    setShowPassword,
    handleChange,
    handleLogin,
  };
}
