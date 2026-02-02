// src/routes/AppRoutes.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import TeamsPage from '../pages/Teams';
import DashboardRoute from '../pages/DashboardRoute';
import PlayersPage from '../pages/Players';
import ComparePlayers from '../pages/Compare';
import TeamPlayers from '../pages/TeamPlayers';
import PlayerProfile from '../pages/PlayerProfile';
import PlayerStats from '../pages/PlayerStats';
import MatchStats from '../pages/MatchStats';
import UploadMatchReport from '../pages/UploadPDF';
import SeasonGrades from '../pages/AdminGrades';
import MatchesPage from '../pages/MachesPage';
import MatchPage from '../pages/MatchPage';
import ForgotPassword from '../pages/ForgotPassword';
import LeaderboardPage from '../pages/Leaderboard';
import LandingPage from '../pages/LandingPage';
import VerificationQueue from '../pages/VerificationQueue';
import ResponsiveRoute from './ResponsiveRoute';
import LandingPageMobile from '../pages/mobile/LandingPageMobile';
import LoginMobile from '../pages/mobile/LoginMobile';
import RegisterMobile from '../pages/mobile/RegisterMobile';
import ForgotPasswordMobile from '../pages/mobile/ForgotPasswordMobile';
import TeamsPageMobile from '../pages/mobile/TeamsPageMobile';
import PlayersPageMobile from '../pages/mobile/PlayersPageMobile';
import TeamPlayersMobile from '../pages/mobile/TeamPlayersMobile';
import PlayerProfileMobile from '../pages/mobile/PlayerProfileMobile';
import PlayerStatsMobile from '../pages/mobile/PlayerStatsMobile';
import MatchStatsMobile from '../pages/mobile/MatchStatsMobile';
import UploadPDFMobile from '../pages/mobile/UploadPDFMobile';
import AdminGradesMobile from '../pages/mobile/AdminGradesMobile';
import MatchesPageMobile from '../pages/mobile/MatchesPageMobile';
import MatchPageMobile from '../pages/mobile/MatchPageMobile';
import LeaderboardMobile from '../pages/mobile/LeaderboardMobile';
import VerificationQueueMobile from '../pages/mobile/VerificationQueueMobile';
import { useIsMobile } from '../hooks/useIsMobile';

const CompareDesktopOnly = () => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <Navigate to="/players" replace />;
  }
  return <ComparePlayers />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/landing" />} />

        <Route
          path="/landing"
          element={
            <ResponsiveRoute
              Desktop={LandingPage}
              Mobile={LandingPageMobile}
            />
          }
        />
        <Route
          path="/login"
          element={
            <ResponsiveRoute Desktop={LoginPage} Mobile={LoginMobile} />
          }
        />
        <Route
          path="/register"
          element={
            <ResponsiveRoute Desktop={RegisterPage} Mobile={RegisterMobile} />
          }
        />
        <Route
          path="/forgot-password"
          element={
            <ResponsiveRoute
              Desktop={ForgotPassword}
              Mobile={ForgotPasswordMobile}
            />
          }
        />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route
          path="/teams"
          element={
            <ResponsiveRoute
              Desktop={TeamsPage}
              Mobile={TeamsPageMobile}
            />
          }
        />
        <Route
          path="/players"
          element={
            <ResponsiveRoute
              Desktop={PlayersPage}
              Mobile={PlayersPageMobile}
            />
          }
        />
        <Route path="/compare" element={<CompareDesktopOnly />} />
        <Route
          path="/team-players"
          element={
            <ResponsiveRoute
              Desktop={TeamPlayers}
              Mobile={TeamPlayersMobile}
            />
          }
        />
        <Route
          path="/player-profile"
          element={
            <ResponsiveRoute
              Desktop={PlayerProfile}
              Mobile={PlayerProfileMobile}
            />
          }
        />
        <Route
          path="/match-stats"
          element={
            <ResponsiveRoute
              Desktop={MatchStats}
              Mobile={MatchStatsMobile}
            />
          }
        />
        <Route
          path="/player-stats"
          element={
            <ResponsiveRoute
              Desktop={PlayerStats}
              Mobile={PlayerStatsMobile}
            />
          }
        />
        <Route
          path="/upload-pdf"
          element={
            <ResponsiveRoute
              Desktop={UploadMatchReport}
              Mobile={UploadPDFMobile}
            />
          }
        />
        <Route
          path="/season-grades"
          element={
            <ResponsiveRoute
              Desktop={SeasonGrades}
              Mobile={AdminGradesMobile}
            />
          }
        />
        <Route
          path="/matches"
          element={
            <ResponsiveRoute
              Desktop={MatchesPage}
              Mobile={MatchesPageMobile}
            />
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ResponsiveRoute
              Desktop={LeaderboardPage}
              Mobile={LeaderboardMobile}
            />
          }
        />
        <Route
          path="/matches/:id"
          element={
            <ResponsiveRoute
              Desktop={MatchPage}
              Mobile={MatchPageMobile}
            />
          }
        />
        <Route
          path="/verification-queue"
          element={
            <ResponsiveRoute
              Desktop={VerificationQueue}
              Mobile={VerificationQueueMobile}
            />
          }
        />
        
        {/* Fallback route */}
        <Route path="*" element={<h2>Page Not Found</h2>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
