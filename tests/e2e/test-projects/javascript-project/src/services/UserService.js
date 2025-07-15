const { isValidEmail } = require('../utils');

class UserService {
  constructor() {
    this.users = [];
    this.nextId = 1;
  }

  /**
   * Get all users
   * @returns {Array} List of all users
   */
  getAllUsers() {
    return this.users;
  }

  /**
   * Get user by ID
   * @param {number} id - User ID
   * @returns {Object|null} User object or null if not found
   */
  getUserById(id) {
    return this.users.find(user => user.id === id) || null;
  }

  /**
   * Create a new user
   * @param {string} name - User name
   * @param {string} email - User email
   * @returns {Object} Created user object
   */
  createUser(name, email) {
    // Validation
    if (!name || typeof name !== 'string') {
      throw new Error('Name is required and must be a string');
    }
    
    if (!email || !isValidEmail(email)) {
      throw new Error('Valid email is required');
    }
    
    // Check for duplicate email
    if (this.users.some(user => user.email === email)) {
      throw new Error('Email already exists');
    }
    
    // Create user
    const user = {
      id: this.nextId++,
      name: name.trim(),
      email: email.toLowerCase(),
      createdAt: new Date()
    };
    
    this.users.push(user);
    return user;
  }

  /**
   * Update user by ID
   * @param {number} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated user or null if not found
   */
  updateUser(id, updates) {
    const userIndex = this.users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return null;
    }
    
    // Validate updates
    if (updates.email && !isValidEmail(updates.email)) {
      throw new Error('Invalid email format');
    }
    
    // Apply updates
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    return this.users[userIndex];
  }

  /**
   * Delete user by ID
   * @param {number} id - User ID
   * @returns {boolean} True if deleted, false if not found
   */
  deleteUser(id) {
    const initialLength = this.users.length;
    this.users = this.users.filter(user => user.id !== id);
    return this.users.length < initialLength;
  }
}

module.exports = UserService;