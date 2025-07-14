/**
 * E2E Test Setup
 * 
 * Global setup for end-to-end tests
 * Created as part of IMPL-E2E-001 - Create End-to-End Validation Suite
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Ensure the CLI is built before running E2E tests
beforeAll(async () => {
  console.log('🔧 Setting up E2E test environment...');
  
  // Verify CLI is built
  try {
    const buildCheck = await execAsync('node dist/src/cli/index.js --version', {
      cwd: path.resolve('.')
    });
    console.log(`✅ CLI available: ${buildCheck.stdout.trim()}`);
  } catch (error) {
    console.error('❌ CLI not available. Building...');
    
    // Attempt to build
    try {
      await execAsync('npm run build', {
        cwd: path.resolve('.')
      });
      console.log('✅ Build completed successfully');
      
      // Verify again
      const verifyBuild = await execAsync('node dist/src/cli/index.js --version', {
        cwd: path.resolve('.')
      });
      console.log(`✅ CLI now available: ${verifyBuild.stdout.trim()}`);
    } catch (buildError) {
      throw new Error('Failed to build CLI for E2E tests: ' + (buildError instanceof Error ? buildError.message : String(buildError)));
    }
  }
  
  console.log('🚀 E2E test environment ready');
}, 2 * 60 * 1000); // 2 minute timeout for setup

// Global timeout for all E2E tests
jest.setTimeout(10 * 60 * 1000); // 10 minutes

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});