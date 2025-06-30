import { useState, useCallback, useEffect } from 'react';

/**
 * Counter component with various features for comprehensive testing
 */
export default function Counter({ 
  initialValue = 0, 
  min = -Infinity, 
  max = Infinity, 
  step = 1,
  onValueChange,
  disabled = false 
}) {
  const [count, setCount] = useState(initialValue);
  const [history, setHistory] = useState([initialValue]);
  const [autoIncrement, setAutoIncrement] = useState(false);

  // Validate props
  useEffect(() => {
    if (typeof initialValue !== 'number') {
      console.warn('Counter: initialValue should be a number');
    }
    if (min >= max) {
      console.warn('Counter: min should be less than max');
    }
  }, [initialValue, min, max]);

  // Auto increment effect
  useEffect(() => {
    if (!autoIncrement || disabled) return;
    
    const interval = setInterval(() => {
      setCount(prevCount => {
        const newValue = Math.min(prevCount + step, max);
        if (newValue === prevCount) {
          setAutoIncrement(false); // Stop when we reach max
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoIncrement, disabled, step, max]);

  // Update history when count changes
  useEffect(() => {
    setHistory(prev => [...prev.slice(-9), count]); // Keep last 10 values
    onValueChange?.(count);
  }, [count, onValueChange]);

  const increment = useCallback(() => {
    if (disabled) return;
    
    setCount(prevCount => {
      const newValue = prevCount + step;
      if (newValue > max) {
        console.warn('Counter: Cannot increment beyond maximum value');
        return prevCount;
      }
      return newValue;
    });
  }, [disabled, step, max]);

  const decrement = useCallback(() => {
    if (disabled) return;
    
    setCount(prevCount => {
      const newValue = prevCount - step;
      if (newValue < min) {
        console.warn('Counter: Cannot decrement below minimum value');
        return prevCount;
      }
      return newValue;
    });
  }, [disabled, step, min]);

  const reset = useCallback(() => {
    if (disabled) return;
    setCount(initialValue);
    setHistory([initialValue]);
    setAutoIncrement(false);
  }, [disabled, initialValue]);

  const setToValue = useCallback((value) => {
    if (disabled) return;
    
    if (typeof value !== 'number' || isNaN(value)) {
      console.error('Counter: Invalid value provided to setToValue');
      return;
    }

    const clampedValue = Math.max(min, Math.min(max, value));
    setCount(clampedValue);
    
    if (clampedValue !== value) {
      console.warn(`Counter: Value ${value} was clamped to ${clampedValue}`);
    }
  }, [disabled, min, max]);

  const toggleAutoIncrement = useCallback(() => {
    if (disabled) return;
    setAutoIncrement(prev => !prev);
  }, [disabled]);

  const canIncrement = !disabled && count < max;
  const canDecrement = !disabled && count > min;
  const canReset = !disabled && count !== initialValue;

  return (
    <div className="counter" data-testid="counter">
      <div className="counter-display">
        <span className="counter-value" data-testid="counter-value">
          {count}
        </span>
        {(count === min || count === max) && (
          <span className="counter-limit" data-testid="counter-limit">
            {count === min ? 'MIN' : 'MAX'}
          </span>
        )}
      </div>

      <div className="counter-controls">
        <button
          onClick={decrement}
          disabled={!canDecrement}
          data-testid="decrement-button"
          className="counter-button decrement"
          aria-label="Decrement counter"
        >
          -
        </button>

        <button
          onClick={increment}
          disabled={!canIncrement}
          data-testid="increment-button"
          className="counter-button increment"
          aria-label="Increment counter"
        >
          +
        </button>

        <button
          onClick={reset}
          disabled={!canReset}
          data-testid="reset-button"
          className="counter-button reset"
          aria-label="Reset counter"
        >
          Reset
        </button>
      </div>

      <div className="counter-advanced">
        <button
          onClick={toggleAutoIncrement}
          disabled={disabled || count >= max}
          data-testid="auto-increment-button"
          className={`counter-button auto ${autoIncrement ? 'active' : ''}`}
          aria-label="Toggle auto increment"
        >
          Auto {autoIncrement ? 'ON' : 'OFF'}
        </button>

        <input
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder="Set value"
          data-testid="value-input"
          className="counter-input"
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
              setToValue(value);
            }
          }}
        />
      </div>

      <div className="counter-info">
        <div className="counter-stats" data-testid="counter-stats">
          <span>Min: {min === -Infinity ? '∞' : min}</span>
          <span>Max: {max === Infinity ? '∞' : max}</span>
          <span>Step: {step}</span>
        </div>

        <div className="counter-history" data-testid="counter-history">
          <span>History: </span>
          {history.slice(-5).map((value, index) => (
            <span key={index} className="history-value">
              {value}
              {index < history.slice(-5).length - 1 ? ' → ' : ''}
            </span>
          ))}
        </div>
      </div>

      {disabled && (
        <div className="counter-disabled" data-testid="counter-disabled">
          Counter is disabled
        </div>
      )}
    </div>
  );
}

/**
 * Multi-counter component for testing multiple instances
 */
export function MultiCounter({ counters = [{}], onTotalChange }) {
  const [counterValues, setCounterValues] = useState({});

  const handleCounterChange = useCallback((index, value) => {
    setCounterValues(prev => {
      const newValues = { ...prev, [index]: value };
      const total = Object.values(newValues).reduce((sum, val) => sum + (val || 0), 0);
      onTotalChange?.(total);
      return newValues;
    });
  }, [onTotalChange]);

  const total = Object.values(counterValues).reduce((sum, val) => sum + (val || 0), 0);

  return (
    <div className="multi-counter" data-testid="multi-counter">
      <div className="multi-counter-total" data-testid="multi-counter-total">
        Total: {total}
      </div>
      
      <div className="multi-counter-list">
        {counters.map((counterProps, index) => (
          <div key={index} className="multi-counter-item">
            <span className="counter-label">Counter {index + 1}:</span>
            <Counter
              {...counterProps}
              onValueChange={(value) => handleCounterChange(index, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Animated counter with smooth transitions
 */
export function AnimatedCounter({ value = 0, duration = 1000, format = (n) => n.toString() }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (displayValue === value) return;

    setIsAnimating(true);
    const startValue = displayValue;
    const difference = value - startValue;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (difference * easedProgress);
      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, displayValue]);

  return (
    <div 
      className={`animated-counter ${isAnimating ? 'animating' : ''}`} 
      data-testid="animated-counter"
    >
      <span className="animated-value" data-testid="animated-value">
        {format(displayValue)}
      </span>
    </div>
  );
}