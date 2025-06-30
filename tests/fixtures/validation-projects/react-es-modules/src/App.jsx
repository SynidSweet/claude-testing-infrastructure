import { useState, useEffect } from 'react';
import { Calculator } from './utils/calculator.js';
import { fetchUserData, validateEmail } from './services/api.js';
import Counter from './components/Counter.jsx';
import UserProfile from './components/UserProfile.jsx';

/**
 * Main App component demonstrating various React patterns for test generation
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [calculator] = useState(() => new Calculator());

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await fetchUserData();
      setUser(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (validateEmail(email)) {
      alert('Email is valid!');
    } else {
      alert('Invalid email format');
    }
  };

  const handleCalculation = () => {
    const result = calculator.add(10, 5);
    alert(`Calculation result: ${result}`);
  };

  if (loading) {
    return (
      <div className="loading" data-testid="loading-spinner">
        Loading user data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error" data-testid="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={loadUserData} data-testid="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app" data-testid="main-app">
      <header className="app-header">
        <h1>React ES Modules Test App</h1>
      </header>
      
      <main className="app-main">
        <section className="user-section">
          <h2>User Information</h2>
          {user && <UserProfile user={user} />}
        </section>

        <section className="counter-section">
          <h2>Counter Demo</h2>
          <Counter initialValue={0} />
        </section>

        <section className="email-section">
          <h2>Email Validation</h2>
          <form onSubmit={handleEmailSubmit} data-testid="email-form">
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
              data-testid="email-input"
            />
            <button type="submit" data-testid="email-submit">
              Validate Email
            </button>
          </form>
        </section>

        <section className="calculator-section">
          <h2>Calculator Demo</h2>
          <button onClick={handleCalculation} data-testid="calc-button">
            Calculate 10 + 5
          </button>
        </section>
      </main>
    </div>
  );
}

/**
 * Secondary component for testing export patterns
 */
export function AppHeader({ title, subtitle }) {
  return (
    <header className="app-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}

/**
 * Utility component for testing different prop types
 */
export function StatusBadge({ status, count, isActive = false }) {
  const className = `status-badge ${status} ${isActive ? 'active' : ''}`;
  
  return (
    <div className={className} data-testid="status-badge">
      <span className="status-text">{status}</span>
      {count && <span className="count">({count})</span>}
    </div>
  );
}