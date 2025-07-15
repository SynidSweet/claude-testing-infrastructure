import { TemplateOrchestrator } from '../../../src/generators/templates/TemplateOrchestrator';
import { TestType } from '../../../src/generators/TestGenerator';

describe('TemplateOrchestrator Factory Integration', () => {
  let orchestrator: TemplateOrchestrator;

  beforeEach(() => {
    orchestrator = new TemplateOrchestrator();
  });

  describe('Factory Pattern Integration', () => {
    it('should have factory registry initialized', () => {
      const factoryRegistry = orchestrator.getFactoryRegistry();
      expect(factoryRegistry).toBeDefined();
      
      const stats = factoryRegistry.getStats();
      expect(stats.totalFactories).toBeGreaterThan(0);
      expect(stats.factoriesByLanguage.get('javascript')).toBe(1);
      expect(stats.factoriesByLanguage.get('python')).toBe(1);
    });

    it('should create templates through factory system', () => {
      // Test JavaScript template creation
      const jsTemplate = orchestrator.createTemplate('jest-javascript', 'javascript');
      expect(jsTemplate).toBeDefined();
      expect(jsTemplate?.name).toBe('jest-javascript');

      // Test Python template creation
      const pythonTemplate = orchestrator.createTemplate('pytest', 'python');
      expect(pythonTemplate).toBeDefined();
      expect(pythonTemplate?.name).toBe('pytest');
    });

    it('should generate tests using factory-created templates', () => {
      const context = {
        moduleName: 'example',
        imports: [],
        exports: ['function1'],
        hasDefaultExport: false,
        testType: TestType.UNIT,
        framework: 'jest',
        language: 'javascript' as const,
        isAsync: false,
        isComponent: false,
        dependencies: [],
      };

      const result = orchestrator.generateTestSafe(context);
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('describe');
      expect(result.content).toContain('example');
    });

    it('should have enhanced templates enabled by default', () => {
      const factoryRegistry = orchestrator.getFactoryRegistry();
      const jsFactory = factoryRegistry.getFactory('javascript-template-factory');
      expect(jsFactory).toBeDefined();
      
      const capabilities = jsFactory!.getCapabilities();
      expect(capabilities.supportsEnhanced).toBe(true);
      expect(capabilities.supportedTemplates).toContain('enhanced-jest-javascript');
    });

    it('should list templates from factory system', () => {
      const templates = orchestrator.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      
      // Should have JavaScript templates
      const jsTemplates = templates.filter(t => t.language === 'javascript');
      expect(jsTemplates.length).toBeGreaterThan(0);
      
      // Should have Python templates
      const pythonTemplates = templates.filter(t => t.language === 'python');
      expect(pythonTemplates.length).toBeGreaterThan(0);
    });

    it('should maintain backward compatibility with legacy template selection', () => {
      const context = {
        moduleName: 'react-component',
        imports: ['React'],
        exports: ['MyComponent'],
        hasDefaultExport: true,
        testType: TestType.COMPONENT,
        framework: 'react',
        language: 'javascript' as const,
        isAsync: false,
        isComponent: true,
        dependencies: ['react'],
      };

      const result = orchestrator.generateTestSafe(context);
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('react-component');
      expect(result.content).toContain('component');
    });
  });
});