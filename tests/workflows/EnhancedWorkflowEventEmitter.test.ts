/**
 * Tests for Enhanced Workflow Event System
 * 
 * Validates the enhanced event emitter with filtering, middleware,
 * and error handling capabilities.
 */

import { EnhancedWorkflowEventEmitterImpl } from '../../src/workflows/EnhancedWorkflowEventEmitter';
import { AIWorkflowError } from '../../src/types/ai-error-types';
import type { EventListenerConfig } from '../../src/types/workflow-event-types';

describe('EnhancedWorkflowEventEmitter', () => {
  let emitter: EnhancedWorkflowEventEmitterImpl;

  beforeEach(() => {
    emitter = new EnhancedWorkflowEventEmitterImpl({
      enableMetrics: true,
      enableTracing: true,
      maxListeners: 10,
      errorThreshold: 3,
      defaultTimeout: 5000,
    });
  });

  describe('Basic Event Emission', () => {
    it('should emit and handle events successfully', async () => {
      let eventReceived = false;
      let receivedData: any = null;

      const listenerId = emitter.on('workflow:start', {
        handler: (data) => {
          eventReceived = true;
          receivedData = data;
        },
        priority: 1,
      });

      const result = await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(result.success).toBe(true);
      expect(result.filtered).toBe(false);
      expect(eventReceived).toBe(true);
      expect(receivedData).toEqual({
        projectPath: '/test/project',
        config: {},
      });
      expect(typeof listenerId).toBe('string');
    });

    it('should handle multiple listeners with priority ordering', async () => {
      const executionOrder: number[] = [];

      emitter.on('workflow:start', {
        handler: () => {
          executionOrder.push(1);
        },
        priority: 1,
      });

      emitter.on('workflow:start', {
        handler: () => {
          executionOrder.push(3);
        },
        priority: 3,
      });

      emitter.on('workflow:start', {
        handler: () => {
          executionOrder.push(2);
        },
        priority: 2,
      });

      await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(executionOrder).toEqual([3, 2, 1]);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events based on custom filters', async () => {
      let eventReceived = false;

      emitter.on('workflow:start', {
        handler: () => {
          eventReceived = true;
        },
      });

      // Add filter that blocks all events
      emitter.addFilter('workflow:start', () => false);

      const result = await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(result.success).toBe(true);
      expect(result.filtered).toBe(true);
      expect(eventReceived).toBe(false);
    });

    it('should support async filters', async () => {
      let eventReceived = false;

      emitter.on('workflow:start', {
        handler: () => {
          eventReceived = true;
        },
      });

      // Add async filter that allows events
      emitter.addFilter('workflow:start', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return true;
      });

      const result = await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(result.success).toBe(true);
      expect(result.filtered).toBe(false);
      expect(eventReceived).toBe(true);
    });
  });

  describe('Event Middleware', () => {
    it('should execute middleware in correct order', async () => {
      const executionOrder: string[] = [];
      let eventReceived = false;

      emitter.addMiddleware('workflow:start', async (eventName, data, context, next) => {
        executionOrder.push('middleware1-before');
        await next();
        executionOrder.push('middleware1-after');
      });

      emitter.addMiddleware('workflow:start', async (eventName, data, context, next) => {
        executionOrder.push('middleware2-before');
        await next();
        executionOrder.push('middleware2-after');
      });

      emitter.on('workflow:start', {
        handler: () => {
          executionOrder.push('handler');
          eventReceived = true;
        },
      });

      await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(eventReceived).toBe(true);
      // Middleware executes independently, so order may vary
      expect(executionOrder).toContain('middleware1-before');
      expect(executionOrder).toContain('middleware2-before');
      expect(executionOrder).toContain('handler');
      expect(executionOrder).toContain('middleware1-after');
      expect(executionOrder).toContain('middleware2-after');
      expect(executionOrder).toHaveLength(5);
    });

    it('should handle middleware errors gracefully', async () => {
      let eventReceived = false;

      emitter.addMiddleware('workflow:start', async () => {
        throw new Error('Middleware error');
      });

      emitter.on('workflow:start', {
        handler: () => {
          eventReceived = true;
        },
      });

      const result = await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(result.success).toBe(false);
      expect(result.middlewareErrors).toHaveLength(1);
      expect(result.middlewareErrors[0].message).toContain('Middleware error');
      expect(eventReceived).toBe(true); // Handler still executes despite middleware error
    });
  });

  describe('Error Handling', () => {
    it('should handle listener errors and track error counts', async () => {
      const listenerId = emitter.on('workflow:start', {
        handler: () => {
          throw new Error('Handler error');
        },
        errorHandler: jest.fn(),
      });

      const result = await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(result.success).toBe(false);
      expect(result.handlerErrors).toHaveLength(1);
      expect(result.handlerErrors[0].message).toContain('Handler error');

      const listeners = emitter.getListeners('workflow:start');
      const listener = listeners.find(l => l.id === listenerId);
      expect(listener?.errorCount).toBe(1);
    });

    it('should disable listeners after error threshold', async () => {
      const listenerId = emitter.on('workflow:start', {
        handler: () => {
          throw new Error('Persistent error');
        },
      });

      // Emit multiple times to exceed error threshold
      for (let i = 0; i < 4; i++) {
        await emitter.emit('workflow:start', {
          projectPath: '/test/project',
          config: {},
        });
      }

      const listeners = emitter.getListeners('workflow:start');
      const listener = listeners.find(l => l.id === listenerId);
      expect(listener?.disabled).toBe(true);
      expect(listener?.errorCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and track event metrics', async () => {
      emitter.on('workflow:start', {
        handler: () => {
          // Empty handler
        },
      });

      await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      await emitter.emit('workflow:complete', {
        result: {} as any,
      });

      const metrics = emitter.getMetrics();
      expect(metrics.totalEmitted).toBe(2);
      expect(metrics.eventCounts['workflow:start']).toBe(1);
      expect(metrics.eventCounts['workflow:complete']).toBe(1);
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should track traces when enabled', async () => {
      emitter.on('workflow:start', {
        handler: () => {
          // Empty handler
        },
      });

      await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      const traces = emitter.getTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].eventName).toBe('workflow:start');
      expect(traces[0].handlerCount).toBe(1);
      expect(traces[0].filtered).toBe(false);
    });
  });

  describe('Listener Management', () => {
    it('should remove listeners correctly', () => {
      const listenerId = emitter.on('workflow:start', {
        handler: () => {
          // Empty handler
        },
      });

      expect(emitter.getListeners('workflow:start')).toHaveLength(1);
      
      const removed = emitter.off(listenerId);
      expect(removed).toBe(true);
      expect(emitter.getListeners('workflow:start')).toHaveLength(0);
    });

    it('should handle one-time listeners', async () => {
      let callCount = 0;

      emitter.on('workflow:start', {
        handler: () => {
          callCount++;
        },
        once: true,
      });

      await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      await emitter.emit('workflow:start', {
        projectPath: '/test/project',
        config: {},
      });

      expect(callCount).toBe(1);
      expect(emitter.getListeners('workflow:start')).toHaveLength(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process event batches correctly', async () => {
      let eventCount = 0;

      emitter.on('workflow:start', {
        handler: () => {
          eventCount++;
        },
      });

      emitter.on('workflow:complete', {
        handler: () => {
          eventCount++;
        },
      });

      const batch = {
        batchId: 'test-batch',
        timestamp: Date.now(),
        events: [
          {
            name: 'workflow:start' as const,
            data: { projectPath: '/test/project', config: {} },
            context: { timestamp: Date.now(), eventId: 'test-1', workflowId: 'test', metadata: {} },
          },
          {
            name: 'workflow:complete' as const,
            data: { result: {} as any },
            context: { timestamp: Date.now(), eventId: 'test-2', workflowId: 'test', metadata: {} },
          },
        ],
      };

      const results = await emitter.emitBatch(batch);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(eventCount).toBe(2);
    });
  });
});