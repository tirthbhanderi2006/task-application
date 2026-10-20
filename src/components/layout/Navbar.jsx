import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const SunIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="theme-icon"
  >
    <circle cx="12" cy="12" r="4"></circle>
    <path d="M12 2v2"></path>
    <path d="M12 20v2"></path>
    <path d="m4.93 4.93 1.41 1.41"></path>
    <path d="m17.66 17.66 1.41 1.41"></path>
    <path d="M2 12h2"></path>
    <path d="M20 12h2"></path>
    <path d="m6.34 17.66-1.41 1.41"></path>
    <path d="m19.07 4.93-1.41 1.41"></path>
  </svg>
);

const MoonIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="theme-icon"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
  </svg>
);

export default function Navbar({ theme, toggleTheme, auth, setAuth, user }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuth(false);
    navigate('/login');
  };

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <NavLink to="/" className="logo">
          Task Manager
        </NavLink>
        <div className="nav-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {auth ? (
            <>
              {user && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</span>}
              <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'inherit', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Login</NavLink>
              <NavLink to="/register" style={{ color: 'inherit', textDecoration: 'none' }}>Register</NavLink>
            </>
          )}
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            aria-label="Toggle dark/light mode"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </nav>
  );
}
