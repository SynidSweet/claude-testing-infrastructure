/**
 * Common imports shared across the codebase
 * Consolidates frequently used Node.js modules and utilities
 */

// Node.js core modules
export { promises as fs } from 'fs';
export { default as path } from 'path';

// Logging utility
export { logger } from './logger';

// External utilities
export { default as chalk } from 'chalk';
export { default as ora } from 'ora';
export { default as fg } from 'fast-glob';

// Configuration utilities
export { ConfigurationManager, loadAndValidateConfig, validateConfig } from './config-validation';