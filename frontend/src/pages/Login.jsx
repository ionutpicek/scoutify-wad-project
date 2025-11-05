import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Photo from '../assets/ScoutifyPromo.png';

const LoginPage = () => {
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = () => {
    // For now, just log the values (replace this with real login logic later)
    console.log('Logging in with:', loginData);

    // Example redirect to another page after login
    navigate('/dashboard');
  };

  const inputStyle = {
    padding: '12px 15px',
    width: 280,
    borderRadius: 8,
    border: '1px solid #FF681F',
    backgroundColor: '#fff8f0',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    fontSize: 16,
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
    color: '#000000',
  };

  const inputFocusStyle = {
    borderColor: '#FF4500',
    boxShadow: '0 0 8px rgba(255,104,31,0.5)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw' }}>
      
      {/* Left side: Login form */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            fontSize: 54,
            margin: 0,
            color: '#FF681F',
            fontFamily: 'cursive',
          }}
        >
          Login
        </p>

        <div
          style={{
            marginTop: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 15,
          }}
        >
          <input
            name="username"
            type="text"
            placeholder="Username"
            value={loginData.username}
            onChange={handleChange}
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => Object.assign(e.target.style, inputStyle)}
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={loginData.password}
            onChange={handleChange}
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => Object.assign(e.target.style, inputStyle)}
          />

          <p
            style={{
              color: '#000000',
              fontSize: 14,
              fontFamily: 'cursive',
              marginBottom: 5,
              textAlign: 'center',
            }}
          >
            New user?{' '}
            <Link to="/register" style={{ color: '#FF681F', fontWeight: 'bold' }}>
              Register here
            </Link>
          </p>

          <button
            onClick={handleLogin}
            style={{
              marginTop: 10,
              backgroundColor: '#FF681F',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              padding: '12px 20px',
              width: 280,
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 'bold',
              transition: 'background 0.3s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#FF4500')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#FF681F')}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Right side: image */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#FF681F',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <img src={Photo} alt="Scoutify Logo" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default LoginPage;