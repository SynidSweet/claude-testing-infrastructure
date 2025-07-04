import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AsyncPatternDetector } from '../../../../src/generators/javascript/analyzers/AsyncPatternDetector';
import { fs } from '../../../../src/utils/common-imports';

// Mock the fs module
jest.mock('../../../../src/utils/common-imports', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn()
  },
  fs: {
    readFile: jest.fn()
  }
}));

describe('AsyncPatternDetector', () => {
  let detector: AsyncPatternDetector;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    detector = new AsyncPatternDetector();
    jest.clearAllMocks();
  });

  describe('analyzeFile', () => {
    describe('async/await patterns', () => {
      it('should detect async function declarations', async () => {
        const code = `
          async function fetchData() {
            const result = await fetch('/api/data');
            return result.json();
          }
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.primaryPattern).toBe('async-await');
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'async-await',
          confidence: 0.9,
          count: expect.any(Number)
        }));
      });

      it('should detect async arrow functions', async () => {
        const code = `
          const getData = async () => {
            return await Promise.resolve('data');
          };
          
          const processData = async (data) => await transform(data);
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.primaryPattern).toBe('async-await');
        const asyncPattern = result.patterns.find(p => p.type === 'async-await');
        expect(asyncPattern?.count).toBeGreaterThanOrEqual(3); // 2 async + at least 1 await
      });

      it('should detect async methods in classes', async () => {
        const code = `
          class DataService {
            async fetchUser(id) {
              const response = await fetch(\`/users/\${id}\`);
              return response.json();
            }
            
            async updateUser(id, data) {
              return await fetch(\`/users/\${id}\`, {
                method: 'PUT',
                body: JSON.stringify(data)
              });
            }
          }
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.primaryPattern).toBe('async-await');
      });
    });

    describe('Promise patterns', () => {
      it('should detect Promise constructor', async () => {
        const code = `
          function delay(ms) {
            return new Promise((resolve) => {
              setTimeout(resolve, ms);
            });
          }
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'promise',
          examples: expect.arrayContaining(['new Promise()'])
        }));
      });

      it('should detect Promise.then/catch chains', async () => {
        const code = `
          fetchData()
            .then(data => processData(data))
            .then(result => console.log(result))
            .catch(error => console.error(error))
            .finally(() => cleanup());
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.primaryPattern).toBe('promise');
        const promisePattern = result.patterns.find(p => p.type === 'promise');
        expect(promisePattern?.count).toBeGreaterThanOrEqual(3);
      });

      it('should detect Promise static methods', async () => {
        // Create detector with higher maxExamples to capture all 4 Promise methods
        detector = new AsyncPatternDetector({ maxExamples: 5 });
        
        const code = `
          const results = await Promise.all([
            fetch('/api/users'),
            fetch('/api/posts'),
            fetch('/api/comments')
          ]);
          
          const first = await Promise.race([timeout(5000), fetch('/api/data')]);
          const resolved = Promise.resolve(42);
          const rejected = Promise.reject(new Error('Failed'));
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'promise',
          examples: expect.arrayContaining(['Promise.all()', 'Promise.race()', 'Promise.resolve()', 'Promise.reject()'])
        }));
      });
    });

    describe('callback patterns', () => {
      it('should detect error-first callbacks', async () => {
        const code = `
          fs.readFile('data.txt', (err, data) => {
            if (err) {
              console.error(err);
              return;
            }
            console.log(data);
          });
          
          getData((error, result) => {
            if (error) throw error;
            processResult(result);
          });
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'callback',
          confidence: expect.any(Number)
        }));
      });

      it('should detect callback function patterns', async () => {
        const code = `
          function loadData(callback) {
            setTimeout(() => {
              callback(null, { data: 'result' });
            }, 1000);
          }
          
          emitter.on('error', (err) => {
            console.error('Error occurred:', err);
          });
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'callback'
        }));
      });
    });

    describe('generator patterns', () => {
      it('should detect generator functions', async () => {
        const code = `
          function* numberGenerator() {
            yield 1;
            yield 2;
            yield 3;
          }
          
          const gen = function* () {
            const value = yield fetch('/api/data');
            return value;
          };
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'generator',
          confidence: 0.9
        }));
      });

      it('should detect async generators', async () => {
        const code = `
          async function* asyncGenerator() {
            for (let i = 0; i < 5; i++) {
              yield await Promise.resolve(i);
            }
          }
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        // Should detect both async-await and generator patterns
        const patternTypes = result.patterns.map(p => p.type);
        expect(patternTypes).toContain('async-await');
        expect(patternTypes).toContain('generator');
      });
    });

    describe('mixed patterns', () => {
      it('should detect multiple async patterns in the same file', async () => {
        const code = `
          // Async/await
          async function fetchData() {
            return await fetch('/api/data');
          }
          
          // Promise
          function loadData() {
            return new Promise((resolve, reject) => {
              // Callback
              fs.readFile('data.txt', (err, data) => {
                if (err) reject(err);
                else resolve(data);
              });
            });
          }
          
          // Generator
          function* processItems(items) {
            for (const item of items) {
              yield processItem(item);
            }
          }
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.hasAsyncPatterns).toBe(true);
        const patternTypes = result.patterns.map(p => p.type);
        expect(patternTypes).toContain('async-await');
        expect(patternTypes).toContain('promise');
        expect(patternTypes).toContain('callback');
        expect(patternTypes).toContain('generator');
      });

      it('should determine primary pattern based on usage frequency', async () => {
        const code = `
          // Many promises
          Promise.all([1, 2, 3].map(n => Promise.resolve(n)))
            .then(results => results.map(r => r * 2))
            .then(doubled => console.log(doubled))
            .catch(err => console.error(err));
          
          // One async function
          async function single() {
            return 42;
          }
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        expect(result.primaryPattern).toBe('promise');
      });
    });

    describe('TypeScript support', () => {
      it('should detect patterns in TypeScript files', async () => {
        const code = `
          interface User {
            id: number;
            name: string;
          }
          
          async function fetchUser(id: number): Promise<User> {
            const response = await fetch(\`/users/\${id}\`);
            return response.json() as Promise<User>;
          }
          
          const processUsers = async (users: User[]): Promise<void> => {
            for (const user of users) {
              await processUser(user);
            }
          };
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.ts');

        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.primaryPattern).toBe('async-await');
      });
    });

    describe('error handling', () => {
      it('should handle file read errors gracefully', async () => {
        mockFs.readFile.mockRejectedValue(new Error('File not found'));

        const result = await detector.analyzeFile('nonexistent.js');

        expect(result.hasAsyncPatterns).toBe(false);
        expect(result.patterns).toEqual([]);
        expect(result.primaryPattern).toBeUndefined();
      });

      it('should fallback to regex detection on parse errors', async () => {
        const code = `
          // Invalid syntax that would break AST parsing
          async function() {
            await something;
          }
          
          // But still has detectable patterns
          const valid = async () => await fetch('/api');
        `;
        mockFs.readFile.mockResolvedValue(code);

        const result = await detector.analyzeFile('test.js');

        // Should still detect async patterns using regex fallback
        expect(result.hasAsyncPatterns).toBe(true);
        expect(result.patterns).toContainEqual(expect.objectContaining({
          type: 'async-await'
        }));
      });
    });
  });

  describe('analyzeFiles', () => {
    it('should analyze multiple files', async () => {
      const files = {
        'async.js': 'async function test() { await fetch("/api"); }',
        'promise.js': 'fetch("/api").then(r => r.json());',
        'sync.js': 'function add(a, b) { return a + b; }'
      };

      for (const [, content] of Object.entries(files)) {
        mockFs.readFile.mockResolvedValueOnce(content);
      }

      const results = await detector.analyzeFiles(Object.keys(files));

      expect(results.size).toBe(3);
      expect(results.get('async.js')?.hasAsyncPatterns).toBe(true);
      expect(results.get('promise.js')?.hasAsyncPatterns).toBe(true);
      expect(results.get('sync.js')?.hasAsyncPatterns).toBe(false);
    });
  });

  describe('summarizePatterns', () => {
    it('should summarize patterns across multiple files', async () => {
      const analyses = new Map([
        ['file1.js', {
          filePath: 'file1.js',
          hasAsyncPatterns: true,
          patterns: [
            { type: 'async-await' as const, confidence: 0.9, count: 3, examples: [] },
            { type: 'promise' as const, confidence: 0.8, count: 1, examples: [] }
          ],
          primaryPattern: 'async-await' as const
        }],
        ['file2.js', {
          filePath: 'file2.js',
          hasAsyncPatterns: true,
          patterns: [
            { type: 'promise' as const, confidence: 0.9, count: 5, examples: [] }
          ],
          primaryPattern: 'promise' as const
        }],
        ['file3.js', {
          filePath: 'file3.js',
          hasAsyncPatterns: false,
          patterns: []
        }]
      ]);

      const summary = detector.summarizePatterns(analyses);

      expect(summary.totalFiles).toBe(3);
      expect(summary.filesWithAsync).toBe(2);
      expect(summary.patternCounts['async-await']).toBe(3);
      expect(summary.patternCounts['promise']).toBe(6);
      expect(summary.patternCounts['callback']).toBe(0);
      expect(summary.primaryPattern).toBe('promise'); // 6 > 3
    });
  });

  describe('configuration options', () => {
    it('should respect maxExamples option', async () => {
      detector = new AsyncPatternDetector({ maxExamples: 1 });
      
      const code = `
        await fetch('/api/1');
        await fetch('/api/2');
        await fetch('/api/3');
      `;
      mockFs.readFile.mockResolvedValue(code);

      const result = await detector.analyzeFile('test.js');
      const asyncPattern = result.patterns.find(p => p.type === 'async-await');
      
      expect(asyncPattern?.examples.length).toBeLessThanOrEqual(1);
    });

    it('should respect minConfidence option', async () => {
      detector = new AsyncPatternDetector({ minConfidence: 0.8 });
      
      const code = `
        // Should have lower confidence due to regex fallback
        callback(error, result);
      `;
      mockFs.readFile.mockResolvedValue(code);

      const result = await detector.analyzeFile('test.js');
      
      // Callback patterns detected via regex have confidence 0.7
      const callbackPattern = result.patterns.find(p => p.type === 'callback');
      expect(callbackPattern).toBeUndefined();
    });
  });
});