import React from 'react';
import { render, screen, userEvent } from '../../test-utils';

// Example Button component test
// This assumes you have a Button component at src/components/Button.jsx
// Replace with your actual component import
const Button = ({ children, onClick, disabled = false, variant = 'primary' }) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    className={`btn btn-${variant}`}
    data-testid="button"
  >
    {children}
  </button>
);

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick} disabled>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies correct CSS class based on variant', () => {
    render(<Button variant="secondary">Click me</Button>);
    
    expect(screen.getByTestId('button')).toHaveClass('btn-secondary');
  });

  it('has default primary variant', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByTestId('button')).toHaveClass('btn-primary');
  });
});

// Example tests for a more complex component
describe('Button Component - Advanced Tests', () => {
  it('handles keyboard interactions', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await user.keyboard('{ }'); // Space key
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('supports custom test ids', () => {
    render(<Button data-testid="custom-button">Click me</Button>);
    
    expect(screen.getByTestId('custom-button')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef();
    
    const ButtonWithRef = React.forwardRef((props, ref) => (
      <button ref={ref} {...props} />
    ));
    
    render(<ButtonWithRef ref={ref}>Click me</ButtonWithRef>);
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});