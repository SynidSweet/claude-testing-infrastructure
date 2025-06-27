// Test setup file for Node.js backend tests
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const redis = require('redis');

// Global test variables
global.testDb = null;
global.testRedis = null;

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for database operations
jest.setTimeout(30000);

// Setup before all tests
beforeAll(async () => {
  // Set up in-memory MongoDB for testing
  if (process.env.USE_MONGODB !== 'false') {
    try {
      global.testDb = await MongoMemoryServer.create();
      const mongoUri = global.testDb.getUri();
      
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      console.log('📦 Connected to in-memory MongoDB for testing');
    } catch (error) {
      console.warn('⚠️ MongoDB setup failed, skipping database tests:', error.message);
    }
  }

  // Set up Redis for testing (if needed)
  if (process.env.USE_REDIS !== 'false') {
    try {
      global.testRedis = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: 15, // Use a separate DB for tests
      });
      
      await global.testRedis.connect();
      console.log('🔴 Connected to Redis for testing');
    } catch (error) {
      console.warn('⚠️ Redis setup failed, skipping Redis tests:', error.message);
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up MongoDB
  if (global.testDb) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await global.testDb.stop();
    console.log('🧹 Cleaned up MongoDB test database');
  }

  // Clean up Redis
  if (global.testRedis) {
    await global.testRedis.flushDb();
    await global.testRedis.quit();
    console.log('🧹 Cleaned up Redis test database');
  }
});

// Clean up between tests
afterEach(async () => {
  // Clear all collections in MongoDB
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }

  // Clear Redis
  if (global.testRedis && global.testRedis.isOpen) {
    await global.testRedis.flushDb();
  }

  // Clear all mocks
  jest.clearAllMocks();
});

// Mock external services
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-email-id' }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'https://s3.amazonaws.com/test-bucket/test-file.jpg' }),
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    }),
  })),
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cust_test123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cust_test123' }),
    },
    charges: {
      create: jest.fn().mockResolvedValue({ id: 'ch_test123', status: 'succeeded' }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_test123', status: 'requires_payment_method' }),
      confirm: jest.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded' }),
    },
  }));
});

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    role: 'user',
    ...overrides,
  }),

  // Create test JWT token
  createTestToken: (userId = 'test-user-id') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },

  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create mock request
  createMockReq: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  }),

  // Create mock response
  createMockRes: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
    };
    return res;
  },

  // Create mock next function
  createMockNext: () => jest.fn(),
};

// Console methods for debugging tests
console.testLog = (...args) => {
  if (process.env.DEBUG_TESTS) {
    console.log('[TEST]', ...args);
  }
};

console.testWarn = (...args) => {
  if (process.env.DEBUG_TESTS) {
    console.warn('[TEST WARNING]', ...args);
  }
};

console.testError = (...args) => {
  if (process.env.DEBUG_TESTS) {
    console.error('[TEST ERROR]', ...args);
  }
};