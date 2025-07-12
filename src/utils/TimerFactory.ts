/**
 * Timer Factory Implementation
 *
 * Factory for creating appropriate timer implementations based on environment
 * and configuration. Supports dependency injection and automatic environment
 * detection for seamless testing integration.
 *
 * @category Timer Factory
 * @since 1.0.0
 */

import {
  TimerValidationError,
  type TimerFactory as ITimerFactory,
  type TestableTimer,
  type MockTimerController,
  type TimerFactoryConfig,
  type TimerValidationResult,
} from '../types/timer-types';
import { RealTimer } from './RealTimer';
import { MockTimer } from './MockTimer';

/**
 * Environment detection utilities
 */
class EnvironmentDetector {
  /**
   * Check if running in a test environment
   */
  static isTestEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      typeof jest !== 'undefined' ||
      typeof global?.jest !== 'undefined'
    );
  }

  /**
   * Check if Jest fake timers are active
   */
  static areJestFakeTimersActive(): boolean {
    if (typeof jest === 'undefined') return false;

    try {
      // Check if Jest has replaced native timers
      return jest.isMockFunction(setTimeout) || jest.isMockFunction(setInterval);
    } catch {
      return false;
    }
  }

  /**
   * Get recommended timer type for current environment
   */
  static getRecommendedTimerType(): 'real' | 'mock' {
    if (this.isTestEnvironment()) {
      return 'mock';
    }
    return 'real';
  }
}

/**
 * Timer factory configuration validator
 */
class TimerConfigValidator {
  /**
   * Validate timer factory configuration
   */
  static validate(config: TimerFactoryConfig): TimerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate timer type
    if (config.type && !['real', 'mock'].includes(config.type)) {
      errors.push('Timer type must be either "real" or "mock"');
    }

    // Validate start time
    if (config.startTime !== undefined) {
      if (
        typeof config.startTime !== 'number' ||
        config.startTime < 0 ||
        !isFinite(config.startTime)
      ) {
        errors.push('Start time must be a non-negative finite number');
      }
    }

    // Validate debug option
    if (config.debug !== undefined && typeof config.debug !== 'boolean') {
      errors.push('Debug option must be a boolean');
    }

    // Environment-specific warnings
    if (config.type === 'real' && EnvironmentDetector.isTestEnvironment()) {
      warnings.push('Using real timers in test environment may cause non-deterministic tests');
    }

    if (config.type === 'mock' && !EnvironmentDetector.isTestEnvironment()) {
      warnings.push('Using mock timers in production environment');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Default timer factory implementation
 */
export class TimerFactory implements ITimerFactory {
  private static instance: TimerFactory | null = null;
  private readonly debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Get singleton instance of timer factory
   */
  static getInstance(debug = false): TimerFactory {
    if (!TimerFactory.instance) {
      TimerFactory.instance = new TimerFactory(debug);
    }
    return TimerFactory.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    TimerFactory.instance = null;
  }

  /**
   * Log debug information
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[TimerFactory] ${message}`, ...args);
    }
  }

  /**
   * Create a timer instance based on configuration
   */
  createTimer(config: TimerFactoryConfig = {}): TestableTimer {
    // Validate configuration
    const validation = TimerConfigValidator.validate(config);
    if (!validation.valid) {
      throw new TimerValidationError(
        `Invalid timer configuration: ${validation.errors.join(', ')}`,
        'INVALID_CONFIG'
      );
    }

    // Log warnings
    validation.warnings.forEach((warning) => {
      this.log(`Warning: ${String(warning)}`);
    });

    // Determine timer type
    const timerType = config.type ?? EnvironmentDetector.getRecommendedTimerType();

    this.log(`Creating ${timerType} timer`, {
      config,
      environment: {
        isTest: EnvironmentDetector.isTestEnvironment(),
        jestFakeTimers: EnvironmentDetector.areJestFakeTimersActive(),
      },
    });

    // Create appropriate timer
    switch (timerType) {
      case 'mock':
        return this.createMockTimer(config.startTime);

      case 'real':
        return this.createRealTimer();

      default:
        throw new TimerValidationError(
          `Unknown timer type: ${String(timerType)}`,
          'UNKNOWN_TIMER_TYPE'
        );
    }
  }

  /**
   * Create a mock timer controller for testing
   */
  createMockTimer(startTime?: number): MockTimerController {
    const effectiveStartTime = startTime ?? Date.now();

    this.log(`Creating mock timer with start time ${effectiveStartTime}`);

    return new MockTimer(effectiveStartTime, this.debug);
  }

  /**
   * Create a real timer for production use
   */
  createRealTimer(): TestableTimer {
    this.log('Creating real timer');

    return new RealTimer();
  }

  /**
   * Create timer with automatic environment detection
   */
  createAutoTimer(
    options: { startTime?: number; forceType?: 'real' | 'mock' } = {}
  ): TestableTimer {
    const config: TimerFactoryConfig = {
      type: options.forceType ?? EnvironmentDetector.getRecommendedTimerType(),
      debug: this.debug,
    };

    if (options.startTime !== undefined) {
      config.startTime = options.startTime;
    }

    return this.createTimer(config);
  }

  /**
   * Get environment information for debugging
   */
  getEnvironmentInfo(): {
    isTestEnvironment: boolean;
    jestFakeTimersActive: boolean;
    recommendedType: 'real' | 'mock';
    nodeEnv: string | undefined;
  } {
    return {
      isTestEnvironment: EnvironmentDetector.isTestEnvironment(),
      jestFakeTimersActive: EnvironmentDetector.areJestFakeTimersActive(),
      recommendedType: EnvironmentDetector.getRecommendedTimerType(),
      nodeEnv: process.env.NODE_ENV,
    };
  }

  /**
   * Validate timer factory configuration
   */
  static validateConfig(config: TimerFactoryConfig): TimerValidationResult {
    return TimerConfigValidator.validate(config);
  }
}

/**
 * Convenience functions for common timer creation patterns
 */

/**
 * Create a timer appropriate for the current environment
 */
export function createTimer(config?: TimerFactoryConfig): TestableTimer {
  return TimerFactory.getInstance().createTimer(config);
}

/**
 * Create a mock timer for testing
 */
export function createMockTimer(startTime?: number): MockTimerController {
  return TimerFactory.getInstance().createMockTimer(startTime);
}

/**
 * Create a real timer for production
 */
export function createRealTimer(): TestableTimer {
  return TimerFactory.getInstance().createRealTimer();
}

/**
 * Create timer with environment auto-detection
 */
export function createAutoTimer(options?: {
  startTime?: number;
  forceType?: 'real' | 'mock';
}): TestableTimer {
  return TimerFactory.getInstance().createAutoTimer(options);
}

// Export the default factory instance
export const defaultTimerFactory = TimerFactory.getInstance();
