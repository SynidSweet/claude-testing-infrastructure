/**
 * Automated test harness for validating mixed-language project handling
 * in Claude Testing Infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../../../src/analyzers/ProjectAnalyzer';
import { StructuralTestGenerator } from '../../../src/generators/StructuralTestGenerator';

describe('Mixed Project Test Harness', () => {
  const fixturesPath = path.join(__dirname);
  const minimalPath = path.join(fixturesPath, 'mixed-minimal');
  const complexPath = path.join(fixturesPath, 'mixed-complex');

  beforeAll(() => {
    // Ensure test fixtures exist
    expect(fs.existsSync(minimalPath)).toBe(true);
    expect(fs.existsSync(complexPath)).toBe(true);
  });

  describe('Minimal Mixed Project Validation', () => {
    let analyzer: ProjectAnalyzer;

    beforeEach(() => {
      analyzer = new ProjectAnalyzer(minimalPath);
    });

    test('should detect both JavaScript and Python files', async () => {
      const result = await analyzer.analyzeProject();
      
      const languageNames = result.languages.map(lang => lang.name);
      expect(languageNames).toContain('javascript');
      expect(languageNames).toContain('python');
      expect(result.languages.length).toBeGreaterThanOrEqual(2);
    });

    test('should identify correct file counts per language', async () => {
      const result = await analyzer.analyzeProject();
      
      const jsLanguage = result.languages.find(lang => lang.name === 'javascript');
      const pyLanguage = result.languages.find(lang => lang.name === 'python');
      
      expect(jsLanguage?.files.length).toBeGreaterThan(0);
      expect(pyLanguage?.files.length).toBeGreaterThan(0);
      
      // Verify specific expected files exist
      const jsFiles = jsLanguage?.files || [];
      const pyFiles = pyLanguage?.files || [];
      
      expect(jsFiles.some(f => f.includes('math.js'))).toBe(true);
      expect(jsFiles.some(f => f.includes('api.js'))).toBe(true);
      expect(pyFiles.some(f => f.includes('math_utils.py'))).toBe(true);
      expect(pyFiles.some(f => f.includes('api_client.py'))).toBe(true);
    });

    test('should detect appropriate test frameworks for each language', async () => {
      const result = await analyzer.analyzeProject();
      
      expect(result.testingSetup.testFrameworks).toContain('jest');
      expect(result.testingSetup.testFrameworks).toContain('pytest');
    });

    test('should generate tests for both languages', async () => {
      const analysisResult = await analyzer.analyzeProject();
      
      const generator = new StructuralTestGenerator(
        {
          projectPath: minimalPath,
          outputPath: path.join(minimalPath, '.claude-testing'),
          testFramework: 'mixed',
          options: {}
        },
        analysisResult,
        {
          dryRun: true, // Don't actually create files during tests
          skipValidation: true
        }
      );
      
      const testResult = await generator.generateAllTests();
      
      expect(testResult.success).toBe(true);
      expect(testResult.tests.length).toBeGreaterThan(0);
      
      // Check that tests were generated for both languages
      const jsTests = testResult.tests.filter(t => t.sourcePath.includes('.js'));
      const pyTests = testResult.tests.filter(t => t.sourcePath.includes('.py'));
      
      expect(jsTests.length).toBeGreaterThan(0);
      expect(pyTests.length).toBeGreaterThan(0);
    });

    test('should validate package configuration files', async () => {
      const packageJsonPath = path.join(minimalPath, 'package.json');
      const requirementsPath = path.join(minimalPath, 'requirements.txt');
      
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      expect(fs.existsSync(requirementsPath)).toBe(true);
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('test:python');
    });
  });

  describe('Complex Mixed Project Validation', () => {
    let analyzer: ProjectAnalyzer;

    beforeEach(() => {
      analyzer = new ProjectAnalyzer(complexPath);
    });

    test('should detect multiple languages and frameworks', async () => {
      const result = await analyzer.analyzeProject();
      
      // Should detect TypeScript and Python (no plain JavaScript since all files are .ts/.tsx)
      const languageNames = result.languages.map(lang => lang.name);
      expect(languageNames).toContain('typescript');
      expect(languageNames).toContain('python');
      expect(result.languages.length).toBeGreaterThanOrEqual(2);
      
      // Should detect multiple frameworks
      const frameworkNames = result.frameworks.map(fw => fw.name);
      expect(frameworkNames).toContain('react');
      expect(frameworkNames).toContain('fastapi');
      expect(result.frameworks.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle TypeScript configuration', async () => {
      const tsconfigPath = path.join(complexPath, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      
      const result = await analyzer.analyzeProject();
      const tsLanguage = result.languages.find(lang => lang.name === 'typescript');
      
      expect(tsLanguage?.files.length).toBeGreaterThan(0);
      expect(tsLanguage?.files.some(f => f.includes('UserDashboard.tsx'))).toBe(true);
    });

    test('should detect backend and frontend separation', async () => {
      const result = await analyzer.analyzeProject();
      
      // Check project structure for frontend and backend directories
      expect(result.projectStructure.srcDirectory).toBeTruthy();
      
      // Check that both Python and TypeScript files are detected (indicating backend/frontend separation)
      const languageNames = result.languages.map(lang => lang.name);
      expect(languageNames).toContain('typescript'); // Frontend
      expect(languageNames).toContain('python'); // Backend
    });

    test('should generate comprehensive test suite', async () => {
      const analysisResult = await analyzer.analyzeProject();
      
      const generator = new StructuralTestGenerator(
        {
          projectPath: complexPath,
          outputPath: path.join(complexPath, '.claude-testing'),
          testFramework: 'mixed',
          options: {}
        },
        analysisResult,
        {
          dryRun: true, // Don't actually create files during tests
          skipValidation: true
        }
      );
      
      const testResult = await generator.generateAllTests();
      
      expect(testResult.success).toBe(true);
      expect(testResult.tests.length).toBeGreaterThan(5);
      
      // Verify tests for different file types
      const tsTests = testResult.tests.filter(t => t.sourcePath.includes('.ts') || t.sourcePath.includes('.tsx'));
      const pyTests = testResult.tests.filter(t => t.sourcePath.includes('.py'));
      
      expect(tsTests.length).toBeGreaterThan(0);
      expect(pyTests.length).toBeGreaterThan(0);
    });

    test('should handle complex dependencies correctly', async () => {
      const packageJsonPath = path.join(complexPath, 'package.json');
      const requirementsPath = path.join(complexPath, 'requirements.txt');
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const requirements = fs.readFileSync(requirementsPath, 'utf8');
      
      // Check for complex dependencies
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('axios');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      
      expect(requirements).toContain('fastapi');
      expect(requirements).toContain('pydantic');
    });
  });

  describe('Cross-Language Integration Tests', () => {
    test('should handle projects with similar functionality across languages', async () => {
      const minimalAnalysis = await new ProjectAnalyzer(minimalPath).analyzeProject();
      const complexAnalysis = await new ProjectAnalyzer(complexPath).analyzeProject();
      
      // Both projects should have math utilities
      const minimalMathFiles = minimalAnalysis.languages.flatMap(lang => lang.files)
        .filter(f => f.includes('math') || f.includes('Math'));
      const complexMathFiles = complexAnalysis.languages.flatMap(lang => lang.files)
        .filter(f => f.includes('math') || f.includes('Math'));
      
      expect(minimalMathFiles.length).toBeGreaterThan(0);
      expect(complexMathFiles.length).toBeGreaterThan(0);
    });

    test('should validate test generation consistency across languages', async () => {
      const minimalAnalysis = await new ProjectAnalyzer(minimalPath).analyzeProject();
      const minimalGenerator = new StructuralTestGenerator(
        {
          projectPath: minimalPath,
          outputPath: path.join(minimalPath, '.claude-testing'),
          testFramework: 'mixed',
          options: {}
        },
        minimalAnalysis,
        { dryRun: true, skipValidation: true }
      );
      const minimalTests = await minimalGenerator.generateAllTests();
      
      const complexAnalysis = await new ProjectAnalyzer(complexPath).analyzeProject();
      const complexGenerator = new StructuralTestGenerator(
        {
          projectPath: complexPath,
          outputPath: path.join(complexPath, '.claude-testing'),
          testFramework: 'mixed',
          options: {}
        },
        complexAnalysis,
        { dryRun: true, skipValidation: true }
      );
      const complexTests = await complexGenerator.generateAllTests();
      
      // Both should generate tests successfully
      expect(minimalTests.tests.length).toBeGreaterThan(0);
      expect(complexTests.tests.length).toBeGreaterThan(0);
      
      // Complex project should generate more tests due to higher complexity
      expect(complexTests.tests.length).toBeGreaterThan(minimalTests.tests.length);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate all required configuration files exist', () => {
      // Minimal project files
      expect(fs.existsSync(path.join(minimalPath, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(minimalPath, 'requirements.txt'))).toBe(true);
      
      // Complex project files
      expect(fs.existsSync(path.join(complexPath, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(complexPath, 'requirements.txt'))).toBe(true);
      expect(fs.existsSync(path.join(complexPath, 'tsconfig.json'))).toBe(true);
    });

    test('should validate project structure integrity', () => {
      // Validate minimal project structure
      expect(fs.existsSync(path.join(minimalPath, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(minimalPath, 'src/utils'))).toBe(true);
      expect(fs.existsSync(path.join(minimalPath, 'src/services'))).toBe(true);
      
      // Validate complex project structure
      expect(fs.existsSync(path.join(complexPath, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(complexPath, 'backend'))).toBe(true);
      expect(fs.existsSync(path.join(complexPath, 'src/components'))).toBe(true);
      expect(fs.existsSync(path.join(complexPath, 'backend/services'))).toBe(true);
    });
  });
});