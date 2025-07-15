#!/usr/bin/env node

/**
 * Production Readiness Check Script - Enhanced Version
 * 
 * Validates that the Claude Testing Infrastructure is ready for production deployment
 * Includes CI/CD pipeline status checking and comprehensive deployability assessment
 * 
 * This script now forwards to the enhanced version with CI/CD integration
 * 
 * Exit codes:
 * 0 - Production ready (all gates passed)
 * 1 - Not production ready (gates failed)
 * 2 - Script error (validation couldn't complete)
 */

// Forward to enhanced version
const EnhancedProductionReadinessChecker = require('./production-readiness-check-enhanced');

// Run the enhanced production readiness check
if (require.main === module) {
  const checker = new EnhancedProductionReadinessChecker();
  checker.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = EnhancedProductionReadinessChecker;