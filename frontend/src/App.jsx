// src/App.js
import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import AppRoutes from './routes/routes.jsx';
import LoginPage from './pages/Login.jsx';


const App = () => {
  return (
    <div className="app-shell">
      <AppRoutes />
      <SpeedInsights />
    </div>
  );
};

export default App;
