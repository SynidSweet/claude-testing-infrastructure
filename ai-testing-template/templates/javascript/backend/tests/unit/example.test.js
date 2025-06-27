// Example unit tests for backend functions
const { validateEmail, hashPassword, generateToken } = require('../../src/utils/auth');

describe('Auth Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user@example.',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('hashPassword', () => {
    it('should hash passwords correctly', async () => {
      const password = 'testpassword123';
      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow();
      await expect(hashPassword(null)).rejects.toThrow();
      await expect(hashPassword(undefined)).rejects.toThrow();
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT tokens', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const jwt = require('jsonwebtoken');
      const payload = { userId: '123', email: 'test@example.com' };
      const token = generateToken(payload);
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('should set expiration time', () => {
      const jwt = require('jsonwebtoken');
      const payload = { userId: '123' };
      const token = generateToken(payload);
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });
});

// Example utility function tests
describe('String Utils', () => {
  const { capitalize, slugify, truncate } = require('../../src/utils/string');

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('hello world')).toBe('Hello world');
    });

    it('should handle empty strings', () => {
      expect(capitalize('')).toBe('');
      expect(capitalize(null)).toBe('');
      expect(capitalize(undefined)).toBe('');
    });
  });

  describe('slugify', () => {
    it('should create URL-friendly slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Hello, World!')).toBe('hello-world');
      expect(slugify('Special Characters: @#$%')).toBe('special-characters');
    });

    it('should handle numbers and unicode', () => {
      expect(slugify('Test 123')).toBe('test-123');
      expect(slugify('Café & Restaurant')).toBe('cafe-restaurant');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const longString = 'This is a very long string that should be truncated';
      expect(truncate(longString, 20)).toBe('This is a very long...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Short', 20)).toBe('Short');
    });

    it('should handle edge cases', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate('Test', 0)).toBe('');
      expect(truncate('Test', -1)).toBe('');
    });
  });
});

// Example validation tests
describe('Validation Utils', () => {
  const { validateUser, validateProduct } = require('../../src/utils/validation');

  describe('validateUser', () => {
    it('should validate correct user data', () => {
      const validUser = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const result = validateUser(validUser);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid user data', () => {
      const invalidUser = {
        email: 'invalid-email',
        password: '123', // too short
        name: '' // empty name
      };

      const result = validateUser(invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Invalid email format');
      expect(result.errors).toContain('Password must be at least 6 characters');
      expect(result.errors).toContain('Name is required');
    });
  });

  describe('validateProduct', () => {
    it('should validate correct product data', () => {
      const validProduct = {
        name: 'Test Product',
        price: 99.99,
        description: 'A test product',
        category: 'electronics'
      };

      const result = validateProduct(validProduct);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid product data', () => {
      const invalidProduct = {
        name: '',
        price: -10,
        description: 'A'.repeat(1001), // too long
        category: 'invalid-category'
      };

      const result = validateProduct(invalidProduct);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});