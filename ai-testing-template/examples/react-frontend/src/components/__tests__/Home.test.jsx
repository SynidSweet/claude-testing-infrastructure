import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../Home';

// Test wrapper for router context
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Home Component', () => {
  it('renders the main heading', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    expect(screen.getByText('Welcome to the Testing Template Demo')).toBeInTheDocument();
  });

  it('displays the hero section with description', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    const heroText = screen.getByText(/This is an example React application/);
    expect(heroText).toBeInTheDocument();
  });

  it('shows all testing feature cards', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    // Check that all feature cards are present
    expect(screen.getByTestId('unit-testing-card')).toBeInTheDocument();
    expect(screen.getByTestId('integration-testing-card')).toBeInTheDocument();
    expect(screen.getByTestId('e2e-testing-card')).toBeInTheDocument();
    expect(screen.getByTestId('accessibility-card')).toBeInTheDocument();
  });

  it('displays the getting started section', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    
    // Check for the three steps
    expect(screen.getByText(/Clone the AI Testing Template/)).toBeInTheDocument();
    expect(screen.getByText(/Run the initialization script/)).toBeInTheDocument();
    expect(screen.getByText(/Start writing tests before code/)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    // Check main content structure
    const homeElement = screen.getByTestId('home-page');
    expect(homeElement).toBeInTheDocument();
    
    // Check heading hierarchy
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Welcome to the Testing Template Demo');
    
    const h2Elements = screen.getAllByRole('heading', { level: 2 });
    expect(h2Elements).toHaveLength(2); // "Testing Features Demonstrated" and "Getting Started"
  });

  it('renders feature cards with correct content', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    // Unit Testing card
    const unitCard = screen.getByTestId('unit-testing-card');
    expect(unitCard).toContainElement(screen.getByText('Unit Testing'));
    expect(unitCard).toContainElement(screen.getByText(/Component isolation testing/));
    
    // Integration Testing card
    const integrationCard = screen.getByTestId('integration-testing-card');
    expect(integrationCard).toContainElement(screen.getByText('Integration Testing'));
    expect(integrationCard).toContainElement(screen.getByText(/Testing component interactions/));
    
    // E2E Testing card
    const e2eCard = screen.getByTestId('e2e-testing-card');
    expect(e2eCard).toContainElement(screen.getByText('E2E Testing'));
    expect(e2eCard).toContainElement(screen.getByText(/Full user workflow testing/));
    
    // Accessibility card
    const a11yCard = screen.getByTestId('accessibility-card');
    expect(a11yCard).toContainElement(screen.getByText('Accessibility'));
    expect(a11yCard).toContainElement(screen.getByText(/accessible to all users/));
  });

  it('renders step numbers correctly', () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );
    
    // Check that step numbers are present
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});