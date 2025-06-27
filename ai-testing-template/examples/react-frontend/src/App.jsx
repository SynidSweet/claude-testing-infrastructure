import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './components/Home';
import About from './components/About';
import UserList from './components/UserList';
import './App.css';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <nav className="navbar">
            <div className="nav-container">
              <Link to="/" className="nav-brand">
                Testing Template Demo
              </Link>
              <div className="nav-links">
                <Link to="/" className="nav-link">Home</Link>
                <Link to="/about" className="nav-link">About</Link>
                <Link to="/users" className="nav-link">Users</Link>
              </div>
            </div>
          </nav>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/users" element={<UserList />} />
            </Routes>
          </main>

          <footer className="footer">
            <p>&copy; 2024 Testing Template Demo. Built with comprehensive testing.</p>
          </footer>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;