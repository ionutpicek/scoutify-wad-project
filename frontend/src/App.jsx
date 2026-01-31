// src/App.js
import React from 'react';
import AppRoutes from './routes/routes.jsx';
import LoginPage from './pages/Login.jsx';
import { Analytics } from '@vercel/analytics/react';


const App = () => {
  return (
    <div className="app-shell">
      <AppRoutes />
      <Analytics />
    </div>
  );
};

export default App;
