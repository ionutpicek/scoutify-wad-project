// src/routes/AppRoutes.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import TeamsPage from '../pages/Teams';
import Dashboard from '../pages/Dashboard';
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

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/compare" element={<ComparePlayers />} />
        <Route path="/team-players" element={<TeamPlayers />} />
        <Route path="/player-profile" element={<PlayerProfile />} />
        <Route path="/match-stats" element={<MatchStats />} />
        <Route path="/player-stats" element={<PlayerStats />} />
        <Route path='/upload-pdf' element={<UploadMatchReport/>}/>
        <Route path='/season-grades' element={<SeasonGrades/>}/>
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/matches/:id" element={<MatchPage />} />
        
        {/* Fallback route */}
        <Route path="*" element={<h2>Page Not Found</h2>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
