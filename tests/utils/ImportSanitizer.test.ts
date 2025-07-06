import { ImportSanitizer } from '../../src/utils/ImportSanitizer';

describe('ImportSanitizer', () => {
  describe('analyzeTestContent', () => {
    it('should detect dangerous infrastructure imports', () => {
      const testContent = `
import { ClaudeOrchestrator } from '../ai/ClaudeOrchestrator';
import { MyModule } from './MyModule';

describe('MyModule', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
      `;

      const result = ImportSanitizer.analyzeTestContent(testContent, 'test.js');

      expect(result.isSafe).toBe(false);
      expect(result.dangerousImports).toHaveLength(1);
      expect(result.dangerousImports[0]?.dangerType).toBe('infrastructure-import');
      expect(result.dangerousImports[0]?.importStatement).toContain('ClaudeOrchestrator');
    });

    it('should detect process spawning imports', () => {
      const testContent = `
import { spawn } from 'child_process';
import { MyModule } from './MyModule';
      `;

      const result = ImportSanitizer.analyzeTestContent(testContent, 'test.js');

      expect(result.isSafe).toBe(false);
      expect(result.dangerousImports).toHaveLength(1);
      expect(result.dangerousImports[0]?.dangerType).toBe('process-spawning');
    });

    it('should allow safe imports', () => {
      const testContent = `
import { MyModule } from './MyModule';
import React from 'react';

describe('MyModule', () => {
  it('should work', () => {
    expect(MyModule).toBeDefined();
  });
});
      `;

      const result = ImportSanitizer.analyzeTestContent(testContent, 'test.js');

      expect(result.isSafe).toBe(true);
      expect(result.dangerousImports).toHaveLength(0);
    });
  });

  describe('sanitizeTestContent', () => {
    it('should remove dangerous infrastructure imports', () => {
      const testContent = `
import { ClaudeOrchestrator } from '../ai/ClaudeOrchestrator';
import { MyModule } from './MyModule';

describe('MyModule', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
      `;

      const sanitized = ImportSanitizer.sanitizeTestContent(testContent, 'test.js');

      expect(sanitized).not.toContain('ClaudeOrchestrator');
      expect(sanitized).toContain('MyModule');
    });

    it('should comment out process spawning imports', () => {
      const testContent = `
import { spawn } from 'child_process';
import { MyModule } from './MyModule';
      `;

      const sanitized = ImportSanitizer.sanitizeTestContent(testContent, 'test.js');

      expect(sanitized).toContain('// SANITIZED:');
      expect(sanitized).toContain('child_process');
      expect(sanitized).toContain('MyModule');
    });
  });

  describe('validateTestFile', () => {
    it('should block test files in infrastructure directory', () => {
      const testContent = 'import { MyModule } from "./MyModule";';
      const outputPath = '/path/to/claude-testing-infrastructure/tests/test.js';

      const result = ImportSanitizer.validateTestFile(testContent, outputPath);

      expect(result.isSafe).toBe(false);
      expect(result.dangerousImports[0]?.risk).toContain('infrastructure directory');
    });

    it('should allow test files in external directories', () => {
      const testContent = 'import { MyModule } from "./MyModule";';
      const outputPath = '/path/to/external-project/.claude-testing/test.js';

      const result = ImportSanitizer.validateTestFile(testContent, outputPath);

      expect(result.isSafe).toBe(true);
    });
  });
});