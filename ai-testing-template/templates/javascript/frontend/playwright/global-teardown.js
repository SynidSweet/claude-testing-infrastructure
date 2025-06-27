// Global teardown for Playwright tests
const fs = require('fs-extra');
const path = require('path');

async function globalTeardown() {
  console.log('🧹 Starting global teardown for Playwright tests...');
  
  try {
    // Clean up test data, close database connections, etc.
    
    // Example: Clean up authentication files
    const authDir = path.join(__dirname, '.auth');
    if (await fs.pathExists(authDir)) {
      await fs.remove(authDir);
    }
    
    // Example: Clean up test uploads
    const uploadsDir = path.join(__dirname, '..', 'test-uploads');
    if (await fs.pathExists(uploadsDir)) {
      await fs.remove(uploadsDir);
    }
    
    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here as it might mask test failures
  }
}

module.exports = globalTeardown;