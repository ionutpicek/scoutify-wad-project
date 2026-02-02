import { useCallback, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";

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
      const q = query(collection(db, "users"), where("email", "==", trimmed));
      const snap = await getDocs(q);

      if (snap.empty) {
        setStatus({ type: "error", message: "No account found with this email." });
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      await sendPasswordResetEmail(auth, trimmed);

      setStatus({
        type: "success",
        message: "Reset link sent. Check your inbox (and spam).",
      });

      setDidSucceed(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error("Reset error", err);
      let msg = "Something went wrong. Please try again.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      setStatus({ type: "error", message: msg });
      triggerShake();
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
