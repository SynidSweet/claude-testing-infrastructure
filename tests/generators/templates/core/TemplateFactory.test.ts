import { 
  TemplateFactory, 
  TemplateFactoryRegistry,
  JavaScriptTemplateFactory,
  PythonTemplateFactory,
  createCompleteTemplateSystem
} from '../../../../src/generators/templates/core';
import type { TemplateCreationRequest } from '../../../../src/generators/templates/core';

describe('Template Factory System', () => {
  describe('JavaScriptTemplateFactory', () => {
    let factory: JavaScriptTemplateFactory;

    beforeEach(() => {
      factory = new JavaScriptTemplateFactory();
    });

    it('should create factory with correct capabilities', () => {
      const capabilities = factory.getCapabilities();
      
      expect(capabilities.language).toBe('javascript');
      expect(capabilities.supportedTemplates).toContain('jest-javascript');
      expect(capabilities.supportedTemplates).toContain('jest-react-component');
      expect(capabilities.supportedTemplates).toContain('enhanced-jest-javascript');
      expect(capabilities.supportedFrameworks).toContain('jest');
      expect(capabilities.supportedFrameworks).toContain('react');
    });

    it('should create basic JavaScript template', () => {
      const request: TemplateCreationRequest = {
        templateName: 'jest-javascript'
      };

      const result = factory.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.name).toContain('jest');
      expect(result.template?.language).toBe('javascript');
    });

    it('should create React component template', () => {
      const request: TemplateCreationRequest = {
        templateName: 'jest-react-component',
        framework: 'react'
      };

      const result = factory.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.framework).toBe('react');
    });

    it('should create enhanced templates when available', () => {
      const request: TemplateCreationRequest = {
        templateName: 'enhanced-jest-javascript'
      };

      const result = factory.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      // Should either get enhanced template or fallback to basic template
      expect(result.template?.language).toBe('javascript');
    });

    it('should fail for unknown template', () => {
      const request: TemplateCreationRequest = {
        templateName: 'unknown-template'
      };

      const result = factory.createTemplate(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should get default templates', () => {
      const templates = factory.getDefaultTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name.includes('jest'))).toBe(true);
    });

    it('should get enhanced templates', () => {
      const templates = factory.getEnhancedTemplates();
      
      // Should return array (enhanced templates may or may not be available)
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('PythonTemplateFactory', () => {
    let factory: PythonTemplateFactory;

    beforeEach(() => {
      factory = new PythonTemplateFactory();
    });

    it('should create factory with correct capabilities', () => {
      const capabilities = factory.getCapabilities();
      
      expect(capabilities.language).toBe('python');
      expect(capabilities.supportedTemplates).toContain('pytest');
      expect(capabilities.supportedTemplates).toContain('pytest-fastapi');
      expect(capabilities.supportedFrameworks).toContain('pytest');
      expect(capabilities.supportedFrameworks).toContain('fastapi');
    });

    it('should create basic pytest template', () => {
      const request: TemplateCreationRequest = {
        templateName: 'pytest'
      };

      const result = factory.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.language).toBe('python');
    });

    it('should create FastAPI template', () => {
      const request: TemplateCreationRequest = {
        templateName: 'pytest-fastapi',
        framework: 'fastapi'
      };

      const result = factory.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.framework).toBe('fastapi');
    });
  });

  describe('TemplateFactoryRegistry', () => {
    let registry: TemplateFactoryRegistry;

    beforeEach(() => {
      registry = new TemplateFactoryRegistry();
    });

    it('should register factories', () => {
      const jsFactory = new JavaScriptTemplateFactory();
      const pythonFactory = new PythonTemplateFactory();

      const result1 = registry.registerFactory(jsFactory);
      const result2 = registry.registerFactory(pythonFactory);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should prevent duplicate factory names', () => {
      const factory1 = new JavaScriptTemplateFactory();
      const factory2 = new JavaScriptTemplateFactory();

      registry.registerFactory(factory1);
      const result = registry.registerFactory(factory2);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should find factory for template', () => {
      const jsFactory = new JavaScriptTemplateFactory();
      registry.registerFactory(jsFactory);

      const factory = registry.findFactoryForTemplate('jest-javascript');
      
      expect(factory).toBe(jsFactory);
    });

    it('should create template through registry', () => {
      const jsFactory = new JavaScriptTemplateFactory();
      registry.registerFactory(jsFactory);

      const request: TemplateCreationRequest = {
        templateName: 'jest-javascript'
      };

      const result = registry.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
    });

    it('should get registry statistics', () => {
      const jsFactory = new JavaScriptTemplateFactory();
      const pythonFactory = new PythonTemplateFactory();
      
      registry.registerFactory(jsFactory);
      registry.registerFactory(pythonFactory);

      const stats = registry.getStats();
      
      expect(stats.totalFactories).toBe(2);
      expect(stats.factoriesByLanguage.get('javascript')).toBe(1);
      expect(stats.factoriesByLanguage.get('python')).toBe(1);
      expect(stats.supportedTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Template System Integration', () => {
    it('should create complete template system with factories', () => {
      const system = createCompleteTemplateSystem();
      
      expect(system.templateEngine).toBeDefined();
      expect(system.templateRegistry).toBeDefined();
      expect(system.factoryRegistry).toBeDefined();
      
      // Should have convenience methods
      expect(typeof system.createTemplate).toBe('function');
      expect(typeof system.listTemplates).toBe('function');
      expect(typeof system.getStats).toBe('function');
    });

    it('should have templates auto-registered from factories', () => {
      const system = createCompleteTemplateSystem();
      
      const templates = system.listTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.language === 'javascript')).toBe(true);
      expect(templates.some(t => t.language === 'python')).toBe(true);
    });

    it('should create templates through factory system', () => {
      const system = createCompleteTemplateSystem();
      
      const request: TemplateCreationRequest = {
        templateName: 'jest-javascript'
      };

      const result = system.createTemplate(request);
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
    });

    it('should provide comprehensive stats', () => {
      const system = createCompleteTemplateSystem();
      
      const stats = system.getStats();
      
      expect(stats.templates).toBeDefined();
      expect(stats.factories).toBeDefined();
      expect(stats.templates.totalTemplates).toBeGreaterThan(0);
      expect(stats.factories.totalFactories).toBeGreaterThan(0);
    });
  });
});