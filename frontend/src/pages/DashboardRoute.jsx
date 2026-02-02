import React from "react";
import Dashboard from "./Dashboard";
import DashboardMobile from "./mobile/DashboardMobile";
import { useIsMobile } from "../hooks/useIsMobile";

/** Desktop entry for the dashboard until a dedicated desktop component exists. */
function DashboardDesktop() {
  return <Dashboard />;
}

export default function DashboardRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <DashboardMobile /> : <DashboardDesktop />;
}
