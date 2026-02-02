import { useCallback, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export function useForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 380);
  }, []);

  const handleReset = useCallback(async () => {
    if (isSubmitting) return;

    setStatus({ type: null, message: "" });

    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ type: "error", message: "Please enter your email." });
      triggerShake();
      return;
    }

    setIsSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, trimmed);

      setStatus({
        type: "success",
        message: "Reset link sent. Check your inbox (and spam).",
      });

      setDidSucceed(true);
    } catch (err) {
      console.error("Reset error", err);
      let msg = "Something went wrong. Please try again.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      if (err.code === "auth/user-not-found") msg = "No account found with this email.";
      setStatus({ type: "error", message: msg });
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isSubmitting, triggerShake]);

  return {
    email,
    setEmail,
    focused,
    setFocused,
    status,
    isSubmitting,
    didSucceed,
    shake,
    handleReset,
  };
}
