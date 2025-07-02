// TypeScript math utilities for complex mixed project
export function calculateComplexSum(numbers: number[]): number {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('Input must be a non-empty array of numbers');
  }
  
  return numbers.reduce((sum, num) => {
    if (typeof num !== 'number' || isNaN(num)) {
      throw new Error('All elements must be valid numbers');
    }
    return sum + num;
  }, 0);
}

export function calculateStandardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  
  return Math.sqrt(avgSquaredDiff);
}

export function fibonacci(n: number): number {
  if (n < 0) throw new Error('Fibonacci is not defined for negative numbers');
  if (n === 0) return 0;
  if (n === 1) return 1;
  
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

export class MathOperations {
  static power(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }

  static isPrime(n: number): boolean {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }
}