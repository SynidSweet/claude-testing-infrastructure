import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), '.claude-testing', 'logs');
fs.ensureDirSync(logsDir);

// Custom format for console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const levelColors = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.blue,
    debug: chalk.gray,
  };

  const colorize = levelColors[level as keyof typeof levelColors] ?? chalk.white;
  const formattedTime = chalk.gray(
    new Date(timestamp as string | number | Date).toLocaleTimeString()
  );

  let output = `${formattedTime} ${colorize(level.toUpperCase().padEnd(5))} ${String(message)}`;

  if (Object.keys(meta).length > 0) {
    output += chalk.gray(` ${JSON.stringify(meta)}`);
  }

  return output;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'claude-testing' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), consoleFormat),
    }),
    // File output for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // File output for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Add debug file transport when in debug mode
if (process.env.DEBUG ?? (false || process.argv.includes('--debug'))) {
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'debug.log'),
      level: 'debug',
      maxsize: 10485760, // 10MB
      maxFiles: 3,
    })
  );
}

// Export convenience methods
export const logError = (message: string, error?: Error): void => {
  logger.error(message, { error: error?.message, stack: error?.stack });
};

export const logInfo = (message: string, meta?: Record<string, unknown>): void => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: Record<string, unknown>): void => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>): void => {
  logger.debug(message, meta);
};

// Performance logging
export const logPerformance = (operation: string, duration: number): void => {
  logger.info(`Performance: ${operation}`, { duration: `${duration}ms` });
};

// Create a child logger for specific modules
export const createModuleLogger = (moduleName: string): winston.Logger => {
  return logger.child({ module: moduleName });
};
