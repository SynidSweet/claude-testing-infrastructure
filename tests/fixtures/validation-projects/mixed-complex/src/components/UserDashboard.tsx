// React TypeScript component for complex mixed project
import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/ApiService';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserDashboardProps {
  apiService: ApiService;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ apiService }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const userData = await apiService.fetchUsers();
        setUsers(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [apiService]);

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="user-dashboard">
      <h2>User Dashboard</h2>
      <div className="user-list">
        {users.map(user => (
          <div key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
};