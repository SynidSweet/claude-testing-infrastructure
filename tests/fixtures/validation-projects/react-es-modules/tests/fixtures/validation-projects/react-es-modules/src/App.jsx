import { useState, useEffect } from 'react';
import { Calculator } from './utils/calculator.js';
import { fetchUserData, validateEmail } from './services/api.js';
import Counter from './components/Counter.jsx';
import UserProfile from './components/UserProfile.jsx';

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
      alert('Email is valid\!');
    } else {
      alert('Invalid email format');
    }
  };

  const handleCalculation = () => {
    const result = calculator.add(10, 5);
    alert(`Calculation result: ${result}`);
  };

  if (loading) {
    return <div className="loading">Loading user data...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={loadUserData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
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
          <form onSubmit={handleEmailSubmit}>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
            />
            <button type="submit">Validate Email</button>
          </form>
        </section>

        <section className="calculator-section">
          <h2>Calculator Demo</h2>
          <button onClick={handleCalculation}>Calculate 10 + 5</button>
        </section>
      </main>
    </div>
  );
}
EOF < /dev/null