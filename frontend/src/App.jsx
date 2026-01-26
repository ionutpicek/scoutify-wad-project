// src/App.js
import React from 'react';
import AppRoutes from './routes/routes.jsx';
import LoginPage from './pages/Login.jsx';


const App = () => {
  return (
    <div className="app-shell">
      <AppRoutes />
    </div>
  );
};

export default App;
