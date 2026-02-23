import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import Spinner from "../components/Spinner.jsx";
import DashboardRoute from "../pages/DashboardRoute.jsx";

export default function DashboardAccessGate() {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, firebaseUser => {
      if (cancelled) return;

      if (!firebaseUser) {
        setIsAuthenticated(false);
        setChecking(false);
        return;
      }

      setIsAuthenticated(true);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (checking) {
    return <Spinner message="Checking access..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardRoute />;
}
