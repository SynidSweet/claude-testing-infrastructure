import { logger, logInfo, logError, createModuleLogger } from '@utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Clear any previous log entries
    jest.clearAllMocks();
  });

  it('should create a logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(logger, 'info');
    logInfo('Test info message');
    expect(spy).toHaveBeenCalledWith('Test info message', undefined);
  });

  it('should log error messages with error details', () => {
    const spy = jest.spyOn(logger, 'error');
    const testError = new Error('Test error');
    logError('Test error message', testError);
    expect(spy).toHaveBeenCalledWith('Test error message', {
      error: 'Test error',
      stack: expect.any(String),
    });
  });

  it('should create module-specific loggers', () => {
    const moduleLogger = createModuleLogger('TestModule');
    expect(moduleLogger).toBeDefined();
    expect(moduleLogger.info).toBeDefined();
  });
});