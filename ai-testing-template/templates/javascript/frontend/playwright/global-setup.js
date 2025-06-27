// Global setup for Playwright tests
const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🚀 Starting global setup for Playwright tests...');
  
  // Set up test data, authenticate users, etc.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Example: Pre-authenticate a user for tests
    // await page.goto('/login');
    // await page.fill('[data-testid="email"]', 'test@example.com');
    // await page.fill('[data-testid="password"]', 'password123');
    // await page.click('[data-testid="login-button"]');
    // await page.waitForURL('/dashboard');
    
    // Save authentication state
    // await page.context().storageState({ path: 'playwright/.auth/user.json' });
    
    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;