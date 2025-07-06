import { ProgressReporter, ProgressEvent } from '../../src/utils/ProgressReporter';

// Mock ora to avoid actual spinner output during tests
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
  };
  return jest.fn(() => mockSpinner);
});

// Mock chalk to simplify testing
jest.mock('chalk', () => ({
  blue: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
}));

describe('ProgressReporter', () => {
  let progressReporter: ProgressReporter;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    progressReporter = new ProgressReporter();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    // Mock setMaxListeners to avoid warnings about event listener leaks
    jest.spyOn(progressReporter, 'setMaxListeners').mockImplementation();
    // Add error event listener to prevent unhandled errors
    progressReporter.on('error', () => {});
    progressReporter.on('warning', () => {});
    progressReporter.on('progress', () => {});
    progressReporter.on('complete', () => {});
    progressReporter.on('start', () => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with default verbose=false', () => {
      const reporter = new ProgressReporter();
      expect(reporter).toBeInstanceOf(ProgressReporter);
    });

    it('should create instance with verbose=true', () => {
      const reporter = new ProgressReporter(true);
      expect(reporter).toBeInstanceOf(ProgressReporter);
    });

    it('should initialize stats properly', () => {
      const reporter = new ProgressReporter();
      const stats = reporter.getStats();
      expect(stats.filesProcessed).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.warnings).toBe(0);
      expect(stats.startTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('start', () => {
    it('should start progress tracking with default message', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.start(10);
      
      expect(eventSpy).toHaveBeenCalledWith('start', {
        type: 'start',
        total: 10,
        message: 'Starting test generation...'
      });
      
      const stats = progressReporter.getStats();
      expect(stats.totalFiles).toBe(10);
    });

    it('should start progress tracking with custom message', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      const customMessage = 'Custom start message';
      
      progressReporter.start(5, customMessage);
      
      expect(eventSpy).toHaveBeenCalledWith('start', {
        type: 'start',
        total: 5,
        message: customMessage
      });
    });

    it('should start spinner in non-verbose mode', () => {
      const ora = require('ora');
      
      progressReporter.start(10);
      
      expect(ora).toHaveBeenCalledWith({
        text: 'Starting test generation...',
        spinner: 'dots',
      });
    });

    it('should log to console in verbose mode', () => {
      const verboseReporter = new ProgressReporter(true);
      
      verboseReporter.start(10, 'Test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      expect(consoleLogSpy).toHaveBeenCalledWith('Total files to process: 10');
    });
  });

  describe('updateProgress', () => {
    beforeEach(() => {
      progressReporter.start(10);
      jest.clearAllMocks();
    });

    it('should update progress without file information', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.updateProgress(5);
      
      expect(eventSpy).toHaveBeenCalledWith('progress', expect.objectContaining({
        type: 'progress',
        current: 5,
        total: 10,
        file: undefined
      }));
    });

    it('should update progress with file information', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      const testFile = '/path/to/test/file.ts';
      
      progressReporter.updateProgress(3, testFile);
      
      expect(eventSpy).toHaveBeenCalledWith('progress', expect.objectContaining({
        type: 'progress',
        current: 3,
        total: 10,
        file: testFile
      }));
    });

    it('should throttle updates to avoid flickering', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      // First update should go through
      progressReporter.updateProgress(1);
      expect(eventSpy).toHaveBeenCalledTimes(1);
      
      // Immediate second update should be throttled
      progressReporter.updateProgress(2);
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should calculate percentage and ETA correctly', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.updateProgress(5);
      
      const emittedEvent = eventSpy.mock.calls[0]?.[1] as ProgressEvent;
      expect(emittedEvent.message).toContain('50%');
      expect(emittedEvent.message).toContain('ETA:');
    });

    it('should display short path for long file paths', () => {
      const verboseReporter = new ProgressReporter(true);
      verboseReporter.start(10);
      jest.clearAllMocks();
      
      const longPath = '/very/long/path/to/some/deep/nested/file.ts';
      verboseReporter.updateProgress(5, longPath);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('.../')
      );
    });
  });

  describe('reportError', () => {
    beforeEach(() => {
      progressReporter.start(10);
      jest.clearAllMocks();
    });

    it('should report error with Error object', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      const testError = new Error('Test error');
      
      progressReporter.reportError(testError);
      
      expect(eventSpy).toHaveBeenCalledWith('error', {
        type: 'error',
        error: testError,
        file: undefined,
        message: 'Test error'
      });
      
      const stats = progressReporter.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should report error with string message', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      const errorMessage = 'String error message';
      
      progressReporter.reportError(errorMessage);
      
      expect(eventSpy).toHaveBeenCalledWith('error', expect.objectContaining({
        type: 'error',
        message: errorMessage
      }));
    });

    it('should report error with file information', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      const testFile = '/path/to/file.ts';
      
      progressReporter.reportError('Error message', testFile);
      
      expect(eventSpy).toHaveBeenCalledWith('error', expect.objectContaining({
        file: testFile
      }));
    });

    it('should log error to console', () => {
      progressReporter.reportError('Test error', '/path/to/file.ts');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in .../path/to/file.ts: Test error')
      );
    });

    it('should handle spinner in non-verbose mode', () => {
      const ora = require('ora');
      const mockSpinner = ora();
      
      progressReporter.reportError('Test error');
      
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
    });
  });

  describe('reportWarning', () => {
    beforeEach(() => {
      progressReporter.start(10);
      jest.clearAllMocks();
    });

    it('should report warning and increment warning count', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.reportWarning('Test warning');
      
      expect(eventSpy).toHaveBeenCalledWith('warning', {
        type: 'warning',
        message: 'Test warning',
        file: undefined
      });
      
      const stats = progressReporter.getStats();
      expect(stats.warnings).toBe(1);
    });

    it('should report warning with file information', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      const testFile = '/path/to/file.ts';
      
      progressReporter.reportWarning('Test warning', testFile);
      
      expect(eventSpy).toHaveBeenCalledWith('warning', expect.objectContaining({
        file: testFile
      }));
    });

    it('should log warning in verbose mode', () => {
      const verboseReporter = new ProgressReporter(true);
      verboseReporter.start(10);
      jest.clearAllMocks();
      
      verboseReporter.reportWarning('Test warning', '/path/to/file.ts');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning in .../path/to/file.ts: Test warning')
      );
    });

    it('should not log warning in non-verbose mode', () => {
      progressReporter.reportWarning('Test warning');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    beforeEach(() => {
      progressReporter.start(10);
      progressReporter.updateProgress(8);
      progressReporter.reportError('Test error');
      progressReporter.reportWarning('Test warning');
      jest.clearAllMocks();
    });

    it('should complete with success', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.complete(true, 'Success message');
      
      expect(eventSpy).toHaveBeenCalledWith('complete', {
        type: 'complete',
        message: 'Success message',
        current: 8,
        total: 10
      });
    });

    it('should complete with failure', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.complete(false, 'Failure message');
      
      expect(eventSpy).toHaveBeenCalledWith('complete', {
        type: 'complete',
        message: 'Failure message',
        current: 8,
        total: 10
      });
    });

    it('should use default messages when none provided', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.complete(true);
      
      expect(eventSpy).toHaveBeenCalledWith('complete', expect.objectContaining({
        message: 'Completed'
      }));
    });

    it('should handle spinner success in non-verbose mode', () => {
      const ora = require('ora');
      const mockSpinner = ora();
      
      progressReporter.complete(true, 'Success');
      
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Success');
    });

    it('should handle spinner failure in non-verbose mode', () => {
      const ora = require('ora');
      const mockSpinner = ora();
      
      progressReporter.complete(false, 'Failed');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed');
    });

    it('should display summary in verbose mode', () => {
      const verboseReporter = new ProgressReporter(true);
      // Add event listeners to prevent unhandled errors
      verboseReporter.on('error', () => {});
      verboseReporter.on('warning', () => {});
      verboseReporter.on('progress', () => {});
      verboseReporter.on('complete', () => {});
      verboseReporter.on('start', () => {});
      
      verboseReporter.start(10);
      verboseReporter.updateProgress(8);
      verboseReporter.reportError('Test error');
      verboseReporter.reportWarning('Test warning');
      jest.clearAllMocks();
      
      verboseReporter.complete(true);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generation Summary:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Files processed: 8/10'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Errors: 1'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Warnings: 1'));
    });

    it('should display summary on success even in non-verbose mode', () => {
      // Need to set up some progress state first  
      progressReporter.start(10);
      progressReporter.updateProgress(8);
      progressReporter.reportError('Test error');
      progressReporter.reportWarning('Test warning');
      jest.clearAllMocks();
      
      progressReporter.complete(true);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generation Summary:'));
    });
  });

  describe('getStats', () => {
    it('should return a copy of stats', () => {
      progressReporter.start(10);
      progressReporter.updateProgress(5);
      progressReporter.reportError('Error');
      progressReporter.reportWarning('Warning');
      
      const stats = progressReporter.getStats();
      
      expect(stats.totalFiles).toBe(10);
      expect(stats.filesProcessed).toBe(5);
      expect(stats.errors).toBe(1);
      expect(stats.warnings).toBe(1);
      expect(stats.startTime).toBeGreaterThan(0);
      
      // Verify it's a copy by modifying the returned object
      stats.errors = 999;
      const freshStats = progressReporter.getStats();
      expect(freshStats.errors).toBe(1);
    });
  });

  describe('getShortPath', () => {
    it('should return full path for short paths', () => {
      // Access private method via type assertion for testing
      const shortPath = (progressReporter as any).getShortPath('/short/path.ts');
      expect(shortPath).toBe('/short/path.ts');
    });

    it('should truncate long paths', () => {
      const longPath = '/very/long/path/to/some/deep/nested/file.ts';
      const shortPath = (progressReporter as any).getShortPath(longPath);
      expect(shortPath).toBe('.../deep/nested/file.ts');
    });

    it('should handle Windows paths', () => {
      const windowsPath = 'C:\\very\\long\\path\\to\\some\\deep\\nested\\file.ts';
      const shortPath = (progressReporter as any).getShortPath(windowsPath);
      expect(shortPath).toBe('.../deep/nested/file.ts');
    });
  });

  describe('event emissions', () => {
    it('should emit all event types correctly', () => {
      const eventSpy = jest.spyOn(progressReporter, 'emit');
      
      progressReporter.start(5);
      progressReporter.updateProgress(3, '/test/file.ts');
      progressReporter.reportError('Test error');
      progressReporter.reportWarning('Test warning');
      progressReporter.complete(true);
      
      expect(eventSpy).toHaveBeenCalledWith('start', expect.any(Object));
      expect(eventSpy).toHaveBeenCalledWith('progress', expect.any(Object));
      expect(eventSpy).toHaveBeenCalledWith('error', expect.any(Object));
      expect(eventSpy).toHaveBeenCalledWith('warning', expect.any(Object));
      expect(eventSpy).toHaveBeenCalledWith('complete', expect.any(Object));
    });
  });
});