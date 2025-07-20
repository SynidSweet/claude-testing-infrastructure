#!/usr/bin/env node

/**
 * FastMCP CLI Entry Point
 *
 * Command-line interface for starting the claude-testing-infrastructure FastMCP server.
 * This script provides various server startup options and configurations.
 */

import { Command } from 'commander';
import type { FastMCPServerConfig } from './fastmcp-server';
import { runFastMCPServer } from './fastmcp-server';
import { logger } from '../utils/logger';

const program = new Command();

program
  .name('claude-testing-fastmcp')
  .description('FastMCP server for claude-testing-infrastructure')
  .version('2.0.0');

// Start server command
program
  .command('start')
  .description('Start the FastMCP server')
  .option('-p, --port <port>', 'Port for SSE transport (if using SSE)', parseInt)
  .option('-t, --transport <type>', 'Transport type (stdio|sse)', 'stdio')
  .option('-d, --debug', 'Enable debug mode', false)
  .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt, 60000)
  .option('--name <name>', 'Server name', 'claude-testing-infrastructure')
  .action(async (options) => {
    try {
      const config: Partial<FastMCPServerConfig> = {
        name: options.name,
        debug: options.debug,
        timeout: options.timeout,
        transport: {
          type: options.transport,
          ...(options.port && { port: options.port }),
        },
      };

      logger.info('Starting FastMCP server', { config });
      await runFastMCPServer(config);
    } catch (error) {
      logger.error('Failed to start FastMCP server', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  });

// Validate server command
program
  .command('validate')
  .description('Validate the FastMCP server configuration')
  .action(async () => {
    try {
      const { createClaudeTestingFastMCPServer } = await import('./fastmcp-server');
      const server = createClaudeTestingFastMCPServer();

      logger.info('FastMCP server validation successful', {
        status: server.getStatus(),
        config: server.getStatus().config,
      });

      console.log('✅ FastMCP server configuration is valid');
    } catch (error) {
      logger.error('FastMCP server validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error('❌ FastMCP server configuration is invalid');
      process.exit(1);
    }
  });

// Inspect server command
program
  .command('inspect')
  .description('Inspect the FastMCP server capabilities')
  .action(async () => {
    try {
      const { createClaudeTestingFastMCPServer } = await import('./fastmcp-server');
      const server = createClaudeTestingFastMCPServer();

      const status = server.getStatus();

      console.log('📋 FastMCP Server Inspection');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Name: ${status.config.name}`);
      console.log(`Version: ${status.config.version}`);
      console.log(`Description: ${status.config.description}`);
      console.log(`Transport: ${status.config.transport?.type || 'stdio'}`);
      console.log(`Debug: ${status.config.debug ? 'enabled' : 'disabled'}`);
      console.log(`Timeout: ${status.config.timeout || 60000}ms`);
      console.log(`Running: ${status.isRunning ? 'yes' : 'no'}`);

      if (status.config.transport?.port) {
        console.log(`Port: ${status.config.transport.port}`);
      }

      console.log('\n🛠️  Available Tools:');
      console.log('  • health_check - Check server health status');
      console.log('  • server_info - Get comprehensive server information');

      console.log('\n🏗️  Infrastructure:');
      console.log('  • Framework: FastMCP v3.9.0');
      console.log('  • Purpose: AI-powered decoupled testing infrastructure');
      console.log('  • Features: Test generation, Coverage analysis, Gap detection');
    } catch (error) {
      logger.error('FastMCP server inspection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error('❌ Failed to inspect FastMCP server');
      process.exit(1);
    }
  });

// Dev mode command
program
  .command('dev')
  .description('Start the FastMCP server in development mode')
  .option('-p, --port <port>', 'Port for SSE transport', parseInt, 3001)
  .action(async (options) => {
    try {
      const config: Partial<FastMCPServerConfig> = {
        debug: true,
        transport: {
          type: 'httpStream',
          port: options.port,
        },
      };

      console.log('🚀 Starting FastMCP server in development mode...');
      console.log(`📡 Server will be available at http://localhost:${options.port}`);
      console.log('🔍 Debug mode enabled');
      console.log('⚠️  Press Ctrl+C to stop the server');

      await runFastMCPServer(config);
    } catch (error) {
      logger.error('Failed to start FastMCP server in dev mode', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error) {
  if (error instanceof Error && error.name !== 'CommanderError') {
    logger.error('CLI error', { error: error.message });
    console.error('❌ CLI Error:', error.message);
  }
  process.exit(1);
}

// Handle case where no command is provided
if (process.argv.length === 2) {
  program.help();
}
