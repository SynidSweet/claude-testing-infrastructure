import { useState, useMemo } from 'react';
import { validateEmail, validatePhoneNumber, formatPhoneNumber } from '../services/api.js';

/**
 * User profile component with complex state management and validation
 */
export default function UserProfile({ user, onUserUpdate, editable = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState(user);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Memoized user display name
  const displayName = useMemo(() => {
    if (!user) return 'Unknown User';
    return user.name || user.username || `User ${user.id}`;
  }, [user]);

  // Memoized validation status
  const validationStatus = useMemo(() => {
    if (!editedUser) return { isValid: false, errorCount: 0 };
    
    const newErrors = {};
    
    if (!editedUser.name || editedUser.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!editedUser.email || !validateEmail(editedUser.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (editedUser.phone && !validatePhoneNumber(editedUser.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (editedUser.website && !isValidUrl(editedUser.website)) {
      newErrors.website = 'Please enter a valid website URL';
    }

    return {
      isValid: Object.keys(newErrors).length === 0,
      errorCount: Object.keys(newErrors).length,
      errors: newErrors
    };
  }, [editedUser]);

  const handleEdit = () => {
    if (!editable) return;
    setIsEditing(true);
    setEditedUser({ ...user });
    setErrors({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser(user);
    setErrors({});
  };

  const handleSave = async () => {
    if (!validationStatus.isValid) {
      setErrors(validationStatus.errors);
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (onUserUpdate) {
        await onUserUpdate(editedUser);
      }
      
      setIsEditing(false);
      setErrors({});
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedUser(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleAddressChange = (field, value) => {
    setEditedUser(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }));
  };

  const handleCompanyChange = (field, value) => {
    setEditedUser(prev => ({
      ...prev,
      company: {
        ...prev.company,
        [field]: value
      }
    }));
  };

  if (!user) {
    return (
      <div className="user-profile error" data-testid="user-profile-error">
        <p>No user data available</p>
      </div>
    );
  }

  return (
    <div className="user-profile" data-testid="user-profile">
      <div className="user-profile-header">
        <h3 className="user-name" data-testid="user-name">
          {displayName}
        </h3>
        {editable && !isEditing && (
          <button 
            onClick={handleEdit}
            data-testid="edit-button"
            className="edit-button"
          >
            Edit
          </button>
        )}
      </div>

      {errors.general && (
        <div className="error-message" data-testid="general-error">
          {errors.general}
        </div>
      )}

      <div className="user-profile-content">
        {isEditing ? (
          <EditForm
            user={editedUser}
            errors={errors}
            loading={loading}
            onInputChange={handleInputChange}
            onAddressChange={handleAddressChange}
            onCompanyChange={handleCompanyChange}
            onSave={handleSave}
            onCancel={handleCancel}
            validationStatus={validationStatus}
          />
        ) : (
          <DisplayView user={user} />
        )}
      </div>
    </div>
  );
}

/**
 * Display view for user profile
 */
function DisplayView({ user }) {
  return (
    <div className="user-display" data-testid="user-display">
      <div className="user-basic-info">
        <div className="user-field" data-testid="user-email">
          <strong>Email:</strong> {user.email}
        </div>
        
        {user.phone && (
          <div className="user-field" data-testid="user-phone">
            <strong>Phone:</strong> 
            {validatePhoneNumber(user.phone) 
              ? formatPhoneNumber(user.phone) 
              : user.phone
            }
          </div>
        )}
        
        {user.website && (
          <div className="user-field" data-testid="user-website">
            <strong>Website:</strong> 
            <a href={user.website} target="_blank" rel="noopener noreferrer">
              {user.website}
            </a>
          </div>
        )}
      </div>

      {user.address && (
        <div className="user-address" data-testid="user-address">
          <h4>Address</h4>
          <address>
            {user.address.street} {user.address.suite}<br />
            {user.address.city}, {user.address.zipcode}<br />
            {user.address.geo && (
              <small>
                Coordinates: {user.address.geo.lat}, {user.address.geo.lng}
              </small>
            )}
          </address>
        </div>
      )}

      {user.company && (
        <div className="user-company" data-testid="user-company">
          <h4>Company</h4>
          <div><strong>Name:</strong> {user.company.name}</div>
          {user.company.catchPhrase && (
            <div><strong>Motto:</strong> {user.company.catchPhrase}</div>
          )}
          {user.company.bs && (
            <div><strong>Business:</strong> {user.company.bs}</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Edit form for user profile
 */
function EditForm({ 
  user, 
  errors, 
  loading, 
  onInputChange, 
  onAddressChange, 
  onCompanyChange, 
  onSave, 
  onCancel,
  validationStatus 
}) {
  return (
    <form className="user-edit-form" data-testid="user-edit-form" onSubmit={(e) => e.preventDefault()}>
      <div className="form-section">
        <h4>Basic Information</h4>
        
        <div className="form-field">
          <label htmlFor="edit-name">Name *</label>
          <input
            id="edit-name"
            type="text"
            value={user.name || ''}
            onChange={(e) => onInputChange('name', e.target.value)}
            data-testid="edit-name-input"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="edit-email">Email *</label>
          <input
            id="edit-email"
            type="email"
            value={user.email || ''}
            onChange={(e) => onInputChange('email', e.target.value)}
            data-testid="edit-email-input"
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="edit-phone">Phone</label>
          <input
            id="edit-phone"
            type="tel"
            value={user.phone || ''}
            onChange={(e) => onInputChange('phone', e.target.value)}
            data-testid="edit-phone-input"
            className={errors.phone ? 'error' : ''}
            placeholder="(555) 123-4567"
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="edit-website">Website</label>
          <input
            id="edit-website"
            type="url"
            value={user.website || ''}
            onChange={(e) => onInputChange('website', e.target.value)}
            data-testid="edit-website-input"
            className={errors.website ? 'error' : ''}
            placeholder="https://example.com"
          />
          {errors.website && <span className="field-error">{errors.website}</span>}
        </div>
      </div>

      {user.address && (
        <div className="form-section">
          <h4>Address</h4>
          
          <div className="form-field">
            <label htmlFor="edit-street">Street</label>
            <input
              id="edit-street"
              type="text"
              value={user.address.street || ''}
              onChange={(e) => onAddressChange('street', e.target.value)}
              data-testid="edit-street-input"
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-city">City</label>
            <input
              id="edit-city"
              type="text"
              value={user.address.city || ''}
              onChange={(e) => onAddressChange('city', e.target.value)}
              data-testid="edit-city-input"
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-zipcode">Zip Code</label>
            <input
              id="edit-zipcode"
              type="text"
              value={user.address.zipcode || ''}
              onChange={(e) => onAddressChange('zipcode', e.target.value)}
              data-testid="edit-zipcode-input"
            />
          </div>
        </div>
      )}

      <div className="form-actions">
        <div className="validation-status" data-testid="validation-status">
          {validationStatus.isValid ? (
            <span className="valid">✓ All fields valid</span>
          ) : (
            <span className="invalid">
              {validationStatus.errorCount} error{validationStatus.errorCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="action-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            data-testid="cancel-button"
            className="cancel-button"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={onSave}
            disabled={loading || !validationStatus.isValid}
            data-testid="save-button"
            className="save-button"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Utility function to validate URLs
 */
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Compact user card component
 */
export function UserCard({ user, onClick, selected = false }) {
  if (!user) {
    return (
      <div className="user-card error" data-testid="user-card-error">
        Invalid user data
      </div>
    );
  }

  return (
    <div 
      className={`user-card ${selected ? 'selected' : ''} ${onClick ? 'clickable' : ''}`}
      data-testid="user-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="user-card-header">
        <h4 className="user-card-name">{user.name}</h4>
        <span className="user-card-username">@{user.username}</span>
      </div>
      
      <div className="user-card-contact">
        <div className="user-card-email">{user.email}</div>
        {user.phone && (
          <div className="user-card-phone">{user.phone}</div>
        )}
      </div>

      {user.company && (
        <div className="user-card-company">
          {user.company.name}
        </div>
      )}
    </div>
  );
}

/**
 * User list component
 */
export function UserList({ users, onUserSelect, selectedUserId }) {
  if (!users || users.length === 0) {
    return (
      <div className="user-list empty" data-testid="user-list-empty">
        No users found
      </div>
    );
  }

  return (
    <div className="user-list" data-testid="user-list">
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          selected={user.id === selectedUserId}
          onClick={() => onUserSelect?.(user)}
        />
      ))}
    </div>
  );
}