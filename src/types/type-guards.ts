/**
 * Type guard utilities for runtime type checking
 *
 * This module provides type guards and validation functions that can be used
 * at runtime to ensure type safety and validate data structures.
 */

import {
  CoreLogLevel,
  Status,
  Priority,
  type AnyObject,
  type StringRecord,
  type NumberRecord,
  type BooleanRecord,
  type NonEmptyArray,
  type Result,
  type ValidationResult,
  type TypePredicate,
} from './core';

/**
 * Basic type guards for primitive types
 */
export const isString = (value: unknown): value is string => typeof value === 'string';
export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !isNaN(value) && isFinite(value);
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';
export const isObject = (value: unknown): value is object =>
  value !== null && typeof value === 'object';
export const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
export const isDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime());
export const isError = (value: unknown): value is Error => value instanceof Error;
export const isPromise = (value: unknown): value is Promise<unknown> =>
  value instanceof Promise ||
  (isObject(value) && 'then' in value && isFunction((value as { then: unknown }).then));

/**
 * Null and undefined checks
 */
export const isNull = (value: unknown): value is null => value === null;
export const isUndefined = (value: unknown): value is undefined => value === undefined;
export const isNullish = (value: unknown): value is null | undefined =>
  value === null || value === undefined;
export const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

/**
 * Enhanced object type guards
 */
export const isPlainObject = (value: unknown): value is AnyObject => {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || proto === Object.prototype;
};

export const isEmptyObject = (value: unknown): value is Record<string, never> =>
  isPlainObject(value) && Object.keys(value).length === 0;

export const hasProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, unknown> =>
  isObject(obj) && key in obj;

export const hasStringProperty = <K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, string> => hasProperty(obj, key) && isString(obj[key]);

export const hasNumberProperty = <K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, number> => hasProperty(obj, key) && isNumber(obj[key]);

export const hasBooleanProperty = <K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, boolean> => hasProperty(obj, key) && isBoolean(obj[key]);

/**
 * Array type guards
 */
export const isNonEmptyArray = <T>(value: unknown): value is NonEmptyArray<T> =>
  isArray(value) && value.length > 0;

export const isArrayOf = <T>(value: unknown, predicate: TypePredicate<T>): value is T[] =>
  isArray(value) && value.every(predicate);

export const isStringArray = (value: unknown): value is string[] => isArrayOf(value, isString);

export const isNumberArray = (value: unknown): value is number[] => isArrayOf(value, isNumber);

export const isBooleanArray = (value: unknown): value is boolean[] => isArrayOf(value, isBoolean);

/**
 * Record type guards
 */
export const isStringRecord = (value: unknown): value is StringRecord =>
  isPlainObject(value) && Object.values(value).every(isString);

export const isNumberRecord = (value: unknown): value is NumberRecord =>
  isPlainObject(value) && Object.values(value).every(isNumber);

export const isBooleanRecord = (value: unknown): value is BooleanRecord =>
  isPlainObject(value) && Object.values(value).every(isBoolean);

/**
 * Result type guards
 */
export const isSuccess = <T>(result: Result<T>): result is { success: true; data: T } =>
  hasProperty(result, 'success') && result.success === true && hasProperty(result, 'data');

export const isFailure = <E>(result: Result<unknown, E>): result is { success: false; error: E } =>
  hasProperty(result, 'success') && result.success === false && hasProperty(result, 'error');

/**
 * Enum type guards
 */
export const isCoreLogLevel = (value: unknown): value is CoreLogLevel =>
  isString(value) && Object.values(CoreLogLevel).includes(value as CoreLogLevel);

export const isStatus = (value: unknown): value is Status =>
  isString(value) && Object.values(Status).includes(value as Status);

export const isPriority = (value: unknown): value is Priority =>
  isString(value) && Object.values(Priority).includes(value as Priority);

/**
 * Validation utilities
 */
export const createValidator =
  <T>(predicate: TypePredicate<T>, errorMessage: string) =>
  (value: unknown): Result<T> => {
    if (predicate(value)) {
      return { success: true, data: value };
    }
    return { success: false, error: errorMessage };
  };

export const validateRequired = <T>(value: T | null | undefined, fieldName: string): Result<T> => {
  if (isDefined(value)) {
    return { success: true, data: value };
  }
  return { success: false, error: `${fieldName} is required` };
};

export const validateString = (value: unknown, fieldName: string): Result<string> =>
  createValidator(isString, `${fieldName} must be a string`)(value);

export const validateNumber = (value: unknown, fieldName: string): Result<number> =>
  createValidator(isNumber, `${fieldName} must be a number`)(value);

export const validateBoolean = (value: unknown, fieldName: string): Result<boolean> =>
  createValidator(isBoolean, `${fieldName} must be a boolean`)(value);

export const validateArray = <T>(
  value: unknown,
  fieldName: string,
  itemValidator?: TypePredicate<T>
): Result<T[]> => {
  if (!isArray(value)) {
    return { success: false, error: `${fieldName} must be an array` };
  }

  if (itemValidator && !value.every(itemValidator)) {
    return { success: false, error: `${fieldName} contains invalid items` };
  }

  return { success: true, data: value as T[] };
};

export const validateObject = <T extends AnyObject>(
  value: unknown,
  fieldName: string,
  shape?: { [K in keyof T]: TypePredicate<T[K]> }
): Result<T> => {
  if (!isPlainObject(value)) {
    return { success: false, error: `${fieldName} must be an object` };
  }

  if (shape) {
    const entries = Object.entries(shape) as Array<[keyof T, TypePredicate<T[keyof T]>]>;
    for (const [key, predicate] of entries) {
      if (hasProperty(value, key as string)) {
        const typedValue = value as Record<string, unknown>;
        if (!predicate(typedValue[key as string])) {
          return { success: false, error: `${fieldName}.${String(key)} is invalid` };
        }
      }
    }
  }

  return { success: true, data: value as T };
};

/**
 * Range validation utilities
 */
export const validateRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string
): Result<number> => {
  if (value < min || value > max) {
    return {
      success: false,
      error: `${fieldName} must be between ${min} and ${max}`,
    };
  }
  return { success: true, data: value };
};

export const validateMinLength = (
  value: string | unknown[],
  minLength: number,
  fieldName: string
): Result<string | unknown[]> => {
  if (value.length < minLength) {
    return {
      success: false,
      error: `${fieldName} must have at least ${minLength} characters/items`,
    };
  }
  return { success: true, data: value };
};

export const validateMaxLength = (
  value: string | unknown[],
  maxLength: number,
  fieldName: string
): Result<string | unknown[]> => {
  if (value.length > maxLength) {
    return {
      success: false,
      error: `${fieldName} must have at most ${maxLength} characters/items`,
    };
  }
  return { success: true, data: value };
};

/**
 * Pattern validation utilities
 */
export const validatePattern = (
  value: string,
  pattern: RegExp,
  fieldName: string
): Result<string> => {
  if (!pattern.test(value)) {
    return {
      success: false,
      error: `${fieldName} does not match required pattern`,
    };
  }
  return { success: true, data: value };
};

export const validateEmail = (value: string, fieldName: string): Result<string> => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return validatePattern(value, emailPattern, `${fieldName} (email)`);
};

export const validateUrl = (value: string, fieldName: string): Result<string> => {
  try {
    new URL(value);
    return { success: true, data: value };
  } catch {
    return { success: false, error: `${fieldName} must be a valid URL` };
  }
};

/**
 * Composite validation utilities
 */
export const validateAll = (validators: Array<() => Result<unknown>>): ValidationResult => {
  const errors: string[] = [];

  for (const validator of validators) {
    const result = validator();
    if (!result.success) {
      errors.push(result.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
};

export const validateAny = <T>(validators: Array<() => Result<T>>): Result<T> => {
  const errors: string[] = [];

  for (const validator of validators) {
    const result = validator();
    if (result.success) {
      return result;
    }
    errors.push(result.error);
  }

  return {
    success: false,
    error: `All validations failed: ${errors.join(', ')}`,
  };
};

/**
 * Type assertion utilities (use with caution)
 */
export const assertIsString = (value: unknown, message?: string): asserts value is string => {
  if (!isString(value)) {
    throw new TypeError(message ?? 'Expected string');
  }
};

export const assertIsNumber = (value: unknown, message?: string): asserts value is number => {
  if (!isNumber(value)) {
    throw new TypeError(message ?? 'Expected number');
  }
};

export const assertIsArray = (value: unknown, message?: string): asserts value is unknown[] => {
  if (!isArray(value)) {
    throw new TypeError(message ?? 'Expected array');
  }
};

export const assertIsObject = (value: unknown, message?: string): asserts value is AnyObject => {
  if (!isPlainObject(value)) {
    throw new TypeError(message ?? 'Expected plain object');
  }
};

export const assertIsDefined = <T>(
  value: T | null | undefined,
  message?: string
): asserts value is T => {
  if (!isDefined(value)) {
    throw new TypeError(message ?? 'Expected defined value');
  }
};
