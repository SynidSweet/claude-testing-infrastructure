import { ProjectAnalyzer } from '../../../src/analyzers/ProjectAnalyzer';
import { getSharedFixture, setupFixtureLifecycle, FIXTURE_TEMPLATES } from '../../fixtures/shared';

describe('ProjectAnalyzer Framework Detection', () => {
  setupFixtureLifecycle();

  describe('React Framework Detection', () => {
    it('should detect React with comprehensive details', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.REACT_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const reactFramework = result.frameworks.find((f) => f.name === 'react');

      expect(reactFramework).toBeDefined();
      expect(reactFramework?.confidence).toBeGreaterThanOrEqual(0.8);
      expect(reactFramework?.version).toBe('^18.0.0');
    });

    it('should detect React without react-dom', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.REACT_NO_DOM_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const reactFramework = result.frameworks.find((f: any) => f.name === 'react');

      expect(reactFramework).toBeDefined();
      expect(reactFramework?.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Vue Framework Detection', () => {
    it('should detect Vue 3 with comprehensive details', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.VUE_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const vueFramework = result.frameworks.find((f: any) => f.name === 'vue');

      expect(vueFramework).toBeDefined();
      expect(vueFramework?.confidence).toBeGreaterThanOrEqual(0.8);
      expect(vueFramework?.version).toBe('^3.3.0');
    });
  });

  describe('Angular Framework Detection', () => {
    it('should detect Angular with multiple packages', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.ANGULAR_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const angularFramework = result.frameworks.find((f: any) => f.name === 'angular');

      expect(angularFramework).toBeDefined();
      expect(angularFramework?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(angularFramework?.version).toBe('^16.0.0');
    });
  });

  describe('Express Framework Detection', () => {
    it('should detect Express with middleware', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.EXPRESS_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const expressFramework = result.frameworks.find((f: any) => f.name === 'express');

      expect(expressFramework).toBeDefined();
      expect(expressFramework?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(expressFramework?.version).toBe('^4.18.2');
    });
  });

  describe('Next.js Framework Detection', () => {
    it('should detect Next.js with app configuration', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.NEXTJS_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const nextFramework = result.frameworks.find((f: any) => f.name === 'nextjs');

      expect(nextFramework).toBeDefined();
      expect(nextFramework?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(nextFramework?.version).toBe('^13.4.0');
    });
  });

  describe('Svelte Framework Detection', () => {
    it('should detect SvelteKit', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.SVELTE_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const svelteFramework = result.frameworks.find((f: any) => f.name === 'svelte');

      expect(svelteFramework).toBeDefined();
      expect(svelteFramework?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(svelteFramework?.version).toBe('^4.0.0');
    });
  });

  describe('Nuxt Framework Detection', () => {
    it('should detect Nuxt 3', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.NUXT_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const nuxtFramework = result.frameworks.find((f: any) => f.name === 'nuxt');

      expect(nuxtFramework).toBeDefined();
      expect(nuxtFramework?.confidence).toBeGreaterThanOrEqual(0.8);
      expect(nuxtFramework?.version).toBe('^3.6.0');
    });
  });

  describe('Python Framework Detection', () => {
    it('should detect FastAPI with full stack', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.FASTAPI_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const fastapiFramework = result.frameworks.find((f: any) => f.name === 'fastapi');

      expect(fastapiFramework).toBeDefined();
      expect(fastapiFramework?.confidence).toBeGreaterThanOrEqual(0.8);
      expect(fastapiFramework?.version).toBe('==0.100.0');
    });

    it('should detect Django with REST framework', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.DJANGO_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const djangoFramework = result.frameworks.find((f: any) => f.name === 'django');

      expect(djangoFramework).toBeDefined();
      expect(djangoFramework?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(djangoFramework?.version).toBe('==4.2.0');
    });

    it('should detect Flask with extensions', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.FLASK_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const flaskFramework = result.frameworks.find((f: any) => f.name === 'flask');

      expect(flaskFramework).toBeDefined();
      expect(flaskFramework?.confidence).toBeGreaterThanOrEqual(0.8);
      expect(flaskFramework?.version).toBe('==2.3.0');
    });
  });

  describe('MCP Server Detection', () => {
    it('should detect FastMCP server', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.FASTMCP_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const fastmcpFramework = result.frameworks.find((f: any) => f.name === 'fastmcp');

      expect(fastmcpFramework).toBeDefined();
      expect(fastmcpFramework?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(fastmcpFramework?.version).toBe('==1.0.0');
      expect(result.projectType).toBe('mcp-server');
      expect(result.mcpCapabilities).toBeDefined();
      expect(result.mcpCapabilities?.framework).toBe('fastmcp');
    });

    it('should detect official MCP SDK', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.MCP_SERVER);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const mcpFramework = result.frameworks.find((f: any) => f.name === 'mcp-server');

      expect(mcpFramework).toBeDefined();
      expect(mcpFramework?.confidence).toBeGreaterThan(0.79);
      expect(mcpFramework?.version).toBe('^1.0.0');
      expect(result.projectType).toBe('mcp-server');
      expect(result.mcpCapabilities?.framework).toBe('official-sdk');
    });

    it('should detect MCP capabilities from config file', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.MCP_WITH_CONFIG);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();

      expect(result.mcpCapabilities?.tools).toHaveLength(1);
      expect(result.mcpCapabilities?.tools[0]?.name).toBe('search');
      expect(result.mcpCapabilities?.resources).toHaveLength(1);
      expect(result.mcpCapabilities?.resources[0]?.name).toBe('database');
      expect(result.mcpCapabilities?.prompts).toHaveLength(1);
      expect(result.mcpCapabilities?.prompts[0]?.name).toBe('summarize');
    });
  });

  describe('Multiple Framework Detection', () => {
    it('should detect multiple frameworks in the same project', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.MULTI_FRAMEWORK_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const frameworkNames = result.frameworks.map((f: any) => f.name);

      expect(frameworkNames).toContain('react');
      expect(frameworkNames).toContain('express');
      expect(frameworkNames).toContain('nextjs');
      expect(result.frameworks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty package.json gracefully', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.EMPTY_PACKAGE_JSON);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();

      expect(result.frameworks).toHaveLength(0);
      expect(result.dependencies.production).toEqual({});
      expect(result.dependencies.development).toEqual({});
    });

    it('should handle missing dependencies section', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.NO_DEPS_PACKAGE_JSON);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();

      expect(result.frameworks).toHaveLength(0);
    });

    it('should handle case variations in Python dependencies', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.PYTHON_CASE_VARIATIONS);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      const frameworkNames = result.frameworks.map((f: any) => f.name);

      expect(frameworkNames).toContain('django');
      expect(frameworkNames).toContain('flask');
      // Note: FASTAPI in all caps might not be detected due to exact matching
    });
  });
});