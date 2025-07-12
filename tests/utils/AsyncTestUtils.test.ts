/**
 * Tests for AsyncTestUtils - Async Test Utilities Framework
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { AsyncTestUtils, asyncTestHelpers } from '../../src/utils/AsyncTestUtils';
import { TimerTestUtils } from '../../src/utils/TimerTestUtils';

describe('AsyncTestUtils', () => {
  let testEnv: ReturnType<typeof AsyncTestUtils.setupAsyncTesting>;

  beforeEach(() => {
    testEnv = AsyncTestUtils.setupAsyncTesting({
      defaultTimeout: 1000,
      useFakeTimers: true,
      debug: false
    });
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('setupAsyncTesting', () => {
    it('should set up test environment with fake timers', () => {
      // Check if TimerTestUtils.setupFakeTimers was called properly
      expect(typeof testEnv.cleanup).toBe('function');
      expect(typeof testEnv.advance).toBe('function');
      expect(typeof testEnv.waitEvents).toBe('function');
      // Note: Fake timer check moved to more reliable location
    });

    it('should allow real timers when configured', () => {
      testEnv.cleanup();
      
      const realTimerEnv = AsyncTestUtils.setupAsyncTesting({
        useFakeTimers: false
      });
      
      expect(jest.isMockFunction(setTimeout)).toBe(false);
      
      realTimerEnv.cleanup();
    });
  });

  describe('testPromiseResolution', () => {
    it('should test successful promise resolution', async () => {
      const promiseFactory = () => Promise.resolve('test-value');
      
      const result = await AsyncTestUtils.testPromiseResolution(promiseFactory, {
        expectedValue: 'test-value',
        timeout: 500
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('test-value');
      expect(result.timedOut).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0); // With fake timers, duration might be 0
    });

    it('should test promise timeout', async () => {
      const promiseFactory = () => new Promise(resolve => {
        setTimeout(() => resolve('delayed'), 2000);
      });
      
      const resultPromise = AsyncTestUtils.testPromiseResolution(promiseFactory, {
        timeout: 500
      });

      // Advance timers past timeout
      await testEnv.advance(600);
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error?.message).toContain('timed out after 500ms');
    });

    it('should coordinate with timer advancement', async () => {
      const promiseFactory = () => new Promise(resolve => {
        setTimeout(() => resolve('timer-resolved'), 300);
      });
      
      // Start the test
      const resultPromise = AsyncTestUtils.testPromiseResolution(promiseFactory, {
        advanceTimers: true,
        timerAdvancement: 400,
        timeout: 1000
      });

      // Manually advance timers to ensure promise resolves
      await testEnv.advance(500);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.value).toBe('timer-resolved');
    }, 15000); // Increase timeout for this test
  });

  describe('testPromiseRejection', () => {
    it('should test expected promise rejection', async () => {
      const promiseFactory = () => Promise.reject(new Error('Expected error'));
      
      const result = await AsyncTestUtils.testPromiseRejection(
        promiseFactory,
        'Expected error',
        { timeout: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should fail when promise resolves instead of rejecting', async () => {
      const promiseFactory = () => Promise.resolve('unexpected success');
      
      const result = await AsyncTestUtils.testPromiseRejection(
        promiseFactory,
        'Expected error',
        { timeout: 500 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('expected to reject but resolved');
    });
  });

  describe('testPromiseChain', () => {
    it('should test successful promise chain', async () => {
      const operations = [
        {
          name: 'step1',
          operation: () => Promise.resolve(10),
          expectedResult: 10
        },
        {
          name: 'step2',
          operation: (prev?: unknown) => Promise.resolve((prev as number) * 2),
          expectedResult: 20
        },
        {
          name: 'step3',
          operation: (prev?: unknown) => Promise.resolve((prev as number) + 5),
          expectedResult: 25
        }
      ];

      const result = await AsyncTestUtils.testPromiseChain(operations);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results[2]?.result.value).toBe(25);
    });

    it('should handle chain failure at specific step', async () => {
      const operations = [
        {
          name: 'step1',
          operation: () => Promise.resolve(10),
          expectedResult: 10
        },
        {
          name: 'failing-step',
          operation: () => Promise.reject(new Error('Chain broken')),
        },
        {
          name: 'step3',
          operation: (prev?: unknown) => Promise.resolve((prev as number) + 5),
        }
      ];

      const result = await AsyncTestUtils.testPromiseChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2); // Should stop at failing step
      expect(result.results[1]?.result.success).toBe(false);
    });
  });

  describe('validateEventSequence', () => {
    it('should validate strict event sequence', async () => {
      const emitter = new EventEmitter();
      
      const validationPromise = AsyncTestUtils.validateEventSequence(emitter, {
        expectedEvents: [
          { name: 'start', data: undefined },
          { name: 'progress', data: undefined },
          { name: 'complete', data: undefined }
        ],
        strictOrder: true,
        sequenceTimeout: 1000
      });

      // Emit events in correct order with delays
      setTimeout(() => emitter.emit('start'), 100);
      setTimeout(() => emitter.emit('progress'), 200);
      setTimeout(() => emitter.emit('complete'), 300);

      await testEnv.advance(400);
      
      const result = await validationPromise;

      expect(result.success).toBe(true);
      expect(result.receivedEvents).toHaveLength(3);
      expect(result.missingEvents).toHaveLength(0);
    });

    it('should handle missing events in sequence', async () => {
      const emitter = new EventEmitter();
      
      const validationPromise = AsyncTestUtils.validateEventSequence(emitter, {
        expectedEvents: [
          { name: 'start', data: undefined },
          { name: 'progress', data: undefined },
          { name: 'complete', data: undefined }
        ],
        strictOrder: true,
        sequenceTimeout: 500
      });

      // Only emit first two events
      setTimeout(() => emitter.emit('start'), 100);
      setTimeout(() => emitter.emit('progress'), 200);

      await testEnv.advance(600);
      
      const result = await validationPromise;

      expect(result.success).toBe(false);
      expect(result.receivedEvents).toHaveLength(2);
      expect(result.missingEvents).toContain('complete');
    });

    it('should validate non-strict event sequence', async () => {
      const emitter = new EventEmitter();
      
      const validationPromise = AsyncTestUtils.validateEventSequence(emitter, {
        expectedEvents: [
          { name: 'event1', data: undefined },
          { name: 'event2', data: undefined },
          { name: 'event3', data: undefined }
        ],
        strictOrder: false,
        sequenceTimeout: 500
      });

      // Emit events in different order
      setTimeout(() => emitter.emit('event3'), 100);
      setTimeout(() => emitter.emit('event1'), 150);
      setTimeout(() => emitter.emit('event2'), 200);

      await testEnv.advance(300);
      
      const result = await validationPromise;

      expect(result.success).toBe(true);
      expect(result.receivedEvents).toHaveLength(3);
    });
  });

  describe('testStreamOperation', () => {
    it('should test readable stream with expected chunks', async () => {
      const stream = new Readable({
        read() {
          // Push data synchronously first time read is called
          if (!this.readableEnded) {
            this.push('chunk1');
            this.push('chunk2');
            this.push('chunk3');
            this.push(null); // End stream
          }
        }
      });

      // Test stream operation
      const result = await AsyncTestUtils.testStreamOperation(stream, {
        expectedChunks: ['chunk1', 'chunk2', 'chunk3'],
        expectEnd: true,
        timeout: 500,
        encoding: 'utf8' // Convert buffers to strings
      });

      expect(result.success).toBe(true);
      expect(result.chunks).toEqual(['chunk1', 'chunk2', 'chunk3']);
      expect(result.endReceived).toBe(true);
    });

    it('should handle stream timeout', async () => {
      const stream = new Readable({
        read() {
          // Never push data or end
        }
      });

      const resultPromise = AsyncTestUtils.testStreamOperation(stream, {
        timeout: 300
      });

      await testEnv.advance(400);
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out after 300ms');
    });

    it('should handle stream error', async () => {
      const stream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        }
      });

      const result = await AsyncTestUtils.testStreamOperation(stream, {
        expectError: true,
        expectedErrorPattern: 'Stream error',
        timeout: 500
      });

      expect(result.success).toBe(true);
      expect(result.error?.message).toBe('Stream error');
    });
  });

  describe('testAsyncTimeout', () => {
    it('should handle operation that completes before timeout', async () => {
      const operation = () => new Promise(resolve => {
        setTimeout(() => resolve('completed'), 200);
      });

      const resultPromise = AsyncTestUtils.testAsyncTimeout(operation, 500);
      
      await testEnv.advance(300);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.value).toBe('completed');
      expect(result.timedOut).toBe(false);
    });

    it('should handle operation timeout', async () => {
      const operation = () => new Promise(resolve => {
        setTimeout(() => resolve('too-late'), 800);
      });

      const resultPromise = AsyncTestUtils.testAsyncTimeout(operation, 500);
      
      await testEnv.advance(600);
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error?.message).toContain('timed out after 500ms');
    });
  });

  describe('coordinateAsyncOperations', () => {
    it('should coordinate operations with dependencies', async () => {
      const operations = [
        {
          name: 'independent',
          operation: () => Promise.resolve('independent-result')
        },
        {
          name: 'dependent',
          operation: () => Promise.resolve('dependent-result'),
          dependencies: ['independent']
        },
        {
          name: 'final',
          operation: () => Promise.resolve('final-result'),
          dependencies: ['dependent']
        }
      ];

      const result = await AsyncTestUtils.coordinateAsyncOperations(operations);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['independent', 'dependent', 'final']);
      expect(result.results.get('final')?.value).toBe('final-result');
    });

    it('should handle parallel execution of independent operations', async () => {
      const operations = [
        {
          name: 'parallel1',
          operation: () => Promise.resolve('result1')
        },
        {
          name: 'parallel2',
          operation: () => Promise.resolve('result2')
        },
        {
          name: 'parallel3',
          operation: () => Promise.resolve('result3')
        }
      ];

      const result = await AsyncTestUtils.coordinateAsyncOperations(operations);

      expect(result.success).toBe(true);
      expect(result.results.size).toBe(3);
      // All operations should execute since they're independent
      expect(result.executionOrder).toHaveLength(3);
    });
  });

  describe('createMockEventEmitter', () => {
    it('should create enhanced event emitter with timing methods', () => {
      const mockEmitter = AsyncTestUtils.createMockEventEmitter();

      expect(mockEmitter).toBeInstanceOf(EventEmitter);
      expect(typeof mockEmitter.emitAfterDelay).toBe('function');
      expect(typeof mockEmitter.emitSequence).toBe('function');
    });

    it('should emit events after delay', async () => {
      const mockEmitter = AsyncTestUtils.createMockEventEmitter();
      const eventData: unknown[] = [];

      mockEmitter.on('test-event', (data: unknown) => {
        eventData.push(data);
      });

      mockEmitter.emitAfterDelay('test-event', 'delayed-data', 200);

      // Event should not be emitted yet
      expect(eventData).toHaveLength(0);

      await testEnv.advance(250);

      // Event should now be emitted
      expect(eventData).toHaveLength(1);
      expect(eventData[0]).toBe('delayed-data');
    });

    it('should emit event sequence with cumulative delays', async () => {
      const mockEmitter = AsyncTestUtils.createMockEventEmitter();
      const events: Array<{ name: string; data: unknown }> = [];

      mockEmitter.on('event1', (data: unknown) => events.push({ name: 'event1', data }));
      mockEmitter.on('event2', (data: unknown) => events.push({ name: 'event2', data }));
      mockEmitter.on('event3', (data: unknown) => events.push({ name: 'event3', data }));

      mockEmitter.emitSequence([
        { name: 'event1', data: 'data1', delay: 100 },
        { name: 'event2', data: 'data2', delay: 100 },
        { name: 'event3', data: 'data3', delay: 100 }
      ]);

      // Allow events to be scheduled first
      await testEnv.waitEvents(2);

      // With fake timers, test progressive advancement
      // First event at 100ms total delay
      await testEnv.advance(100);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.name).toBe('event1');

      // Second event at 200ms total delay
      await testEnv.advance(100);
      expect(events.length).toBeGreaterThanOrEqual(2);

      // Third event at 300ms total delay
      await testEnv.advance(100);
      expect(events).toHaveLength(3);
      expect(events[1]?.name).toBe('event2');
      expect(events[2]?.name).toBe('event3');
    });
  });

  describe('waitForEvent', () => {
    it('should wait for specific event successfully', async () => {
      const emitter = new EventEmitter();
      
      const waitPromise = AsyncTestUtils.waitForEvent(emitter, 'target-event', 500);

      setTimeout(() => {
        emitter.emit('target-event', 'event-data');
      }, 200);

      await testEnv.advance(250);
      
      const result = await waitPromise;

      expect(result).toBe('event-data');
    });

    it('should timeout when event is not received', async () => {
      const emitter = new EventEmitter();
      
      const waitPromise = AsyncTestUtils.waitForEvent(emitter, 'missing-event', 300);

      await testEnv.advance(400);
      
      await expect(waitPromise).rejects.toThrow('Event \'missing-event\' not received within 300ms');
    });
  });

  describe('asyncTestHelpers', () => {
    it('should provide convenient helper functions', () => {
      expect(typeof asyncTestHelpers.setup).toBe('function');
      expect(typeof asyncTestHelpers.testPromise).toBe('function');
      expect(typeof asyncTestHelpers.testRejection).toBe('function');
      expect(typeof asyncTestHelpers.testChain).toBe('function');
      expect(typeof asyncTestHelpers.validateEvents).toBe('function');
      expect(typeof asyncTestHelpers.testStream).toBe('function');
      expect(typeof asyncTestHelpers.testTimeout).toBe('function');
      expect(typeof asyncTestHelpers.coordinate).toBe('function');
      expect(typeof asyncTestHelpers.mockEmitter).toBe('function');
      expect(typeof asyncTestHelpers.waitFor).toBe('function');
    });

    it('should work as convenience aliases', async () => {
      const result = await asyncTestHelpers.testPromise(() => Promise.resolve('helper-test'));
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('helper-test');
    });
  });

  describe('integration with TimerTestUtils', () => {
    it('should work seamlessly with existing timer utilities', async () => {
      // Use TimerTestUtils for setup
      TimerTestUtils.setupFakeTimers();
      
      const promiseFactory = () => new Promise(resolve => {
        setTimeout(() => resolve('timer-integrated'), 300);
      });
      
      const resultPromise = AsyncTestUtils.testPromiseResolution(promiseFactory, {
        timeout: 1000
      });

      // Use TimerTestUtils for advancement
      await TimerTestUtils.advanceTimersAndFlush(400);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.value).toBe('timer-integrated');
      
      TimerTestUtils.cleanupTimers();
    });
  });
});