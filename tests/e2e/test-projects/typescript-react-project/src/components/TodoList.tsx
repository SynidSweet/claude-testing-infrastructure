import React, { useState, useEffect, useMemo } from 'react';
import { TodoItem, FilterOptions } from '../types';
import { filterTodos, sortTodos } from '../utils/todoHelpers';

interface TodoListProps {
  userId: number;
  onTodoComplete: (todoId: string) => void;
}

export const TodoList: React.FC<TodoListProps> = ({ userId, onTodoComplete }) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    search: '',
    sortBy: 'date',
    filterBy: []
  });

  useEffect(() => {
    fetchTodos();
  }, [userId]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      // Simulated API call
      const response = await new Promise<TodoItem[]>((resolve) => {
        setTimeout(() => {
          resolve([
            {
              id: '1',
              title: 'Complete project documentation',
              description: 'Write comprehensive docs for the new feature',
              completed: false,
              priority: 'high',
              dueDate: new Date('2024-12-31'),
              userId
            },
            {
              id: '2',
              title: 'Review pull requests',
              completed: true,
              priority: 'medium',
              userId
            }
          ]);
        }, 1000);
      });
      setTodos(response);
    } catch (err) {
      setError('Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedTodos = useMemo(() => {
    const filtered = filterTodos(todos, filterOptions);
    return sortTodos(filtered, filterOptions.sortBy || 'date');
  }, [todos, filterOptions]);

  const handleTodoClick = (todoId: string) => {
    setTodos(prev => 
      prev.map(todo => 
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
      )
    );
    onTodoComplete(todoId);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterOptions(prev => ({ ...prev, search: e.target.value }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterOptions(prev => ({ 
      ...prev, 
      sortBy: e.target.value as FilterOptions['sortBy'] 
    }));
  };

  if (loading) return <div className="loading">Loading todos...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="todo-list-container">
      <div className="todo-filters">
        <input
          type="text"
          placeholder="Search todos..."
          value={filterOptions.search}
          onChange={handleSearchChange}
          className="search-input"
        />
        <select 
          value={filterOptions.sortBy} 
          onChange={handleSortChange}
          className="sort-select"
        >
          <option value="date">Sort by Date</option>
          <option value="priority">Sort by Priority</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      <ul className="todo-list">
        {filteredAndSortedTodos.map(todo => (
          <li 
            key={todo.id} 
            className={`todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`}
            onClick={() => handleTodoClick(todo.id)}
          >
            <h3>{todo.title}</h3>
            {todo.description && <p>{todo.description}</p>}
            <div className="todo-meta">
              <span className="priority">{todo.priority}</span>
              {todo.dueDate && (
                <span className="due-date">
                  Due: {new Date(todo.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {filteredAndSortedTodos.length === 0 && (
        <p className="no-todos">No todos found</p>
      )}
    </div>
  );
};