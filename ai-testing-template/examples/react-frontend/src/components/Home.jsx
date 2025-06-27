import React from 'react';

function Home() {
  return (
    <div className="home" data-testid="home-page">
      <h1>Welcome to the Testing Template Demo</h1>
      
      <section className="hero">
        <p className="hero-text">
          This is an example React application that demonstrates comprehensive testing 
          patterns using the AI Testing Template.
        </p>
      </section>

      <section className="features">
        <h2>Testing Features Demonstrated</h2>
        <div className="feature-grid">
          <div className="feature-card" data-testid="unit-testing-card">
            <h3>Unit Testing</h3>
            <p>Component isolation testing with React Testing Library</p>
          </div>
          
          <div className="feature-card" data-testid="integration-testing-card">
            <h3>Integration Testing</h3>
            <p>Testing component interactions and data flow</p>
          </div>
          
          <div className="feature-card" data-testid="e2e-testing-card">
            <h3>E2E Testing</h3>
            <p>Full user workflow testing with Playwright</p>
          </div>
          
          <div className="feature-card" data-testid="accessibility-card">
            <h3>Accessibility</h3>
            <p>Ensuring components are accessible to all users</p>
          </div>
        </div>
      </section>

      <section className="getting-started">
        <h2>Getting Started</h2>
        <div className="steps">
          <div className="step">
            <span className="step-number">1</span>
            <p>Clone the AI Testing Template repository</p>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <p>Run the initialization script in your project</p>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <p>Start writing tests before code (TDD approach)</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;