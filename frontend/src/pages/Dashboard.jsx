import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };
  
  const cardStyle = {
    flex: 1,
    backgroundColor: '#fff4e8ff',
    borderRadius: 16,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    padding: 30,
    width: '25vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  };

  const cardHoverStyle = {
    transform: 'translateY(-5px)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
  };

  const headerStyle = {
    width: '100%',
    backgroundColor: '#FF681F',
    color: 'white',
    height: '15vh',
    fontSize: 28,
    fontFamily: 'cursive',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#fff', width: '100vw' }}>
      {/* Header */}
      <header style={headerStyle}>
        <span style={{padding:'0 5vw'}}>⚽ Welcome to Scoutify</span>
        <button
          style={{
            backgroundColor: 'white',
            color: '#FF681F',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginRight: '5vw',
            justifyContent: 'center',
            alignContent: 'center',
          }}
          onClick={handleLogout}
          onMouseOver={(e) => (e.target.style.backgroundColor = '#fff2e8')}
          onMouseOut={(e) => (e.target.style.backgroundColor = 'white')}
          
        >
          Logout
        </button>
      </header>

      {/* Card Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: 40,
          padding: '10vh 5vw',
        }}
      >
        {[
          { title: 'Teams', desc: 'Manage and view all your teams.', onclick: () => navigate('/teams') },
          { title: 'Players', desc: 'Explore player stats and profiles.', onclick: () => navigate('/players') },
          { title: 'Compare', desc: 'View the stats and compare players', onclick: () => navigate('/compare') },
        ].map((card) => (
          <div
            key={card.title}
            onClick={card.onclick}
            style={cardStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
          >
            <h2 style={{ color: '#FF681F', marginBottom: 10 }}>{card.title}</h2>
            <p style={{ color: '#333', textAlign: 'center' }}>{card.desc}</p>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: 40,
          padding: '0vh 5vw',
        }}
      >
        {[
          { title: 'Working', desc: 'Make sure that you take' },
          { title: 'On', desc: 'advantage of these features' },
          { title: 'These', desc: 'while we are working on the next ones' },
        ].map((card) => (
          <div
            key={card.title}
            style={cardStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
          >
            <h2 style={{ color: '#FF681F', marginBottom: 10 }}>{card.title}</h2>
            <p style={{ color: '#333', textAlign: 'center' }}>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
