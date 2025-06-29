import { TestType } from '../TestGenerator';

export interface TemplateContext {
  moduleName: string;
  modulePath?: string; // For Python: proper module path (e.g., 'src.utils.helpers')
  imports: string[];
  exports: string[];
  hasDefaultExport: boolean;
  testType: TestType;
  framework: string;
  language: 'javascript' | 'typescript' | 'python';
  isAsync: boolean;
  isComponent: boolean;
  dependencies: string[];
}

export interface Template {
  name: string;
  language: 'javascript' | 'typescript' | 'python';
  framework?: string;
  testType?: TestType;
  generate(context: TemplateContext): string;
}

/**
 * Test template engine that manages framework-specific test templates
 */
export class TestTemplateEngine {
  private templates: Map<string, Template> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  /**
   * Register a template
   */
  registerTemplate(template: Template): void {
    const key = this.getTemplateKey(template.language, template.framework, template.testType);
    this.templates.set(key, template);
  }

  /**
   * Generate test content using the most appropriate template
   */
  generateTest(context: TemplateContext): string {
    const template = this.findBestTemplate(context);
    if (!template) {
      throw new Error(`No template found for ${context.language}/${context.framework}/${context.testType}`);
    }
    
    return template.generate(context);
  }

  /**
   * Find the best matching template for the given context
   */
  private findBestTemplate(context: TemplateContext): Template | undefined {
    // Try exact match first
    let key = this.getTemplateKey(context.language, context.framework, context.testType);
    let template = this.templates.get(key);
    if (template) return template;

    // Try without test type
    key = this.getTemplateKey(context.language, context.framework);
    template = this.templates.get(key);
    if (template) return template;

    // Try without framework
    key = this.getTemplateKey(context.language, undefined, context.testType);
    template = this.templates.get(key);
    if (template) return template;

    // Try language with default framework (jest for JS/TS, pytest for Python)
    const defaultFramework = context.language === 'python' ? 'pytest' : 'jest';
    key = this.getTemplateKey(context.language, defaultFramework);
    template = this.templates.get(key);
    if (template) return template;

    // Try language only
    key = this.getTemplateKey(context.language);
    template = this.templates.get(key);
    if (template) return template;

    return undefined;
  }

  /**
   * Generate a key for template lookup
   */
  private getTemplateKey(language: string, framework?: string, testType?: TestType): string {
    const parts = [language];
    if (framework) parts.push(framework);
    if (testType) parts.push(testType);
    return parts.join(':');
  }

  /**
   * Register default templates for common frameworks
   */
  private registerDefaultTemplates(): void {
    // JavaScript Jest templates
    this.registerTemplate(new JestJavaScriptTemplate());
    this.registerTemplate(new JestReactComponentTemplate());
    this.registerTemplate(new JestExpressApiTemplate());
    
    // TypeScript Jest templates
    this.registerTemplate(new JestTypeScriptTemplate());
    this.registerTemplate(new JestReactTypeScriptTemplate());
    
    // Python pytest templates
    this.registerTemplate(new PytestTemplate());
    this.registerTemplate(new PytestFastApiTemplate());
    this.registerTemplate(new PytestDjangoTemplate());
  }
}

// JavaScript Jest Templates
class JestJavaScriptTemplate implements Template {
  name = 'jest-javascript';
  language = 'javascript' as const;
  framework = 'jest';

  generate(context: TemplateContext): string {
    const { moduleName, exports, hasDefaultExport } = context;
    
    let importStatement = '';
    if (hasDefaultExport) {
      importStatement = `const ${moduleName} = require('./${moduleName}');`;
    } else if (exports.length > 0) {
      importStatement = `const { ${exports.join(', ')} } = require('./${moduleName}');`;
    }

    let testContent = `${importStatement}

describe('${moduleName}', () => {
`;

    if (hasDefaultExport) {
      testContent += `  it('should be defined', () => {
    expect(${moduleName}).toBeDefined();
  });

`;
    }

    exports.forEach(exportName => {
      testContent += `  describe('${exportName}', () => {
    it('should be defined', () => {
      expect(${exportName}).toBeDefined();
    });

    it('should work correctly', () => {
      // TODO: Add test implementation
      expect(true).toBe(true);
    });
  });

`;
    });

    testContent += '});';
    return testContent;
  }
}

class JestReactComponentTemplate implements Template {
  name = 'jest-react-component';
  language = 'javascript' as const;
  framework = 'react';
  testType = TestType.COMPONENT;

  generate(context: TemplateContext): string {
    const { moduleName, hasDefaultExport } = context;
    
    const componentName = hasDefaultExport ? moduleName : 'Component';
    
    return `const React = require('react');
const { render, screen } = require('@testing-library/react');
require('@testing-library/jest-dom');
${hasDefaultExport ? `const ${componentName} = require('./${moduleName}');` : `const { ${componentName} } = require('./${moduleName}');`}

describe('${componentName}', () => {
  it('should render without crashing', () => {
    render(<${componentName} />);
  });

  it('should match snapshot', () => {
    const { container } = render(<${componentName} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should display expected content', () => {
    render(<${componentName} />);
    // TODO: Add specific content assertions
    expect(screen.getByRole('${this.guessComponentRole(componentName)}')).toBeInTheDocument();
  });

  it('should handle user interactions', () => {
    render(<${componentName} />);
    // TODO: Add interaction tests
  });
});
`;
  }

  private guessComponentRole(componentName: string): string {
    const name = componentName.toLowerCase();
    if (name.includes('button')) return 'button';
    if (name.includes('input')) return 'textbox';
    if (name.includes('form')) return 'form';
    if (name.includes('nav')) return 'navigation';
    if (name.includes('header')) return 'banner';
    if (name.includes('footer')) return 'contentinfo';
    return 'generic';
  }
}

class JestExpressApiTemplate implements Template {
  name = 'jest-express-api';
  language = 'javascript' as const;
  framework = 'express';
  testType = TestType.API;

  generate(context: TemplateContext): string {
    const { moduleName, exports } = context;
    
    return `const request = require('supertest');
const express = require('express');
const { ${exports.join(', ')} } = require('./${moduleName}');

const app = express();
app.use(express.json());

describe('${moduleName} API', () => {
  beforeEach(() => {
    // Setup test database or mock services
  });

  afterEach(() => {
    // Cleanup
  });

${exports.map(exportName => `
  describe('${exportName}', () => {
    it('should handle successful requests', async () => {
      const response = await request(app)
        .get('/api/test') // TODO: Update with actual endpoint
        .expect(200);
        
      expect(response.body).toBeDefined();
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/test') // TODO: Update with actual endpoint
        .send({}) // Invalid data
        .expect(400);
        
      expect(response.body.error).toBeDefined();
    });

    it('should handle authentication', async () => {
      // TODO: Add authentication tests
    });
  });
`).join('')}
});
`;
  }
}

// TypeScript Templates
class JestTypeScriptTemplate implements Template {
  name = 'jest-typescript';
  language = 'typescript' as const;
  framework = 'jest';

  generate(context: TemplateContext): string {
    const { moduleName, exports, hasDefaultExport } = context;
    
    let importStatement = '';
    if (hasDefaultExport) {
      importStatement = `const ${moduleName} = require('./${moduleName}');`;
    } else if (exports.length > 0) {
      importStatement = `const { ${exports.join(', ')} } = require('./${moduleName}');`;
    }

    let testContent = `${importStatement}

describe('${moduleName}', () => {
`;

    if (hasDefaultExport) {
      testContent += `  it('should be defined', () => {
    expect(${moduleName}).toBeDefined();
  });

`;
    }

    exports.forEach(exportName => {
      testContent += `  describe('${exportName}', () => {
    it('should be defined', () => {
      expect(${exportName}).toBeDefined();
    });

    it('should have correct TypeScript types', () => {
      // TODO: Add type-specific tests
      expect(typeof ${exportName}).toBe('function');
    });

    it('should work correctly', () => {
      // TODO: Add test implementation
      expect(true).toBe(true);
    });
  });

`;
    });

    testContent += '});';
    return testContent;
  }
}

class JestReactTypeScriptTemplate implements Template {
  name = 'jest-react-typescript';
  language = 'typescript' as const;
  framework = 'react';
  testType = TestType.COMPONENT;

  generate(context: TemplateContext): string {
    const { moduleName, hasDefaultExport } = context;
    
    const componentName = hasDefaultExport ? moduleName : 'Component';
    
    return `const React = require('react');
const { render, screen } = require('@testing-library/react');
require('@testing-library/jest-dom');
${hasDefaultExport ? `const ${componentName} = require('./${moduleName}');` : `const { ${componentName} } = require('./${moduleName}');`}

describe('${componentName}', () => {
  let renderResult: RenderResult;

  beforeEach(() => {
    renderResult = render(<${componentName} />);
  });

  it('should render without crashing', () => {
    expect(renderResult.container).toBeInTheDocument();
  });

  it('should match snapshot', () => {
    expect(renderResult.container.firstChild).toMatchSnapshot();
  });

  it('should have correct TypeScript props', () => {
    // TODO: Add prop type tests
  });

  it('should handle user interactions with type safety', () => {
    // TODO: Add typed interaction tests
  });
});
`;
  }
}

// Python pytest Templates
class PytestTemplate implements Template {
  name = 'pytest';
  language = 'python' as const;
  framework = 'pytest';

  generate(context: TemplateContext): string {
    const { moduleName, modulePath, exports } = context;
    
    // Use modulePath for imports, fall back to moduleName if not provided
    const importModule = modulePath || moduleName;
    
    // Filter out empty or whitespace-only exports
    const validExports = exports.filter(exp => exp && exp.trim());
    
    // Handle empty exports case
    const importStatement = validExports.length > 0 
      ? `from ${importModule} import ${validExports.join(', ')}`
      : `import ${importModule}`;
    
    // Clean moduleName for class name (replace dots and hyphens with underscores)
    const className = moduleName.replace(/[\.-]/g, '_');
    
    return `"""Tests for ${moduleName} module."""
import pytest
${importStatement}


class Test${this.capitalize(className)}:
    """Test class for ${moduleName} module."""

${validExports.length > 0 ? validExports.map(exportName => `
    def test_${exportName.toLowerCase()}_exists(self):
        """Test that ${exportName} is defined and importable."""
        assert ${exportName} is not None

    def test_${exportName.toLowerCase()}_basic_functionality(self):
        """Test basic functionality of ${exportName}."""
        # TODO: Implement actual test logic
        assert True

    def test_${exportName.toLowerCase()}_error_handling(self):
        """Test error handling in ${exportName}."""
        # TODO: Test error conditions
        pass
`).join('') : `
    def test_module_import(self):
        """Test that the module can be imported."""
        assert ${moduleName} is not None

    def test_module_attributes(self):
        """Test module attributes and contents."""
        # TODO: Add tests for module attributes
        pass
`}
`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

class PytestFastApiTemplate implements Template {
  name = 'pytest-fastapi';
  language = 'python' as const;
  framework = 'fastapi';
  testType = TestType.API;

  generate(context: TemplateContext): string {
    const { moduleName, modulePath, exports } = context;
    
    // Use modulePath for imports, fall back to moduleName if not provided
    const importModule = modulePath || moduleName;
    
    // Filter out empty or whitespace-only exports
    const validExports = exports.filter(exp => exp && exp.trim());
    
    // Handle empty exports case
    const importStatement = validExports.length > 0 
      ? `from ${importModule} import ${validExports.join(', ')}`
      : `import ${importModule}`;
    
    return `"""Tests for ${moduleName} FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
${importStatement}


@pytest.fixture
def client():
    """Create test client."""
    from main import app  # TODO: Update import path
    return TestClient(app)


class Test${this.capitalize(moduleName)}Api:
    """Test class for ${moduleName} API endpoints."""

${validExports.map(exportName => `
    def test_${exportName.toLowerCase()}_get_success(self, client):
        """Test successful GET request for ${exportName}."""
        response = client.get("/api/${exportName.toLowerCase()}")  # TODO: Update endpoint
        assert response.status_code == 200
        assert response.json() is not None

    def test_${exportName.toLowerCase()}_post_success(self, client):
        """Test successful POST request for ${exportName}."""
        test_data = {}  # TODO: Add test data
        response = client.post("/api/${exportName.toLowerCase()}", json=test_data)
        assert response.status_code in [200, 201]

    def test_${exportName.toLowerCase()}_validation_error(self, client):
        """Test validation error handling for ${exportName}."""
        invalid_data = {}  # TODO: Add invalid data
        response = client.post("/api/${exportName.toLowerCase()}", json=invalid_data)
        assert response.status_code == 422

    def test_${exportName.toLowerCase()}_not_found(self, client):
        """Test 404 error handling for ${exportName}."""
        response = client.get("/api/${exportName.toLowerCase()}/nonexistent")
        assert response.status_code == 404
`).join('')}
`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

class PytestDjangoTemplate implements Template {
  name = 'pytest-django';
  language = 'python' as const;
  framework = 'django';
  testType = TestType.API;

  generate(context: TemplateContext): string {
    const { moduleName, modulePath, exports } = context;
    
    // Use modulePath for imports, fall back to moduleName if not provided
    const importModule = modulePath || moduleName;
    
    // Filter out empty or whitespace-only exports
    const validExports = exports.filter(exp => exp && exp.trim());
    
    // Handle empty exports case
    const importStatement = validExports.length > 0 
      ? `from ${importModule} import ${validExports.join(', ')}`
      : `import ${importModule}`;
    
    return `"""Tests for ${moduleName} Django views."""
import pytest
from django.test import Client
from django.urls import reverse
${importStatement}


@pytest.mark.django_db
class Test${this.capitalize(moduleName)}Views:
    """Test class for ${moduleName} Django views."""

    def setup_method(self):
        """Set up test fixtures."""
        self.client = Client()
        # TODO: Create test data

${validExports.map(exportName => `
    def test_${exportName.toLowerCase()}_get_success(self):
        """Test successful GET request for ${exportName}."""
        url = reverse('${exportName.toLowerCase()}')  # TODO: Update URL name
        response = self.client.get(url)
        assert response.status_code == 200

    def test_${exportName.toLowerCase()}_post_success(self):
        """Test successful POST request for ${exportName}."""
        url = reverse('${exportName.toLowerCase()}')  # TODO: Update URL name
        data = {}  # TODO: Add test data
        response = self.client.post(url, data)
        assert response.status_code in [200, 201, 302]

    def test_${exportName.toLowerCase()}_authentication_required(self):
        """Test authentication requirement for ${exportName}."""
        # TODO: Test authentication requirements
        pass

    def test_${exportName.toLowerCase()}_permissions(self):
        """Test permissions for ${exportName}."""
        # TODO: Test user permissions
        pass
`).join('')}
`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}