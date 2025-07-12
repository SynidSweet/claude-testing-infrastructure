const _ = require('lodash');

/**
 * Calculate the sum of an array of numbers
 * @param {number[]} numbers - Array of numbers to sum
 * @returns {number} The sum of all numbers
 */
function calculateSum(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Input must be an array');
  }
  
  return numbers.reduce((sum, num) => {
    if (typeof num !== 'number') {
      throw new TypeError('All elements must be numbers');
    }
    return sum + num;
  }, 0);
}

/**
 * Process data with various transformations
 * @param {Object} data - Input data object
 * @returns {Object} Processed data
 */
function processData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data input');
  }
  
  // Deep clone to avoid mutations
  const processed = _.cloneDeep(data);
  
  // Transform strings to uppercase
  Object.keys(processed).forEach(key => {
    if (typeof processed[key] === 'string') {
      processed[key] = processed[key].toUpperCase();
    }
  });
  
  // Add timestamp
  processed.processedAt = new Date().toISOString();
  
  return processed;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  calculateSum,
  processData,
  isValidEmail
};