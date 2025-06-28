import { CoverageReporter, CoverageReporterFactory } from '../src/runners/CoverageReporter';
import { CoverageParserFactory } from '../src/runners/CoverageParser';
import { CoverageAggregator } from '../src/runners/CoverageAggregator';
import { CoverageVisualizer } from '../src/runners/CoverageVisualizer';

describe('CoverageReporter', () => {
  const mockProjectPath = '/test/project';
  
  describe('CoverageReporterFactory', () => {
    test('creates Jest reporter with correct configuration', () => {
      const reporter = CoverageReporterFactory.createJestReporter(mockProjectPath, {
        thresholds: { lines: 80, statements: 75 },
        outputDir: './custom-coverage',
        failOnThreshold: true
      });

      expect(reporter).toBeInstanceOf(CoverageReporter);
      expect(reporter.getAggregatorStats().count).toBe(0);
    });

    test('creates Pytest reporter with correct configuration', () => {
      const reporter = CoverageReporterFactory.createPytestReporter(mockProjectPath, {
        thresholds: { lines: 90 },
        outputDir: './pytest-coverage'
      });

      expect(reporter).toBeInstanceOf(CoverageReporter);
    });

    test('creates multi-framework reporter', () => {
      const reporter = CoverageReporterFactory.createMultiFrameworkReporter(mockProjectPath, {
        aggregationStrategy: 'union',
        thresholds: { lines: 85 }
      });

      expect(reporter).toBeInstanceOf(CoverageReporter);
    });
  });

  describe('CoverageParserFactory', () => {
    test('supports Jest framework', () => {
      expect(CoverageParserFactory.getSupportedFrameworks()).toContain('jest');
    });

    test('supports Pytest framework', () => {
      expect(CoverageParserFactory.getSupportedFrameworks()).toContain('pytest');
    });

    test('creates Jest parser', () => {
      const parser = CoverageParserFactory.createParser('jest', mockProjectPath);
      expect(parser.supports('jest')).toBe(true);
    });

    test('creates Pytest parser', () => {
      const parser = CoverageParserFactory.createParser('pytest', mockProjectPath);
      expect(parser.supports('pytest')).toBe(true);
    });

    test('throws error for unsupported framework', () => {
      expect(() => {
        CoverageParserFactory.createParser('unsupported', mockProjectPath);
      }).toThrow('Unsupported coverage framework: unsupported');
    });
  });

  describe('Coverage Processing', () => {
    let reporter: CoverageReporter;

    beforeEach(() => {
      reporter = new CoverageReporter({
        projectPath: mockProjectPath,
        framework: 'jest',
        thresholds: { lines: 80, statements: 75, branches: 70, functions: 85 }
      });
    });

    test('processes mock Jest coverage data', async () => {
      const mockJestCoverage = {
        coverageMap: {
          '/test/project/src/utils.js': {
            path: '/test/project/src/utils.js',
            s: { '0': 1, '1': 0, '2': 1 }, // statement coverage
            b: { '0': [1, 0] }, // branch coverage  
            f: { '0': 1, '1': 0 }, // function coverage
            statementMap: {
              '0': { start: { line: 1 } },
              '1': { start: { line: 5 } },
              '2': { start: { line: 10 } }
            },
            branchMap: {
              '0': { loc: { start: { line: 3 } }, type: 'if' }
            },
            fnMap: {
              '0': { name: 'mainFunction' },
              '1': { name: 'helperFunction' }
            }
          }
        }
      };

      const result = await reporter.processSingle(mockJestCoverage);
      
      expect(result.data.summary.statements).toBeGreaterThan(0);
      expect(result.data.summary.lines).toBeGreaterThan(0);
      expect(result.gapAnalysis.totalGaps).toBeGreaterThan(0);
      expect(result.reportFiles.length).toBeGreaterThan(0);
      expect(result.consoleSummary).toContain('Coverage Summary');
    });

    test('processes mock Pytest coverage text output', async () => {
      const pytestReporter = new CoverageReporter({
        projectPath: mockProjectPath,
        framework: 'pytest',
        thresholds: { lines: 80 }
      });

      const mockPytestOutput = `
=============================== test session starts ===============================
platform linux
collected 5 items

tests/test_utils.py::test_function_a PASSED                                                                                                                                                                                     [ 20%]
tests/test_utils.py::test_function_b PASSED                                                                                                                                                                                     [ 40%]
tests/test_utils.py::test_function_c PASSED                                                                                                                                                                                     [ 60%]
tests/test_utils.py::test_function_d PASSED                                                                                                                                                                                     [ 80%]
tests/test_utils.py::test_function_e PASSED                                                                                                                                                                                     [100%]

Name                Stmts   Miss  Cover
---------------------------------------
src/utils.py           20      3    85%
src/helpers.py         15      5    67%
---------------------------------------
TOTAL                  35      8    77%

========================= 5 passed in 0.12s =========================
`;

      const result = await pytestReporter.processSingle(mockPytestOutput);
      
      expect(result.data.summary.lines).toBe(77); // Should match TOTAL coverage
      expect(result.consoleSummary).toContain('Coverage Summary');
    });

    test('checks thresholds correctly', async () => {
      const mockCoverageData = {
        summary: { statements: 90, branches: 85, functions: 80, lines: 88 },
        files: {},
        uncoveredAreas: [],
        meetsThreshold: true
      };

      const thresholdCheck = await reporter.checkThresholds(mockCoverageData);
      
      expect(thresholdCheck.meetsThreshold).toBe(true);
      expect(thresholdCheck.violations).toHaveLength(0);
    });

    test('identifies threshold violations', async () => {
      const mockCoverageData = {
        summary: { statements: 70, branches: 65, functions: 60, lines: 75 },
        files: {},
        uncoveredAreas: [],
        meetsThreshold: false
      };

      const thresholdCheck = await reporter.checkThresholds(mockCoverageData);
      
      expect(thresholdCheck.meetsThreshold).toBe(false);
      expect(thresholdCheck.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Coverage Aggregation', () => {
    test('aggregates multiple coverage sources', async () => {
      const reporter = CoverageReporterFactory.createMultiFrameworkReporter(mockProjectPath);

      const sources = [
        {
          data: JSON.stringify({
            summary: { statements: 80, branches: 75, functions: 85, lines: 82 },
            files: { 'file1.js': { summary: { statements: 80, branches: 75, functions: 85, lines: 82 }, uncoveredLines: [5, 10] } },
            uncoveredAreas: []
          }),
          framework: 'jest'
        },
        {
          data: `TOTAL       50     10    80%`,
          framework: 'pytest'
        }
      ];

      const result = await reporter.processMultiple(sources);
      
      expect(result.data).toHaveProperty('metadata');
      expect(result.metadata.sourceCount).toBe(2);
      expect(result.gapAnalysis).toBeDefined();
    });
  });

  describe('Gap Analysis', () => {
    let gapReporter: CoverageReporter;

    beforeEach(() => {
      gapReporter = new CoverageReporter({
        projectPath: mockProjectPath,
        framework: 'jest'
      });
    });

    test('analyzes coverage gaps', async () => {
      const mockCoverageData = {
        summary: { statements: 75, branches: 60, functions: 80, lines: 70 },
        files: {
          'src/utils.js': {
            path: 'src/utils.js',
            summary: { statements: 75, branches: 60, functions: 80, lines: 70 },
            uncoveredLines: [5, 10, 15],
            uncoveredFunctions: ['helperFunction', 'utilityMethod']
          }
        },
        uncoveredAreas: [
          {
            file: 'src/utils.js',
            type: 'function' as const,
            line: 5,
            function: 'helperFunction',
            description: 'Uncovered function helperFunction'
          }
        ],
        meetsThreshold: false
      };

      const gapAnalysis = await gapReporter.analyzeGapsOnly(mockCoverageData);
      
      expect(gapAnalysis.totalGaps).toBeGreaterThan(0);
      expect(gapAnalysis.suggestions.length).toBeGreaterThan(0);
      expect(gapAnalysis.improvementPotential.lines).toBeGreaterThan(0);
      expect(gapAnalysis.gapsByFile['src/utils.js']).toBeDefined();
    });
  });

  describe('Static Methods', () => {
    test('supports frameworks correctly', () => {
      expect(CoverageReporter.supportsFramework('jest')).toBe(true);
      expect(CoverageReporter.supportsFramework('pytest')).toBe(true);
      expect(CoverageReporter.supportsFramework('unsupported')).toBe(false);
    });

    test('returns supported frameworks list', () => {
      const frameworks = CoverageReporter.getSupportedFrameworks();
      expect(frameworks).toContain('jest');
      expect(frameworks).toContain('pytest');
      expect(frameworks.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('CoverageAggregator', () => {
  test('aggregates coverage with union strategy', () => {
    const aggregator = new CoverageAggregator({ strategy: 'union' });
    
    const mockData1 = {
      summary: { statements: 80, branches: 70, functions: 85, lines: 82 },
      files: {
        'file1.js': {
          path: 'file1.js',
          summary: { statements: 80, branches: 70, functions: 85, lines: 82 },
          uncoveredLines: [5, 10]
        }
      },
      uncoveredAreas: [],
      meetsThreshold: true
    };

    const mockData2 = {
      summary: { statements: 75, branches: 80, functions: 70, lines: 78 },
      files: {
        'file1.js': {
          path: 'file1.js',
          summary: { statements: 85, branches: 80, functions: 75, lines: 82 },
          uncoveredLines: [3, 5]
        }
      },
      uncoveredAreas: [],
      meetsThreshold: true
    };

    aggregator.addSource(mockData1, 'jest');
    aggregator.addSource(mockData2, 'pytest');
    
    const result = aggregator.aggregate();
    
    expect(result.metadata.sourceCount).toBe(2);
    expect(result.metadata.frameworks).toContain('jest');
    expect(result.metadata.frameworks).toContain('pytest');
    expect(result.files['file1.js']).toBeDefined();
  });
});

describe('CoverageVisualizer', () => {
  test('generates console summary', () => {
    const visualizer = new CoverageVisualizer();
    
    const mockData = {
      summary: { statements: 85, branches: 75, functions: 90, lines: 88 },
      files: {
        'file1.js': {
          path: 'file1.js',
          summary: { statements: 85, branches: 75, functions: 90, lines: 88 },
          uncoveredLines: []
        }
      },
      uncoveredAreas: [],
      meetsThreshold: true,
      thresholds: { lines: 80 }
    };

    const summary = visualizer.generateConsoleSummary(mockData);
    
    expect(summary).toContain('Coverage Summary');
    expect(summary).toContain('85.0%'); // Statements
    expect(summary).toContain('Files covered: 1');
    expect(summary).toContain('✅ Meets thresholds: Yes');
  });

  test('analyzes coverage gaps', () => {
    const visualizer = new CoverageVisualizer();
    
    const mockData = {
      summary: { statements: 60, branches: 50, functions: 70, lines: 65 },
      files: {
        'file1.js': {
          path: 'file1.js',
          summary: { statements: 60, branches: 50, functions: 70, lines: 65 },
          uncoveredLines: [5, 10, 15],
          uncoveredFunctions: ['testFunction']
        }
      },
      uncoveredAreas: [
        {
          file: 'file1.js',
          type: 'function' as const,
          line: 5,
          function: 'testFunction',
          description: 'Uncovered function'
        }
      ],
      meetsThreshold: false
    };

    const gapAnalysis = visualizer.analyzeGaps(mockData);
    
    expect(gapAnalysis.totalGaps).toBe(1);
    expect(gapAnalysis.gapsByType.function).toHaveLength(1);
    expect(gapAnalysis.gapsByFile['file1.js']).toHaveLength(1);
    expect(gapAnalysis.suggestions.length).toBeGreaterThan(0);
  });
});