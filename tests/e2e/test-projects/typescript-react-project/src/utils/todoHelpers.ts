import { TodoItem, FilterOptions } from '../types';

export function filterTodos(todos: TodoItem[], options: FilterOptions): TodoItem[] {
  let filtered = [...todos];

  // Search filter
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(todo => 
      todo.title.toLowerCase().includes(searchLower) ||
      (todo.description && todo.description.toLowerCase().includes(searchLower))
    );
  }

  // Status filter
  if (options.filterBy?.includes('completed')) {
    filtered = filtered.filter(todo => todo.completed);
  } else if (options.filterBy?.includes('pending')) {
    filtered = filtered.filter(todo => !todo.completed);
  }

  // Priority filter
  if (options.filterBy?.some(f => ['low', 'medium', 'high'].includes(f))) {
    const priorities = options.filterBy.filter(f => ['low', 'medium', 'high'].includes(f));
    filtered = filtered.filter(todo => priorities.includes(todo.priority));
  }

  return filtered;
}

export function sortTodos(
  todos: TodoItem[], 
  sortBy: FilterOptions['sortBy']
): TodoItem[] {
  const sorted = [...todos];

  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    
    case 'priority':
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    case 'date':
    default:
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }
}

export function calculateTodoStats(todos: TodoItem[]) {
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const pending = total - completed;
  
  const byPriority = {
    high: todos.filter(t => t.priority === 'high').length,
    medium: todos.filter(t => t.priority === 'medium').length,
    low: todos.filter(t => t.priority === 'low').length
  };

  const overdue = todos.filter(t => 
    !t.completed && 
    t.dueDate && 
    new Date(t.dueDate) < new Date()
  ).length;

  return {
    total,
    completed,
    pending,
    byPriority,
    overdue,
    completionRate: total > 0 ? (completed / total) * 100 : 0
  };
}