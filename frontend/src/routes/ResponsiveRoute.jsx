/* eslint-disable no-unused-vars */
import React from "react";
import { useIsMobile } from "../hooks/useIsMobile";

export default function ResponsiveRoute({ Desktop, Mobile }) {
  const isMobile = useIsMobile();
  return isMobile ? <Mobile /> : <Desktop />;
}