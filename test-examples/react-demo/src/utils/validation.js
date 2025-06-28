export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }
  
  return { isValid: true };
};

export const validateAge = (age) => {
  const numAge = parseInt(age, 10);
  
  if (isNaN(numAge)) {
    return { isValid: false, error: 'Age must be a number' };
  }
  
  if (numAge < 0 || numAge > 150) {
    return { isValid: false, error: 'Age must be between 0 and 150' };
  }
  
  return { isValid: true };
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .slice(0, 1000); // Limit length
};

export const validateUserForm = (formData) => {
  const errors = {};
  
  if (!formData.email || !validateEmail(formData.email)) {
    errors.email = 'Valid email is required';
  }
  
  if (!formData.firstName || formData.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }
  
  if (!formData.lastName || formData.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters';
  }
  
  if (formData.age) {
    const ageValidation = validateAge(formData.age);
    if (!ageValidation.isValid) {
      errors.age = ageValidation.error;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};