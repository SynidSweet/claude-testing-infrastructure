import React, { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  const reset = () => setCount(0);

  const addTodo = () => {
    if (newTodo.trim()) {
      setTodos([...todos, { id: Date.now(), text: newTodo, completed: false }]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sample React App</h1>
        <p>This is a demo app for testing the decoupled testing suite</p>
      </header>

      <main>
        <section className="counter-section">
          <h2>Counter Demo</h2>
          <div className="counter">
            <button onClick={decrement} data-testid="decrement-btn">-</button>
            <span data-testid="counter-value">{count}</span>
            <button onClick={increment} data-testid="increment-btn">+</button>
          </div>
          <button onClick={reset} data-testid="reset-btn">Reset</button>
        </section>

        <section className="todo-section">
          <h2>Todo Demo</h2>
          <div className="todo-input">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add a new todo..."
              data-testid="todo-input"
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            />
            <button onClick={addTodo} data-testid="add-todo-btn">Add</button>
          </div>
          
          <ul className="todo-list" data-testid="todo-list">
            {todos.map(todo => (
              <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                  data-testid={`todo-checkbox-${todo.id}`}
                />
                <span 
                  className="todo-text"
                  data-testid={`todo-text-${todo.id}`}
                >
                  {todo.text}
                </span>
                <button 
                  onClick={() => deleteTodo(todo.id)}
                  data-testid={`delete-btn-${todo.id}`}
                  className="delete-btn"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          
          {todos.length === 0 && (
            <p className="empty-state" data-testid="empty-todos">
              No todos yet. Add one above!
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;