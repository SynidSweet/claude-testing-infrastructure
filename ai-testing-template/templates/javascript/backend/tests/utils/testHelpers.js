const request = require('supertest');
const jwt = require('jsonwebtoken');

/**
 * Test helper utilities for backend testing
 */
class TestHelpers {
  constructor(app) {
    this.app = app;
    this.request = request(app);
  }

  /**
   * Authentication helpers
   */
  auth = {
    // Create test user and return token
    createUserAndToken: async (userData = {}) => {
      const user = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        ...userData,
      };

      const response = await this.request
        .post('/api/auth/register')
        .send(user)
        .expect(201);

      return {
        user: response.body.user,
        token: response.body.token,
      };
    },

    // Login with credentials
    login: async (email = 'test@example.com', password = 'password123') => {
      const response = await this.request
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      return {
        user: response.body.user,
        token: response.body.token,
      };
    },

    // Create JWT token for testing
    createToken: (payload = {}) => {
      const defaultPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        ...payload,
      };

      return jwt.sign(
        defaultPayload,
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    },

    // Get authorization header
    getAuthHeader: (token) => ({
      Authorization: `Bearer ${token}`,
    }),
  };

  /**
   * API request helpers
   */
  api = {
    // GET request with auth
    get: (url, token = null) => {
      const req = this.request.get(url);
      if (token) {
        req.set(this.auth.getAuthHeader(token));
      }
      return req;
    },

    // POST request with auth
    post: (url, data = {}, token = null) => {
      const req = this.request.post(url).send(data);
      if (token) {
        req.set(this.auth.getAuthHeader(token));
      }
      return req;
    },

    // PUT request with auth
    put: (url, data = {}, token = null) => {
      const req = this.request.put(url).send(data);
      if (token) {
        req.set(this.auth.getAuthHeader(token));
      }
      return req;
    },

    // DELETE request with auth
    delete: (url, token = null) => {
      const req = this.request.delete(url);
      if (token) {
        req.set(this.auth.getAuthHeader(token));
      }
      return req;
    },

    // Upload file
    upload: (url, fieldName, filePath, token = null) => {
      const req = this.request.post(url).attach(fieldName, filePath);
      if (token) {
        req.set(this.auth.getAuthHeader(token));
      }
      return req;
    },
  };

  /**
   * Database helpers
   */
  db = {
    // Clear all collections
    clearAll: async () => {
      if (global.mongoose && global.mongoose.connection.readyState === 1) {
        const collections = global.mongoose.connection.collections;
        
        for (const key in collections) {
          const collection = collections[key];
          await collection.deleteMany({});
        }
      }
    },

    // Create test data
    createUser: async (userData = {}) => {
      const User = require('../../src/models/User'); // Adjust path as needed
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        ...userData,
      });
      return await user.save();
    },

    // Seed test data
    seed: async (modelName, data) => {
      const Model = require(`../../src/models/${modelName}`); // Adjust path as needed
      
      if (Array.isArray(data)) {
        return await Model.insertMany(data);
      } else {
        const instance = new Model(data);
        return await instance.save();
      }
    },
  };

  /**
   * Validation helpers
   */
  validate = {
    // Check response structure
    responseStructure: (response, expectedKeys) => {
      expectedKeys.forEach(key => {
        expect(response.body).toHaveProperty(key);
      });
    },

    // Check error response format
    errorResponse: (response, statusCode, message = null) => {
      expect(response.status).toBe(statusCode);
      expect(response.body).toHaveProperty('error');
      if (message) {
        expect(response.body.error).toContain(message);
      }
    },

    // Check success response format
    successResponse: (response, statusCode = 200) => {
      expect(response.status).toBe(statusCode);
      expect(response.body).toHaveProperty('success', true);
    },

    // Check pagination response
    paginationResponse: (response) => {
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('pages');
    },
  };

  /**
   * Mock helpers
   */
  mock = {
    // Mock external API
    externalAPI: (url, response) => {
      const nock = require('nock');
      return nock(url).get('/').reply(200, response);
    },

    // Mock email service
    emailService: () => {
      const nodemailer = require('nodemailer');
      return {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-email-id' }),
        verify: jest.fn().mockResolvedValue(true),
      };
    },

    // Mock file upload
    fileUpload: (filename = 'test.jpg', url = 'https://example.com/test.jpg') => {
      return {
        filename,
        originalname: filename,
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test-image-data'),
        location: url,
      };
    },
  };

  /**
   * Time helpers
   */
  time = {
    // Travel to specific date
    travelTo: (date) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(date));
    },

    // Travel forward by duration
    travelBy: (milliseconds) => {
      jest.advanceTimersByTime(milliseconds);
    },

    // Restore real timers
    restore: () => {
      jest.useRealTimers();
    },
  };

  /**
   * Async helpers
   */
  async = {
    // Wait for condition to be true
    waitFor: async (condition, timeout = 5000, interval = 100) => {
      const start = Date.now();
      
      while (Date.now() - start < timeout) {
        if (await condition()) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      throw new Error(`Condition not met within ${timeout}ms`);
    },

    // Retry operation
    retry: async (operation, maxAttempts = 3, delay = 1000) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError;
    },
  };
}

module.exports = TestHelpers;