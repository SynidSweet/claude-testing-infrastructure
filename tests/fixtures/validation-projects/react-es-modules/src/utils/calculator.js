/**
 * Calculator utility class for testing various scenarios
 * Includes error handling, edge cases, and complex operations
 */
export class Calculator {
  constructor() {
    this.history = [];
    this.precision = 10;
  }

  /**
   * Add two numbers with validation
   */
  add(a, b) {
    this.validateNumbers(a, b);
    const result = a + b;
    this.recordOperation('add', a, b, result);
    return this.roundToPrecision(result);
  }

  /**
   * Subtract two numbers
   */
  subtract(a, b) {
    this.validateNumbers(a, b);
    const result = a - b;
    this.recordOperation('subtract', a, b, result);
    return this.roundToPrecision(result);
  }

  /**
   * Multiply two numbers
   */
  multiply(a, b) {
    this.validateNumbers(a, b);
    const result = a * b;
    this.recordOperation('multiply', a, b, result);
    return this.roundToPrecision(result);
  }

  /**
   * Divide two numbers with zero check
   */
  divide(a, b) {
    this.validateNumbers(a, b);
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    const result = a / b;
    this.recordOperation('divide', a, b, result);
    return this.roundToPrecision(result);
  }

  /**
   * Calculate power
   */
  power(base, exponent) {
    this.validateNumbers(base, exponent);
    const result = Math.pow(base, exponent);
    this.recordOperation('power', base, exponent, result);
    return this.roundToPrecision(result);
  }

  /**
   * Calculate square root
   */
  sqrt(number) {
    this.validateNumbers(number);
    if (number < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    const result = Math.sqrt(number);
    this.recordOperation('sqrt', number, null, result);
    return this.roundToPrecision(result);
  }

  /**
   * Calculate percentage
   */
  percentage(value, percentage) {
    this.validateNumbers(value, percentage);
    const result = (value * percentage) / 100;
    this.recordOperation('percentage', value, percentage, result);
    return this.roundToPrecision(result);
  }

  /**
   * Validate that inputs are numbers
   */
  validateNumbers(...numbers) {
    for (const num of numbers) {
      if (num === null || num === undefined) {
        throw new Error('Input cannot be null or undefined');
      }
      if (typeof num !== 'number' || isNaN(num)) {
        throw new Error(`Invalid number: ${num}`);
      }
      if (!isFinite(num)) {
        throw new Error('Input must be a finite number');
      }
    }
  }

  /**
   * Record operation in history
   */
  recordOperation(operation, a, b, result) {
    const entry = {
      operation,
      operands: b !== null ? [a, b] : [a],
      result,
      timestamp: new Date().toISOString()
    };
    this.history.push(entry);
    
    // Limit history to last 100 operations
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Round to specified precision
   */
  roundToPrecision(number) {
    return Math.round(number * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  /**
   * Get calculation history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get last result
   */
  getLastResult() {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1].result;
  }

  /**
   * Set precision for results
   */
  setPrecision(precision) {
    if (typeof precision !== 'number' || precision < 0 || precision > 15) {
      throw new Error('Precision must be a number between 0 and 15');
    }
    this.precision = precision;
  }

  /**
   * Get statistics about calculations
   */
  getStatistics() {
    if (this.history.length === 0) {
      return {
        totalOperations: 0,
        operationCounts: {},
        averageResult: null,
        maxResult: null,
        minResult: null
      };
    }

    const results = this.history.map(entry => entry.result);
    const operationCounts = this.history.reduce((counts, entry) => {
      counts[entry.operation] = (counts[entry.operation] || 0) + 1;
      return counts;
    }, {});

    return {
      totalOperations: this.history.length,
      operationCounts,
      averageResult: results.reduce((sum, r) => sum + r, 0) / results.length,
      maxResult: Math.max(...results),
      minResult: Math.min(...results)
    };
  }
}

/**
 * Utility functions for mathematical operations
 */
export function factorial(n) {
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Factorial requires a non-negative integer');
  }
  if (n === 0 || n === 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

export function fibonacci(n) {
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Fibonacci requires a non-negative integer');
  }
  if (n === 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export function isPrime(n) {
  if (typeof n !== 'number' || n < 2 || !Number.isInteger(n)) {
    return false;
  }
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) {
      return false;
    }
  }
  return true;
}

export function gcd(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('GCD requires two numbers');
  }
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

export function lcm(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('LCM requires two numbers');
  }
  return Math.abs(a * b) / gcd(a, b);
}

// Constants for mathematical calculations
export const MATH_CONSTANTS = {
  PI: Math.PI,
  E: Math.E,
  GOLDEN_RATIO: (1 + Math.sqrt(5)) / 2,
  SQRT_2: Math.sqrt(2),
  SQRT_3: Math.sqrt(3),
  LN_2: Math.log(2),
  LN_10: Math.log(10)
};

// Default calculator instance
export const defaultCalculator = new Calculator();