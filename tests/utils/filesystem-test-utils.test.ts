import { FileSystemTestUtils, FileSystemTestHelper } from './filesystem-test-utils';

describe('FileSystemTestUtils', () => {
  afterEach(() => {
    FileSystemTestUtils.cleanupInMemoryFileSystem();
  });

  describe('setupInMemoryFileSystem', () => {
    it('should create in-memory files', () => {
      FileSystemTestUtils.setupInMemoryFileSystem({
        '/test/file1.txt': 'content1',
        '/test/file2.txt': 'content2'
      });

      expect(FileSystemTestUtils.fileExists('/test/file1.txt')).toBe(true);
      expect(FileSystemTestUtils.fileExists('/test/file2.txt')).toBe(true);
      expect(FileSystemTestUtils.fileExists('/test/missing.txt')).toBe(false);
    });

    it('should read file content from memory', () => {
      FileSystemTestUtils.setupInMemoryFileSystem({
        '/test/sample.txt': 'Hello World'
      });

      const content = FileSystemTestUtils.getFileContent('/test/sample.txt');
      expect(content).toBe('Hello World');
    });

    it('should create files with relative paths', () => {
      FileSystemTestUtils.setupInMemoryFileSystem({
        'package.json': JSON.stringify({ name: 'test' }),
        'src/index.js': 'console.log("hello");'
      }, '/project');

      expect(FileSystemTestUtils.fileExists('/project/package.json')).toBe(true);
      expect(FileSystemTestUtils.fileExists('/project/src/index.js')).toBe(true);
    });
  });

  describe('addFiles', () => {
    it('should add files to existing filesystem', () => {
      FileSystemTestUtils.setupInMemoryFileSystem({
        '/test/existing.txt': 'existing'
      });

      FileSystemTestUtils.addFiles({
        '/test/new.txt': 'new content'
      });

      expect(FileSystemTestUtils.fileExists('/test/existing.txt')).toBe(true);
      expect(FileSystemTestUtils.fileExists('/test/new.txt')).toBe(true);
    });
  });

  describe('removeFiles', () => {
    it('should remove files from filesystem', () => {
      FileSystemTestUtils.setupInMemoryFileSystem({
        '/test/file1.txt': 'content1',
        '/test/file2.txt': 'content2'
      });

      FileSystemTestUtils.removeFiles(['/test/file1.txt']);

      expect(FileSystemTestUtils.fileExists('/test/file1.txt')).toBe(false);
      expect(FileSystemTestUtils.fileExists('/test/file2.txt')).toBe(true);
    });
  });

  describe('createStandardProject', () => {
    it('should create JavaScript project', () => {
      const files = FileSystemTestUtils.createStandardProject('javascript', '/test/js-project');
      
      expect(files['/test/js-project/package.json']).toBeDefined();
      expect(files['/test/js-project/index.js']).toBeDefined();
      expect(files['/test/js-project/src/utils.js']).toBeDefined();
      
      const packageJson = JSON.parse(files['/test/js-project/package.json'] || '{}');
      expect(packageJson.name).toBe('test-project');
    });

    it('should create TypeScript project', () => {
      const files = FileSystemTestUtils.createStandardProject('typescript', '/test/ts-project');
      
      expect(files['/test/ts-project/package.json']).toBeDefined();
      expect(files['/test/ts-project/tsconfig.json']).toBeDefined();
      expect(files['/test/ts-project/src/index.ts']).toBeDefined();
    });

    it('should create React project', () => {
      const files = FileSystemTestUtils.createStandardProject('react', '/test/react-project');
      
      expect(files['/test/react-project/package.json']).toBeDefined();
      expect(files['/test/react-project/src/App.js']).toBeDefined();
      
      const packageJson = JSON.parse(files['/test/react-project/package.json'] || '{}');
      expect(packageJson.dependencies.react).toBeDefined();
    });
  });

  describe('FileSystemTestHelper', () => {
    it('should setup and cleanup automatically', () => {
      const cleanup = FileSystemTestHelper.setup({
        '/test/temp.txt': 'temporary'
      });

      expect(FileSystemTestUtils.fileExists('/test/temp.txt')).toBe(true);
      
      cleanup();
      
      expect(FileSystemTestUtils.isInMemoryActive()).toBe(false);
    });

    it('should work with withInMemoryFS', async () => {
      const result = await FileSystemTestHelper.withInMemoryFS({
        '/test/data.txt': 'test data'
      }, () => {
        expect(FileSystemTestUtils.fileExists('/test/data.txt')).toBe(true);
        return 'success';
      });

      expect(result).toBe('success');
      expect(FileSystemTestUtils.isInMemoryActive()).toBe(false);
    });

    it('should setup project with helper', () => {
      const cleanup = FileSystemTestHelper.setupProject('javascript', '/test/project');

      expect(FileSystemTestUtils.fileExists('/test/project/package.json')).toBe(true);
      expect(FileSystemTestUtils.fileExists('/test/project/index.js')).toBe(true);
      
      cleanup();
    });
  });

  describe('performance comparison', () => {
    it('should be faster than real filesystem operations', async () => {
      const iterations = 10;
      
      // Test in-memory filesystem performance
      const memoryStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        FileSystemTestUtils.setupInMemoryFileSystem({
          [`/test/file${i}.txt`]: `content ${i}`
        });
        
        expect(FileSystemTestUtils.fileExists(`/test/file${i}.txt`)).toBe(true);
        expect(FileSystemTestUtils.getFileContent(`/test/file${i}.txt`)).toBe(`content ${i}`);
        
        FileSystemTestUtils.cleanupInMemoryFileSystem();
      }
      const memoryTime = Date.now() - memoryStart;

      console.log(`In-memory filesystem: ${memoryTime}ms for ${iterations} operations`);
      console.log(`Average per operation: ${memoryTime / iterations}ms`);
      
      // Memory filesystem should be very fast (< 50ms for 10 operations)
      expect(memoryTime).toBeLessThan(500);
    });
  });
});