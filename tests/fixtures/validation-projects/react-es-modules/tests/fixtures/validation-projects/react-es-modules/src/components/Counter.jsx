import { useState } from 'react';

export default function Counter({ initialValue = 0 }) {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  const reset = () => setCount(initialValue);

  return (
    <div className="counter" data-testid="counter">
      <h3>Counter: {count}</h3>
      <div className="counter-controls">
        <button onClick={decrement} data-testid="decrement-btn">-</button>
        <button onClick={increment} data-testid="increment-btn">+</button>
        <button onClick={reset} data-testid="reset-btn">Reset</button>
      </div>
    </div>
  );
}
EOF < /dev/null