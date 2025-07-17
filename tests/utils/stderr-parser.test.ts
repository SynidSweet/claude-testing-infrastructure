/**
 * Tests for enhanced stderr parser
 */

import { createStderrParser, StderrParser } from '../../src/utils/stderr-parser';
import { EventEmitter } from 'events';
import {
  AIAuthenticationError,
  AINetworkError,
  AIRateLimitError,
  AIModelError,
  AIError,
} from '../../src/types/ai-error-types';
import { setupMockCleanup } from './type-safe-mocks';

describe('StderrParser', () => {
  setupMockCleanup();
  
  let parser: StderrParser;
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
    parser = createStderrParser(emitter);
  });

  describe('Authentication Error Detection', () => {
    it('should detect authentication failed errors', () => {
      const error = parser.parseChunk('Error: Authentication failed. Please login first.\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('auth');
      expect(error?.severity).toBe('fatal');
      expect(error?.error).toBeInstanceOf(AIAuthenticationError);
      expect(error?.error.message).toContain('Authentication error detected');
    });

    it('should detect "not authenticated" errors', () => {
      const error = parser.parseChunk('User is not authenticated\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('auth');
      expect(error?.error).toBeInstanceOf(AIAuthenticationError);
    });

    it('should detect "please login" messages', () => {
      const error = parser.parseChunk('Please login to continue\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('auth');
      expect(error?.error).toBeInstanceOf(AIAuthenticationError);
    });

    it('should detect API key errors', () => {
      const error = parser.parseChunk('Error: Invalid API key provided\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('auth');
      expect(error?.error).toBeInstanceOf(AIAuthenticationError);
    });
  });

  describe('Network Error Detection', () => {
    it('should detect connection refused errors', () => {
      const error = parser.parseChunk('Error: connect ECONNREFUSED 127.0.0.1:443\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network');
      expect(error?.severity).toBe('fatal');
      expect(error?.error).toBeInstanceOf(AINetworkError);
      expect(error?.error.message).toContain('Network error detected');
    });

    it('should detect timeout errors', () => {
      const error = parser.parseChunk('Error: Connection timeout after 30 seconds\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network');
      expect(error?.error).toBeInstanceOf(AINetworkError);
    });

    it('should detect DNS errors', () => {
      const error = parser.parseChunk('Error: getaddrinfo ENOTFOUND api.anthropic.com\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network');
      expect(error?.error).toBeInstanceOf(AINetworkError);
    });

    it('should detect SSL/certificate errors', () => {
      const error = parser.parseChunk('Error: SSL certificate problem: unable to verify\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network');
      expect(error?.error).toBeInstanceOf(AINetworkError);
    });
  });

  describe('Rate Limit Error Detection', () => {
    it('should detect rate limit errors', () => {
      const error = parser.parseChunk('Error: Rate limit exceeded. Please try again later.\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('rateLimit');
      expect(error?.severity).toBe('fatal');
      expect(error?.error).toBeInstanceOf(AIRateLimitError);
      expect(error?.error.message).toContain('Rate limit detected');
    });

    it('should detect quota exceeded errors', () => {
      const error = parser.parseChunk('Error: Monthly quota exceeded\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('rateLimit');
      expect(error?.error).toBeInstanceOf(AIRateLimitError);
    });

    it('should detect 429 errors', () => {
      const error = parser.parseChunk('HTTP 429: Too Many Requests\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('rateLimit');
      expect(error?.error).toBeInstanceOf(AIRateLimitError);
    });
  });

  describe('Model Error Detection', () => {
    it('should detect model not found errors', () => {
      const error = parser.parseChunk('Error: Model "claude-100" not found\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('model');
      expect(error?.severity).toBe('fatal');
      expect(error?.error).toBeInstanceOf(AIModelError);
    });

    it('should detect invalid model errors', () => {
      const error = parser.parseChunk('Error: Invalid model specified\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('model');
      expect(error?.error).toBeInstanceOf(AIModelError);
    });
  });

  describe('API/Service Error Detection', () => {
    it('should detect internal server errors', () => {
      const error = parser.parseChunk('Error: 500 Internal Server Error\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('generic');
      expect(error?.severity).toBe('warning');
      expect(error?.error).toBeInstanceOf(AIError);
      expect(error?.error.message).toContain('API error detected');
    });

    it('should detect service unavailable errors', () => {
      const error = parser.parseChunk('Error: Service temporarily unavailable\n');
      
      expect(error).toBeTruthy();
      expect(error?.type).toBe('generic');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('Multi-line and Buffer Handling', () => {
    it('should handle multi-line stderr with incomplete lines', () => {
      // First chunk with incomplete line
      let error = parser.parseChunk('Starting process...\nError: Authenti');
      expect(error).toBeNull();
      
      // Complete the line
      error = parser.parseChunk('cation failed\nProcess terminated\n');
      expect(error).toBeTruthy();
      expect(error?.type).toBe('auth');
    });

    it('should parse remaining buffer when requested', () => {
      // Add incomplete line to buffer that doesn't match any pattern yet
      parser.parseChunk('Some output with no');
      
      // Parse remaining should not find error yet
      let error = parser.parseRemaining();
      expect(error).toBeNull();
      
      // Now add something that creates an error when combined
      parser.parseChunk(' network error detected');
      error = parser.parseRemaining();
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network');
    });
  });

  describe('Event Emission', () => {
    it('should emit error:detected event for fatal errors', (done) => {
      emitter.on('error:detected', (error) => {
        expect(error.type).toBe('auth');
        expect(error.severity).toBe('fatal');
        done();
      });
      
      parser.parseChunk('Error: Authentication failed\n');
    });

    it('should emit error:detected event for warnings', (done) => {
      emitter.on('error:detected', (error) => {
        expect(error.type).toBe('generic');
        expect(error.severity).toBe('warning');
        done();
      });
      
      parser.parseChunk('Error: Service unavailable\n');
    });
  });

  describe('Error Collection', () => {
    it('should collect all errors encountered', () => {
      parser.parseChunk('Warning: Service degraded\n');
      parser.parseChunk('Error: Authentication failed\n');
      parser.parseChunk('Error: Rate limit exceeded\n');
      
      const errors = parser.getAllErrors();
      expect(errors).toHaveLength(3);
      expect(errors[0]?.severity).toBe('warning');
      expect(errors[1]?.type).toBe('auth');
      expect(errors[2]?.type).toBe('rateLimit');
    });

    it('should find first fatal error', () => {
      parser.parseChunk('Warning: Service degraded\n');
      parser.parseChunk('Error: Authentication failed\n');
      parser.parseChunk('Error: Rate limit exceeded\n');
      
      const fatalError = parser.getFirstFatalError();
      expect(fatalError).toBeTruthy();
      expect(fatalError?.type).toBe('auth');
    });
  });

  describe('State Management', () => {
    it('should reset state when requested', () => {
      parser.parseChunk('Error: Authentication failed\n');
      expect(parser.getAllErrors()).toHaveLength(1);
      
      parser.reset();
      expect(parser.getAllErrors()).toHaveLength(0);
      
      // Should handle new errors after reset
      const error = parser.parseChunk('Error: Network error\n');
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network');
    });
  });

  describe('Static Helper Methods', () => {
    it('should identify progress indicators', () => {
      expect(StderrParser.isProgressIndicator('Progress: 50%')).toBe(true);
      expect(StderrParser.isProgressIndicator('Processing file...')).toBe(true);
      expect(StderrParser.isProgressIndicator('Analyzing code')).toBe(true);
      expect(StderrParser.isProgressIndicator('Generating tests')).toBe(true);
      expect(StderrParser.isProgressIndicator('Loading models')).toBe(true);
      expect(StderrParser.isProgressIndicator('Error: failed')).toBe(false);
    });

    it('should extract meaningful error messages', () => {
      const stderr = `
        Starting process...
        Loading configuration...
        Error: Authentication failed - invalid credentials
        Process terminated with code 1
      `;
      
      const message = StderrParser.extractErrorMessage(stderr);
      expect(message).toBe('Authentication failed - invalid credentials');
    });

    it('should handle stderr without clear error lines', () => {
      const stderr = 'Something went wrong';
      const message = StderrParser.extractErrorMessage(stderr);
      expect(message).toBe('Something went wrong');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const error = parser.parseChunk('');
      expect(error).toBeNull();
    });

    it('should handle only whitespace', () => {
      const error = parser.parseChunk('   \n   \n');
      expect(error).toBeNull();
    });

    it('should not detect errors in normal output', () => {
      const error = parser.parseChunk('Processing complete successfully\n');
      expect(error).toBeNull();
    });

    it('should handle case variations', () => {
      const error1 = parser.parseChunk('ERROR: AUTHENTICATION FAILED\n');
      expect(error1?.type).toBe('auth');
      
      parser.reset();
      
      const error2 = parser.parseChunk('error: authentication failed\n');
      expect(error2?.type).toBe('auth');
    });
  });
});