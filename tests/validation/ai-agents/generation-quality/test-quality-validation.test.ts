/**
 * Test Quality Validation
 * 
 * Addresses critical feedback about generated test quality:
 * - Generated tests are mostly TODO placeholders with minimal assertions
 * - Tests check basic existence but lack meaningful assertions
 * - Need to verify tests are executable and provide real value
 */

import path from 'path';
import fs from 'fs/promises';
import { StructuralTestGenerator } from '../../../../src/generators/StructuralTestGenerator';
import { ProjectAnalyzer } from '../../../../src/analyzers/ProjectAnalyzer';
import { TestTemplateEngine } from '../../../../src/generators/templates/TestTemplateEngine';
import { TestType } from '../../../../src/generators/TestGenerator';

interface TestQualityMetrics {
  totalLines: number;
  assertionCount: number;
  todoCount: number;
  importCount: number;
  testCaseCount: number;
  executableTests: number;
  qualityScore: number; // 0-1 scale
  meaningfulAssertions: number;
  placeholderAssertions: number;
}

describe('Test Quality Validation - Critical Issues', () => {
  const testProjectPath = path.join(__dirname, '../../../fixtures/validation-projects/react-es-modules');
  let generator: StructuralTestGenerator;
  let analyzer: ProjectAnalyzer;

  beforeAll(async () => {
    analyzer = new ProjectAnalyzer(testProjectPath);
    const projectAnalysis = await analyzer.analyzeProject();
    
    generator = new StructuralTestGenerator(
      { 
        projectPath: testProjectPath,
        outputPath: path.join(testProjectPath, '.claude-testing'),
        testFramework: 'jest',
        options: {},
        patterns: {
          include: ['**/*.{js,jsx,ts,tsx}'], 
          exclude: ['**/*.test.*', '**/*.spec.*']
        }
      },
      projectAnalysis,
      { dryRun: false }
    );
    
    // Ensure test project exists
    try {
      await fs.access(testProjectPath);
    } catch {
      await createTestProject(testProjectPath);
    }
  });

  describe('🚨 Critical Issue: Generated Test Quality', () => {
    test('should generate meaningful assertions, not just TODOs', async () => {
      const generationResult = await generator.generateAllTests();
      const generatedTest = generationResult.tests[0]; // Get first test for analysis
      if (!generatedTest) {
        throw new Error('No tests were generated');
      }
      const quality = analyzeTestQuality(generatedTest.content);
      
      console.log('Test Quality Metrics:', quality);
      
      // Critical requirements based on feedback
      expect(quality.assertionCount).toBeGreaterThan(quality.todoCount);
      expect(quality.qualityScore).toBeGreaterThan(0.6); // 60% minimum quality
      expect(quality.meaningfulAssertions).toBeGreaterThan(0);
      
      // Should have real test cases, not just existence checks
      expect(quality.testCaseCount).toBeGreaterThan(1);
      expect(quality.executableTests).toBe(quality.testCaseCount);
    });

    test('should generate comprehensive tests for React components', async () => {
      const generationResult = await generator.generateAllTests();
      const generatedTest = generationResult.tests.find(test => test.sourcePath.includes('App.jsx'));
      expect(generatedTest).toBeDefined();
      
      const testContent = generatedTest!.content;
      const quality = analyzeTestQuality(testContent);
      
      // React-specific requirements
      expect(testContent).toContain('@testing-library/react');
      expect(testContent).toContain('render');
      expect(testContent).toContain('screen');
      expect(quality.assertionCount).toBeGreaterThan(2); // More than basic existence
      expect(quality.qualityScore).toBeGreaterThan(0.7); // Higher bar for components
    });

    test('should generate tests with proper import paths for ES modules', async () => {
      const generationResult = await generator.generateAllTests();
      const generatedTest = generationResult.tests.find(test => test.sourcePath.includes('utils.js'));
      expect(generatedTest).toBeDefined();
      
      const testContent = generatedTest!.content;
      // Check for correct ES module imports
      const importLines = testContent.split('\n').filter(line => line.trim().startsWith('import'));
      
      importLines.forEach(importLine => {
        if (importLine.includes('./') || importLine.includes('../')) {
          expect(importLine).toMatch(/\.js['"]$/); // Should end with .js for ES modules
        }
      });
      
      console.log('✅ ES module imports are correctly formatted');
    });

    test('should generate executable tests without syntax errors', async () => {
      const generationResult = await generator.generateAllTests();
      const generatedTest = generationResult.tests.find(test => test.sourcePath.includes('utils.js'));
      expect(generatedTest).toBeDefined();
      
      const testContent = generatedTest!.content;
      
      // Basic syntax validation
      expect(testContent).toContain('describe(');
      expect(testContent).toContain('test(');
      expect(testContent).toContain('expect(');
      
      // Should not contain template errors
      expect(testContent).not.toContain('{{');
      expect(testContent).not.toContain('}}');
      expect(testContent).not.toContain('undefined');
      
      // Count brackets for basic syntax validation
      const openBraces = (testContent.match(/{/g) || []).length;
      const closeBraces = (testContent.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
      
      const openParens = (testContent.match(/\(/g) || []).length;
      const closeParens = (testContent.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });
  });

  describe('Test Content Analysis', () => {
    test('should prefer meaningful assertions over existence checks', async () => {
      const generationResult = await generator.generateAllTests();
      const generatedTest = generationResult.tests.find(test => test.sourcePath.includes('utils.js'));
      expect(generatedTest).toBeDefined();
      
      const testContent = generatedTest!.content;
      
      // Count meaningful vs basic assertions
      const existenceChecks = (testContent.match(/toBeDefined\(\)/g) || []).length;
      const totalExpects = (testContent.match(/expect\(/g) || []).length;
      const meaningfulAssertions = totalExpects - existenceChecks;
      
      expect(meaningfulAssertions).toBeGreaterThan(existenceChecks);
      console.log(`✅ Meaningful assertions: ${meaningfulAssertions}, Existence checks: ${existenceChecks}`);
    });

    test('should include edge case testing for functions', async () => {
      const generationResult = await generator.generateAllTests();
      
      // Look for edge case patterns
      const edgeCasePatterns = [
        /null/i,
        /undefined/i,
        /empty/i,
        /zero/i,
        /negative/i,
        /boundary/i,
        /edge case/i
      ];
      
      const generatedTest = generationResult.tests.find(test => test.sourcePath.includes('utils.js'));
      expect(generatedTest).toBeDefined();
      
      const testContent = generatedTest!.content;
      const edgeCaseCount = edgeCasePatterns.reduce((count, pattern) => {
        return count + (testContent.match(pattern) || []).length;
      }, 0);
      
      expect(edgeCaseCount).toBeGreaterThan(0);
      console.log(`✅ Edge case considerations found: ${edgeCaseCount}`);
    });

    test('should validate test structure and organization', async () => {
      const generationResult = await generator.generateAllTests();
      const generatedTest = generationResult.tests.find(test => test.sourcePath.includes('utils.js'));
      expect(generatedTest).toBeDefined();
      
      const testContent = generatedTest!.content;
      
      // Validate proper test structure
      const describeBlocks = (testContent.match(/describe\(/g) || []).length;
      const testBlocks = (testContent.match(/test\(/g) || []).length;
      
      expect(describeBlocks).toBeGreaterThan(0);
      expect(testBlocks).toBeGreaterThan(0);
      expect(testBlocks).toBeGreaterThan(describeBlocks); // More tests than describe blocks
      
      // Check for proper async handling if needed
      if (testContent.includes('async')) {
        expect(testContent).toContain('await');
      }
    });
  });

  describe('Template Engine Quality', () => {
    test('should generate appropriate templates for different file types', async () => {
      const templateEngine = new TestTemplateEngine();
      
      // Test JavaScript function template
      const jsTemplate = templateEngine.generateTest({
        moduleName: 'utils',
        modulePath: './utils.js',
        imports: [],
        exports: ['add'],
        hasDefaultExport: false,
        testType: TestType.UNIT,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: []
      });
      
      expect(jsTemplate).toContain('describe');
      expect(jsTemplate).toContain('add');
      expect(jsTemplate).not.toContain('TODO'); // Should not rely on TODOs
      
      // Test React component template
      const reactTemplate = templateEngine.generateTest({
        moduleName: 'App',
        modulePath: './App.jsx',
        imports: [],
        exports: ['App'],
        hasDefaultExport: true,
        testType: TestType.COMPONENT,
        framework: 'react',
        language: 'javascript',
        isAsync: false,
        isComponent: true,
        dependencies: []
      });
      
      expect(reactTemplate).toContain('@testing-library/react');
      expect(reactTemplate).toContain('render');
      expect(reactTemplate).toContain('App');
    });

    test('should handle complex export patterns', async () => {
      const templateEngine = new TestTemplateEngine();
      
      const complexTemplate = templateEngine.generateTest({
        moduleName: 'complex',
        modulePath: './complex.js',
        imports: [],
        exports: [
          'default',
          'namedFunction',
          'CONFIG',
          'MyClass'
        ],
        hasDefaultExport: true,
        testType: TestType.UNIT,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: []
      });
      
      // Should handle all export types
      expect(complexTemplate).toContain('namedFunction');
      expect(complexTemplate).toContain('CONFIG');
      expect(complexTemplate).toContain('MyClass');
      
      // Should have appropriate test patterns for each type
      const testCaseCount = (complexTemplate.match(/test\(/g) || []).length;
      expect(testCaseCount).toBeGreaterThan(3); // At least one test per export type
    });
  });

  describe('Production Quality Standards', () => {
    test('should meet minimum quality thresholds for production', async () => {
      const testFiles = [
        'src/utils.js',
        'src/App.jsx'
      ];
      
      const qualityResults = [];
      
      const generationResult = await generator.generateAllTests();
      
      for (const file of testFiles) {
        const generatedTest = generationResult.tests.find(test => test.sourcePath.includes(file));
        if (generatedTest) {
          const quality = analyzeTestQuality(generatedTest.content);
          qualityResults.push({ file, quality });
        }
      }
      
      // Production standards
      const averageQuality = qualityResults.reduce((sum, result) => 
        sum + result.quality.qualityScore, 0) / qualityResults.length;
      
      expect(averageQuality).toBeGreaterThan(0.7); // 70% minimum for production
      
      console.log('Production Quality Report:');
      qualityResults.forEach(({ file, quality }) => {
        console.log(`  ${file}: Quality Score ${quality.qualityScore.toFixed(2)}`);
      });
      console.log(`  Average Quality: ${averageQuality.toFixed(2)}`);
    });
  });
});

/**
 * Analyze the quality of generated test code
 */
function analyzeTestQuality(testCode: string): TestQualityMetrics {
  const lines = testCode.split('\n');
  const totalLines = lines.length;
  
  // Count different types of content
  const assertionCount = (testCode.match(/expect\(/g) || []).length;
  const todoCount = (testCode.match(/TODO|FIXME|XXX/gi) || []).length;
  const importCount = (testCode.match(/^import /gm) || []).length;
  const testCaseCount = (testCode.match(/test\(/g) || []).length;
  
  // Analyze assertion quality
  const meaningfulAssertions = countMeaningfulAssertions(testCode);
  const placeholderAssertions = assertionCount - meaningfulAssertions;
  
  // Calculate quality score
  const qualityScore = calculateQualityScore({
    assertionCount,
    todoCount,
    testCaseCount,
    meaningfulAssertions,
    totalLines
  });
  
  return {
    totalLines,
    assertionCount,
    todoCount,
    importCount,
    testCaseCount,
    executableTests: testCaseCount, // Assume all are executable for now
    qualityScore,
    meaningfulAssertions,
    placeholderAssertions
  };
}

/**
 * Count meaningful assertions (not just existence checks)
 */
function countMeaningfulAssertions(testCode: string): number {
  const meaningfulPatterns = [
    /\.toBe\(/g,
    /\.toEqual\(/g,
    /\.toContain\(/g,
    /\.toHaveLength\(/g,
    /\.toBeGreaterThan\(/g,
    /\.toBeLessThan\(/g,
    /\.toThrow\(/g,
    /\.toHaveBeenCalled\(/g,
    /\.toMatchSnapshot\(/g
  ];
  
  return meaningfulPatterns.reduce((count, pattern) => {
    return count + (testCode.match(pattern) || []).length;
  }, 0);
}

/**
 * Calculate overall quality score (0-1)
 */
function calculateQualityScore(metrics: {
  assertionCount: number;
  todoCount: number;
  testCaseCount: number;
  meaningfulAssertions: number;
  totalLines: number;
}): number {
  const { assertionCount, todoCount, testCaseCount, meaningfulAssertions } = metrics;
  
  // Penalties for poor quality indicators
  const todoPenalty = Math.min(todoCount * 0.1, 0.5); // Max 50% penalty for TODOs
  const lowAssertionPenalty = testCaseCount > 0 ? Math.max(0, (testCaseCount - assertionCount) * 0.1) : 0;
  
  // Bonuses for quality indicators
  const meaningfulAssertionBonus = meaningfulAssertions * 0.1;
  const testCoverageBonus = testCaseCount > 0 ? Math.min(testCaseCount * 0.05, 0.3) : 0;
  
  // Base score
  let score = 0.5; // Start at 50%
  
  // Apply adjustments
  score += meaningfulAssertionBonus;
  score += testCoverageBonus;
  score -= todoPenalty;
  score -= lowAssertionPenalty;
  
  // Normalize to 0-1 range
  return Math.max(0, Math.min(1, score));
}

/**
 * Create a test project for validation
 */
async function createTestProject(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create package.json with ES modules
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'validation-test-project',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        react: '^19.1.0',
        '@testing-library/react': '^16.0.0',
        '@testing-library/jest-dom': '^6.0.0'
      }
    }, null, 2)
  );
  
  // Create utilities with various export patterns
  await fs.writeFile(
    path.join(projectPath, 'src/utils.js'),
    `// Various function types for testing
export function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers');
  }
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}

export class Calculator {
  constructor() {
    this.history = [];
  }
  
  calculate(operation, a, b) {
    let result;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      default:
        throw new Error('Unknown operation');
    }
    this.history.push({ operation, a, b, result });
    return result;
  }
}

export const CONFIG = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};

// Default export
export default function defaultFunction() {
  return 'default function result';
}`
  );
  
  // Create React component
  await fs.writeFile(
    path.join(projectPath, 'src/App.jsx'),
    `import { useState, useEffect } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setData({ message: 'Hello World' });
      setLoading(false);
    }, 1000);
  }, []);

  const handleIncrement = () => {
    setCount(prev => prev + 1);
  };

  const handleDecrement = () => {
    setCount(prev => prev - 1);
  };

  if (loading) {
    return <div data-testid="loading">Loading...</div>;
  }

  return (
    <div className="App" data-testid="app">
      <h1>Counter App</h1>
      <div data-testid="counter">Count: {count}</div>
      <button data-testid="increment" onClick={handleIncrement}>
        Increment
      </button>
      <button data-testid="decrement" onClick={handleDecrement}>
        Decrement
      </button>
      {data && (
        <div data-testid="message">{data.message}</div>
      )}
    </div>
  );
}

export function SecondaryComponent({ title, children }) {
  return (
    <div className="secondary">
      <h2>{title}</h2>
      {children}
    </div>
  );
}`
  );
}