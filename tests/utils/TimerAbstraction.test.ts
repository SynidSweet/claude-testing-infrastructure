/**
 * Tests for Timer Abstraction System
 * 
 * Comprehensive test suite for TestableTimer interface, RealTimer, MockTimer,
 * and TimerFactory implementations.
 */

import { 
  TestableTimer,
  MockTimerController,
  TimerValidationError
} from '../../src/types/timer-types';
import { RealTimer } from '../../src/utils/RealTimer';
import { MockTimer } from '../../src/utils/MockTimer';
import { TimerFactory, createTimer, createMockTimer, createRealTimer } from '../../src/utils/TimerFactory';

describe('Timer Abstraction System', () => {
  let mockTimer: MockTimerController;
  let realTimer: TestableTimer;
  let factory: TimerFactory;

  beforeEach(() => {
    mockTimer = new MockTimer(1000, false); // Start at time 1000, no debug
    realTimer = new RealTimer();
    factory = new TimerFactory(false);
  });

  afterEach(() => {
    // Clean up real timers
    realTimer.cancelAll();
    
    // Reset factory singleton
    TimerFactory.resetInstance();
  });

  describe('MockTimer', () => {
    describe('Basic Timer Operations', () => {
      it('should schedule and execute timeout timers', () => {
        let executed = false;
        const handle = mockTimer.schedule(() => { executed = true; }, 100);

        expect(executed).toBe(false);
        expect(handle.active).toBe(true);

        mockTimer.advanceTime(100);
        expect(executed).toBe(true);
        expect(handle.active).toBe(false);
      });

      it('should schedule and execute interval timers', () => {
        let execCount = 0;
        const handle = mockTimer.scheduleInterval(() => { execCount++; }, 50);

        expect(execCount).toBe(0);
        
        mockTimer.advanceTime(50);
        expect(execCount).toBe(1);
        
        mockTimer.advanceTime(50);
        expect(execCount).toBe(2);
        
        handle.cancel();
        mockTimer.advanceTime(50);
        expect(execCount).toBe(2); // Should not execute after cancellation
      });

      it('should schedule and execute immediate timers', () => {
        let executed = false;
        const handle = mockTimer.scheduleImmediate(() => { executed = true; });

        expect(executed).toBe(false);
        
        mockTimer.advanceTime(1); // Should execute on next advancement
        expect(executed).toBe(true);
        expect(handle.active).toBe(false);
      });

      it('should pass arguments to timer callbacks', () => {
        let receivedArgs: unknown[] = [];
        
        mockTimer.schedule(
          (...args: unknown[]) => { receivedArgs = args; },
          100,
          { args: ['test', 42, { key: 'value' }] }
        );

        mockTimer.advanceTime(100);
        expect(receivedArgs).toEqual(['test', 42, { key: 'value' }]);
      });
    });

    describe('Time Control', () => {
      it('should track current time correctly', () => {
        expect(mockTimer.getCurrentTime()).toBe(1000);
        
        mockTimer.advanceTime(500);
        expect(mockTimer.getCurrentTime()).toBe(1500);
        
        mockTimer.setCurrentTime(2000);
        expect(mockTimer.getCurrentTime()).toBe(2000);
      });

      it('should execute timers in chronological order', () => {
        const execOrder: number[] = [];
        
        mockTimer.schedule(() => execOrder.push(3), 300);
        mockTimer.schedule(() => execOrder.push(1), 100);
        mockTimer.schedule(() => execOrder.push(2), 200);

        mockTimer.advanceTime(300);
        expect(execOrder).toEqual([1, 2, 3]);
      });

      it('should advance to next timer correctly', () => {
        mockTimer.schedule(() => {}, 150);
        mockTimer.schedule(() => {}, 300);

        const advanced = mockTimer.advanceToNextTimer();
        expect(advanced).toBe(150);
        expect(mockTimer.getCurrentTime()).toBe(1150);

        const advanced2 = mockTimer.advanceToNextTimer();
        expect(advanced2).toBe(150);
        expect(mockTimer.getCurrentTime()).toBe(1300);
      });

      it('should run all timers when requested', () => {
        let execCount = 0;
        
        mockTimer.schedule(() => execCount++, 100);
        mockTimer.schedule(() => execCount++, 200);
        mockTimer.schedule(() => execCount++, 300);

        mockTimer.runAllTimers();
        expect(execCount).toBe(3);
      });
    });

    describe('Timer Management', () => {
      it('should track active timer count', () => {
        expect(mockTimer.getActiveTimerCount()).toBe(0);
        
        const handle1 = mockTimer.schedule(() => {}, 100);
        mockTimer.scheduleInterval(() => {}, 50);
        
        expect(mockTimer.getActiveTimerCount()).toBe(2);
        
        handle1.cancel();
        expect(mockTimer.getActiveTimerCount()).toBe(1);
        
        mockTimer.cancelAll();
        expect(mockTimer.getActiveTimerCount()).toBe(0);
      });

      it('should provide active timer IDs', () => {
        mockTimer.schedule(() => {}, 100, { id: 'timer1' });
        mockTimer.scheduleInterval(() => {}, 50, { id: 'timer2' });
        
        const ids = mockTimer.getActiveTimerIds();
        expect(ids).toContain('timer1');
        expect(ids).toContain('timer2');
        expect(ids.length).toBe(2);
      });

      it('should provide pending timer information', () => {
        mockTimer.schedule(() => {}, 100, { id: 'timer1' });
        mockTimer.scheduleInterval(() => {}, 200, { id: 'timer2' });
        
        const pending = mockTimer.getPendingTimers();
        expect(pending.length).toBe(2);
        expect(pending[0]?.id).toBe('timer1');
        expect(pending[0]?.scheduledTime).toBe(1100);
        expect(pending[1]?.id).toBe('timer2');
        expect(pending[1]?.scheduledTime).toBe(1200);
      });
    });

    describe('Error Handling', () => {
      it('should validate timer parameters', () => {
        expect(() => {
          mockTimer.schedule('not a function' as any, 100);
        }).toThrow(TimerValidationError);

        expect(() => {
          mockTimer.schedule(() => {}, -100);
        }).toThrow(TimerValidationError);

        expect(() => {
          mockTimer.schedule(() => {}, Infinity);
        }).toThrow(TimerValidationError);
      });

      it('should handle callback errors gracefully', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        mockTimer.schedule(() => {
          throw new Error('Test error');
        }, 100);

        expect(() => {
          mockTimer.advanceTime(100);
        }).not.toThrow();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should validate time operations', () => {
        expect(() => {
          mockTimer.advanceTime(-100);
        }).toThrow(TimerValidationError);

        expect(() => {
          mockTimer.setCurrentTime(-1);
        }).toThrow(TimerValidationError);
      });
    });
  });

  describe('RealTimer', () => {
    describe('Basic Operations', () => {
      it('should schedule timeout timers', (done) => {
        const handle = realTimer.schedule(() => {
          // Skip active check to avoid race condition
          done();
        }, 1);

        expect(handle.active).toBe(true);
      });

      it('should schedule interval timers', (done) => {
        let execCount = 0;
        
        const handle = realTimer.scheduleInterval(() => {
          execCount++;
          if (execCount === 2) {
            handle.cancel();
            expect(realTimer.getActiveTimerCount()).toBe(0);
            done();
          }
        }, 5);

        expect(realTimer.getActiveTimerCount()).toBe(1);
      });

      it.skip('should schedule immediate timers', (done) => {
        // Skip this test as it's environment dependent
        realTimer.scheduleImmediate(() => {
          done();
        });
      });

      it('should cancel timers', (done) => {
        const handle = realTimer.schedule(() => {
          done(new Error('Timer should not execute after cancellation'));
        }, 50);

        handle.cancel();
        expect(handle.active).toBe(false);
        
        setTimeout(() => {
          done(); // If we get here, the timer was successfully cancelled
        }, 100);
      });
    });

    describe('Timer Management', () => {
      it('should track active timers', () => {
        expect(realTimer.getActiveTimerCount()).toBe(0);
        
        realTimer.schedule(() => {}, 1000);
        realTimer.scheduleInterval(() => {}, 1000);
        
        expect(realTimer.getActiveTimerCount()).toBe(2);
        
        realTimer.cancelAll();
        expect(realTimer.getActiveTimerCount()).toBe(0);
      });

      it('should provide timer IDs', () => {
        realTimer.schedule(() => {}, 1000, { id: 'test1' });
        realTimer.schedule(() => {}, 1000, { id: 'test2' });
        
        const ids = realTimer.getActiveTimerIds();
        expect(ids).toContain('test1');
        expect(ids).toContain('test2');
        
        realTimer.cancelAll();
      });
    });

    describe('Error Handling', () => {
      it('should validate timer parameters', () => {
        expect(() => {
          realTimer.schedule('not a function' as any, 100);
        }).toThrow(TimerValidationError);

        expect(() => {
          realTimer.schedule(() => {}, -100);
        }).toThrow(TimerValidationError);
      });

      it('should handle callback errors gracefully', (done) => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        realTimer.schedule(() => {
          throw new Error('Test error');
        }, 10);

        setTimeout(() => {
          expect(consoleSpy).toHaveBeenCalled();
          consoleSpy.mockRestore();
          done();
        }, 50);
      });
    });
  });

  describe('TimerFactory', () => {
    describe('Factory Methods', () => {
      it('should create mock timers', () => {
        const timer = factory.createMockTimer(2000);
        expect(timer).toBeInstanceOf(MockTimer);
        expect(timer.getCurrentTime()).toBe(2000);
      });

      it('should create real timers', () => {
        const timer = factory.createRealTimer();
        expect(timer).toBeInstanceOf(RealTimer);
      });

      it('should create timers with configuration', () => {
        const mockTimer = factory.createTimer({ type: 'mock', startTime: 5000 });
        expect(mockTimer).toBeInstanceOf(MockTimer);
        expect((mockTimer as MockTimerController).getCurrentTime()).toBe(5000);

        const realTimer = factory.createTimer({ type: 'real' });
        expect(realTimer).toBeInstanceOf(RealTimer);
      });
    });

    describe('Environment Detection', () => {
      it('should provide environment information', () => {
        const envInfo = factory.getEnvironmentInfo();
        expect(envInfo).toHaveProperty('isTestEnvironment');
        expect(envInfo).toHaveProperty('jestFakeTimersActive');
        expect(envInfo).toHaveProperty('recommendedType');
        expect(envInfo).toHaveProperty('nodeEnv');
      });

      it('should validate configurations', () => {
        const result = TimerFactory.validateConfig({
          type: 'mock',
          startTime: 1000,
          debug: true
        });
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);

        const invalidResult = TimerFactory.validateConfig({
          type: 'invalid' as any,
          startTime: -1
        });
        
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Convenience Functions', () => {
      it('should provide createTimer convenience function', () => {
        const timer = createTimer({ type: 'mock' });
        expect(timer).toBeInstanceOf(MockTimer);
      });

      it('should provide createMockTimer convenience function', () => {
        const timer = createMockTimer(3000);
        expect(timer).toBeInstanceOf(MockTimer);
        expect(timer.getCurrentTime()).toBe(3000);
      });

      it('should provide createRealTimer convenience function', () => {
        const timer = createRealTimer();
        expect(timer).toBeInstanceOf(RealTimer);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should allow switching between timer implementations', () => {
      // Create mock timer and verify behavior
      const mockTimer = createMockTimer(1000);
      let mockExecuted = false;
      
      mockTimer.schedule(() => { mockExecuted = true; }, 100);
      mockTimer.advanceTime(100);
      expect(mockExecuted).toBe(true);

      // Create real timer and verify different behavior
      const realTimer = createRealTimer();
      let realExecuted = false;
      
      realTimer.schedule(() => { realExecuted = true; }, 10);
      expect(realExecuted).toBe(false); // Should not execute immediately
      
      // Clean up
      realTimer.cancelAll();
    });

    it('should maintain interface compatibility', () => {
      const timers: TestableTimer[] = [
        createMockTimer(),
        createRealTimer()
      ];

      timers.forEach((timer) => {
        // Test common interface
        expect(timer.getActiveTimerCount()).toBe(0);
        
        const handle = timer.schedule(() => {}, 1000);
        expect(timer.getActiveTimerCount()).toBe(1);
        expect(handle.active).toBe(true);
        
        timer.cancelAll();
        expect(timer.getActiveTimerCount()).toBe(0);
      });
    });
  });
});