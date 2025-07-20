#!/usr/bin/env node

/**
 * Health Check Script for Claude Testing Infrastructure MCP Server
 * Used by Docker health checks and monitoring systems
 */

const http = require('http');
const process = require('process');

const HEALTH_CHECK_PORT = process.env.MCP_HEALTH_CHECK_PORT || 3002;
const HEALTH_CHECK_HOST = process.env.MCP_HEALTH_CHECK_HOST || 'localhost';
const TIMEOUT_MS = 5000;

function performHealthCheck() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HEALTH_CHECK_HOST,
      port: HEALTH_CHECK_PORT,
      path: '/health',
      method: 'GET',
      timeout: TIMEOUT_MS
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const healthData = JSON.parse(data);
            if (healthData.status === 'healthy') {
              resolve(healthData);
            } else {
              reject(new Error(`Health check failed: ${healthData.status}`));
            }
          } catch (error) {
            reject(new Error(`Invalid health response: ${error.message}`));
          }
        } else {
          reject(new Error(`Health check returned status: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Health check request failed: ${error.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check request timed out'));
    });
    
    req.end();
  });
}

async function main() {
  try {
    const startTime = Date.now();
    const healthData = await performHealthCheck();
    const duration = Date.now() - startTime;
    
    console.log(`Health check passed in ${duration}ms`);
    console.log(`Status: ${healthData.status}`);
    
    if (healthData.version) {
      console.log(`Version: ${healthData.version}`);
    }
    
    if (healthData.engines) {
      const engines = Object.entries(healthData.engines);
      const healthyEngines = engines.filter(([, status]) => status === 'operational').length;
      console.log(`Engines: ${healthyEngines}/${engines.length} operational`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle signals
process.on('SIGTERM', () => {
  console.log('Health check terminated');
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('Health check interrupted');
  process.exit(1);
});

main();