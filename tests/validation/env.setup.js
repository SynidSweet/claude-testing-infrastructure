/**
 * Environment setup for AI validation tests
 * Sets required environment variables and configurations
 */

// Set longer timeouts for AI operations
process.env.CLAUDE_CLI_TIMEOUT = '900000'; // 15 minutes
process.env.AI_GENERATION_TIMEOUT = '900000'; // 15 minutes

// Test environment flags
process.env.NODE_ENV = 'test';
process.env.VALIDATION_MODE = 'true';

// Disable certain features during testing
process.env.DISABLE_TELEMETRY = 'true';
process.env.DISABLE_UPDATE_CHECK = 'true';

// AI validation specific settings
process.env.VALIDATION_BUDGET = '5.00'; // $5 budget for AI tests
process.env.VALIDATION_MODEL = 'sonnet'; // Default model for validation

// Memory settings for large operations
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Logging configuration
process.env.LOG_LEVEL = 'debug';
process.env.VALIDATION_LOG_LEVEL = 'verbose';

// Test project paths (for consistency)
process.env.TEST_FIXTURES_PATH = require('path').join(__dirname, '../fixtures/validation-projects');

console.log('🔧 AI Validation environment configured');
console.log(`   Timeouts: ${process.env.CLAUDE_CLI_TIMEOUT}ms`);
console.log(`   Budget: $${process.env.VALIDATION_BUDGET}`);
console.log(`   Model: ${process.env.VALIDATION_MODEL}`);
console.log(`   Memory: ${process.env.NODE_OPTIONS}`);