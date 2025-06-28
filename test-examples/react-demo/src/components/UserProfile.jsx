import React, { useState, useEffect } from 'react';

const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!userId) {
          throw new Error('User ID is required');
        }

        const response = await fetch(`/api/users/${userId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const userData = await response.json();
        
        // Complex business logic for user data processing
        const processedUser = {
          ...userData,
          displayName: userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.email || 'Unknown User',
          isActive: userData.lastLogin && 
            new Date(userData.lastLogin) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          permissions: userData.roles?.reduce((acc, role) => {
            return [...acc, ...role.permissions];
          }, []) || []
        };
        
        setUser(processedUser);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleUpdateProfile = async (updates) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedUser = await response.json();
      setUser(prev => ({ ...prev, ...updatedUser }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading user profile...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <h3>Error loading profile</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!user) {
    return <div className="no-user">No user found</div>;
  }

  return (
    <div className="user-profile">
      <div className="profile-header">
        <img 
          src={user.avatar || '/default-avatar.png'} 
          alt={`${user.displayName}'s avatar`}
          className="profile-avatar"
        />
        <div className="profile-info">
          <h2>{user.displayName}</h2>
          <p className="email">{user.email}</p>
          <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      
      <div className="profile-details">
        <h3>Profile Details</h3>
        <div className="details-grid">
          <div>
            <label>First Name:</label>
            <span>{user.firstName || 'Not provided'}</span>
          </div>
          <div>
            <label>Last Name:</label>
            <span>{user.lastName || 'Not provided'}</span>
          </div>
          <div>
            <label>Last Login:</label>
            <span>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</span>
          </div>
          <div>
            <label>Permissions:</label>
            <span>{user.permissions.length > 0 ? user.permissions.join(', ') : 'None'}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={() => handleUpdateProfile({ lastSeen: new Date().toISOString() })}
        className="update-button"
      >
        Update Last Seen
      </button>
    </div>
  );
};

export default UserProfile;