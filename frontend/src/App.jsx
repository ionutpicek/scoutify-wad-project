// src/App.js
import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import AppRoutes from './routes/routes.jsx';
import LoginPage from './pages/Login.jsx';


const App = () => {
  return (
    <div className="app-shell">
      <AppRoutes />
      <Analytics />
    </div>
  );
};

export default App;
