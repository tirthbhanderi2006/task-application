import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Header from './components/layout/header';
import Footer from './components/layout/footer';
import TaskManager from './components/pages/TaskManager';
import Login from './components/pages/Login';
import Register from './components/pages/Register';
import NotFound from './components/layout/NotFound';

function Layout({ theme, toggleTheme, auth, setAuth, user }) {
  return (
    <div className="app-container">
      <Navbar theme={theme} toggleTheme={toggleTheme} auth={auth} setAuth={setAuth} user={user} />
      <Header />
      <main className="content-container">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const ProtectedRoute = ({ auth, children }) => {
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  const [auth, setAuth] = useState(() => {
    return !!localStorage.getItem('token');
  });

  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth) {
        try {
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data);
          } else {
            setAuth(false);
            localStorage.removeItem('token');
            setUser(null);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setUser(null);
      }
    };
    fetchUser();
  }, [auth]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout theme={theme} toggleTheme={toggleTheme} auth={auth} setAuth={setAuth} user={user} />}>
          <Route index element={
            <ProtectedRoute auth={auth}>
              <TaskManager setAuth={setAuth} />
            </ProtectedRoute>
          } />
          <Route path="login" element={<Login setAuth={setAuth} />} />
          <Route path="register" element={<Register setAuth={setAuth} />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

