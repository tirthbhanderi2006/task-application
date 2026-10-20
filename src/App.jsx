import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Header from './components/layout/header';
import Footer from './components/layout/footer';
import RouteLoadingFallback from './components/common/RouteLoadingFallback';

// Route-based code splitting using React.lazy()
const Projects = lazy(() => import('./components/pages/Projects'));
const AboutMe = lazy(() => import('./components/pages/AboutMe'));
const TaskManager = lazy(() => import('./components/pages/TaskManager'));
const ApiExplorer = lazy(() => import('./components/pages/ApiExplorer'));
const GitHubRepos = lazy(() => import('./components/pages/GitHubRepos'));
const Certificates = lazy(() => import('./components/pages/Certificates'));
const Contact = lazy(() => import('./components/pages/Contact'));
const NotFound = lazy(() => import('./components/layout/NotFound'));

function Layout({ theme, toggleTheme }) {
  return (
    <div className="app-container">
      <Navbar theme={theme} toggleTheme={toggleTheme} />
      <Header name="Tirth" branch="Artificial Intelligence & Machine Learning" />
      <main className="content-container">
        <Suspense fallback={<RouteLoadingFallback message="Loading page component..." />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

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
      <Suspense fallback={<RouteLoadingFallback message="Loading application..." />}>
        <Routes>
          <Route path="/" element={<Layout theme={theme} toggleTheme={toggleTheme} />}>
            <Route index element={<Projects />} />
            <Route path="about" element={<AboutMe />} />
            <Route path="tasks" element={<TaskManager />} />
            <Route path="api-explorer" element={<ApiExplorer />} />
            <Route path="github" element={<GitHubRepos />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

