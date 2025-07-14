/**
 * Type-safe test fixture utilities
 * Provides strongly typed test data creation and management
 */

import type { 
  TestFixtureManager, 
  TestFixtureBuilder,
  TestScenario,
  TestSuite,
  PartialTestData 
} from '../types/test-data-interfaces';

/**
 * Creates a typed fixture manager for a given type
 */
export function createFixtureManager<T extends object>(): TestFixtureManager<T> {
  const traits = new Map<string, (data: T) => T>();
  const sequences = new Map<keyof T, (index: number) => any>();
  let globalIndex = 0;

  return {
    create(data?: Partial<T>): T {
      let result = { ...data } as T;
      
      // Apply sequences
      const sequenceEntries = Array.from(sequences.entries());
      for (const [field, generator] of sequenceEntries) {
        if (!(field in result)) {
          (result as any)[field] = generator(globalIndex++);
        }
      }
      
      return result;
    },

    createMany(count: number, data?: Partial<T>): T[] {
      return Array.from({ length: count }, () => this.create(data));
    },

    build(): TestFixtureBuilder<T> {
      return createFixtureBuilder<T>(this, traits, sequences);
    },

    sequence<K extends keyof T>(field: K, generator: (index: number) => T[K]): TestFixtureManager<T> {
      sequences.set(field, generator);
      return this;
    },

    trait(name: string, modifier: (data: T) => T): TestFixtureManager<T> {
      traits.set(name, modifier);
      return this;
    },

    useTrait(name: string): TestFixtureManager<T> {
      const modifier = traits.get(name);
      if (!modifier) {
        throw new Error(`Trait '${name}' not found`);
      }
      // Return a new manager that applies the trait
      return {
        ...this,
        create: (data?: Partial<T>) => modifier(this.create(data))
      };
    }
  };
}

/**
 * Creates a typed fixture builder
 */
function createFixtureBuilder<T extends object>(
  manager: TestFixtureManager<T>,
  traits: Map<string, (data: T) => T>,
  sequences: Map<keyof T, (index: number) => any>
): TestFixtureBuilder<T> {
  let currentData: Partial<T> = {};
  let appliedTraits: string[] = [];

  return {
    set<K extends keyof T>(field: K, value: T[K]): TestFixtureBuilder<T> {
      currentData[field] = value;
      return this;
    },

    trait(name: string): TestFixtureBuilder<T> {
      appliedTraits.push(name);
      return this;
    },

    sequence<K extends keyof T>(field: K, generator: (index: number) => T[K]): TestFixtureBuilder<T> {
      sequences.set(field, generator);
      return this;
    },

    build(): T {
      let result = manager.create(currentData);
      
      // Apply traits
      for (const traitName of appliedTraits) {
        const modifier = traits.get(traitName);
        if (modifier) {
          result = modifier(result);
        }
      }
      
      return result;
    },

    buildList(count: number): T[] {
      return Array.from({ length: count }, () => this.build());
    }
  };
}

/**
 * Creates test scenarios with type safety
 */
export function createTestScenario<TInput = any, TOutput = any>(
  scenario: TestScenario<TInput, TOutput>
): TestScenario<TInput, TOutput> {
  return scenario;
}

/**
 * Creates test suites with type safety
 */
export function createTestSuite<TContext = any>(
  suite: TestSuite<TContext>
): TestSuite<TContext> {
  return suite;
}

/**
 * Utility for creating mock data with constraints
 */
export class MockDataBuilder<T> {
  private data: Partial<T> = {};
  private constraints: Array<(data: T) => boolean> = [];

  with<K extends keyof T>(field: K, value: T[K]): MockDataBuilder<T> {
    this.data[field] = value;
    return this;
  }

  constraint(fn: (data: T) => boolean): MockDataBuilder<T> {
    this.constraints.push(fn);
    return this;
  }

  build(defaults: T): T {
    const result = { ...defaults, ...this.data };
    
    // Validate constraints
    for (const constraint of this.constraints) {
      if (!constraint(result)) {
        throw new Error('Mock data does not satisfy constraints');
      }
    }
    
    return result;
  }
}

/**
 * Factory for creating mock data builders
 */
export function mockData<T>(): MockDataBuilder<T> {
  return new MockDataBuilder<T>();
}

/**
 * Common fixture utilities
 */
export const fixtureUtils = {
  /**
   * Creates a sequence generator for IDs
   */
  sequentialId(prefix = 'id'): (index: number) => string {
    return (index: number) => `${prefix}-${index + 1}`;
  },

  /**
   * Creates a sequence generator for names
   */
  sequentialName(prefix = 'name'): (index: number) => string {
    return (index: number) => `${prefix}-${index + 1}`;
  },

  /**
   * Creates a random string generator
   */
  randomString(length = 10): () => string {
    return () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    };
  },

  /**
   * Creates a random number generator
   */
  randomNumber(min = 0, max = 100): () => number {
    return () => Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Creates a random boolean generator
   */
  randomBoolean(): () => boolean {
    return () => Math.random() > 0.5;
  },

  /**
   * Creates a random date generator
   */
  randomDate(start = new Date(2020, 0, 1), end = new Date()): () => Date {
    return () => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },

  /**
   * Creates a random array element picker
   */
  randomChoice<T>(choices: T[]): () => T {
    return () => choices[Math.floor(Math.random() * choices.length)];
  }
};

/**
 * Test data validation utilities
 */
export const testDataValidation = {
  /**
   * Validates that required fields are present
   */
  hasRequiredFields<T>(data: T, fields: Array<keyof T>): boolean {
    return fields.every(field => data[field] !== undefined && data[field] !== null);
  },

  /**
   * Validates that data matches a schema
   */
  matchesSchema<T>(data: unknown, validator: (data: unknown) => data is T): data is T {
    return validator(data);
  },

  /**
   * Validates that arrays have expected length
   */
  hasExpectedLength<T>(array: T[], expectedLength: number): boolean {
    return array.length === expectedLength;
  },

  /**
   * Validates that all items in array match predicate
   */
  allItemsMatch<T>(array: T[], predicate: (item: T) => boolean): boolean {
    return array.every(predicate);
  },

  /**
   * Validates that data is within expected ranges
   */
  isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
};

/**
 * Pre-configured fixture managers for common types
 */
export const commonFixtures = {
  /**
   * Fixture for user-like objects
   */
  user: createFixtureManager<{
    id: string;
    name: string;
    email: string;
    age: number;
    isActive: boolean;
    createdAt: Date;
  }>()
    .sequence('id', fixtureUtils.sequentialId('user'))
    .sequence('name', fixtureUtils.sequentialName('User'))
    .sequence('email', (index) => `user${index + 1}@example.com`)
    .sequence('age', fixtureUtils.randomNumber(18, 65))
    .sequence('isActive', () => true)
    .sequence('createdAt', fixtureUtils.randomDate())
    .trait('inactive', (user) => ({ ...user, isActive: false }))
    .trait('admin', (user) => ({ ...user, name: `Admin ${user.name}` })),

  /**
   * Fixture for project-like objects
   */
  project: createFixtureManager<{
    id: string;
    name: string;
    description: string;
    version: string;
    isPublic: boolean;
    tags: string[];
  }>()
    .sequence('id', fixtureUtils.sequentialId('proj'))
    .sequence('name', fixtureUtils.sequentialName('Project'))
    .sequence('description', (index) => `Description for project ${index + 1}`)
    .sequence('version', () => '1.0.0')
    .sequence('isPublic', () => true)
    .sequence('tags', () => ['test', 'fixture'])
    .trait('private', (project) => ({ ...project, isPublic: false }))
    .trait('library', (project) => ({ ...project, tags: [...project.tags, 'library'] })),

  /**
   * Fixture for test result-like objects
   */
  testResult: createFixtureManager<{
    id: string;
    testName: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    error?: string;
    assertions: number;
  }>()
    .sequence('id', fixtureUtils.sequentialId('test'))
    .sequence('testName', fixtureUtils.sequentialName('Test'))
    .sequence('status', () => 'pass')
    .sequence('duration', fixtureUtils.randomNumber(10, 1000))
    .sequence('assertions', fixtureUtils.randomNumber(1, 10))
    .trait('failed', (result) => ({ ...result, status: 'fail', error: 'Test failed' }))
    .trait('skipped', (result) => ({ ...result, status: 'skip' }))
    .trait('slow', (result) => ({ ...result, duration: result.duration * 10 }))
};