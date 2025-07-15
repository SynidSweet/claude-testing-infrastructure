import { testFixtureManager, ProjectFixture } from './TestFixtureManager';
import { promises as fs } from 'fs';

/**
 * Convenience utilities for using shared test fixtures in Jest tests
 */

/**
 * Sets up global fixture management for test suites
 * Call this in beforeAll() for test suites that use shared fixtures
 */
export async function setupSharedFixtures(): Promise<void> {
  await testFixtureManager.initialize();
}

/**
 * Cleans up all shared fixtures
 * Call this in afterAll() for test suites that use shared fixtures
 */
export async function cleanupSharedFixtures(): Promise<void> {
  await testFixtureManager.cleanup();
}

/**
 * Gets a shared fixture (cached across tests) for read-only operations
 * Use this when you only need to read files or analyze the project structure
 */
export async function getSharedFixture(templateId: string): Promise<ProjectFixture> {
  return testFixtureManager.getFixture(templateId);
}

/**
 * Creates a temporary project from a template for write operations
 * Use this when you need to modify files or when test isolation is critical
 * Remember to clean up the returned path in your test's afterEach
 */
export async function createTemporaryProject(templateId: string): Promise<string> {
  return testFixtureManager.createTemporaryProject(templateId);
}

/**
 * Helper to clean up a temporary project directory
 */
export async function cleanupTemporaryProject(projectPath: string): Promise<void> {
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Jest setup helper for shared fixtures
 * Use this pattern in describe blocks that use shared fixtures:
 * 
 * describe('My Test Suite', () => {
 *   setupFixtureLifecycle();
 *   
 *   it('should analyze project', async () => {
 *     const fixture = await getSharedFixture('react-project');
 *     // ... test code
 *   });
 * });
 */
export function setupFixtureLifecycle(): void {
  beforeAll(async () => {
    await setupSharedFixtures();
  });

  afterAll(async () => {
    await cleanupSharedFixtures();
  });
}

/**
 * Available template IDs for convenience
 */
export const FIXTURE_TEMPLATES = {
  EMPTY: 'empty',
  NODE_JS_BASIC: 'node-js-basic',
  REACT_PROJECT: 'react-project',
  VUE_PROJECT: 'vue-project',
  ANGULAR_PROJECT: 'angular-project',
  EXPRESS_PROJECT: 'express-project',
  SVELTE_PROJECT: 'svelte-project',
  NUXT_PROJECT: 'nuxt-project',
  PYTHON_PROJECT: 'python-project',
  FASTAPI_PROJECT: 'fastapi-project',
  FLASK_PROJECT: 'flask-project',
  DJANGO_PROJECT: 'django-project',
  MCP_SERVER: 'mcp-server',
  MIXED_PROJECT: 'mixed-project',
  // New templates for specific test scenarios
  TYPESCRIPT_VUE_PROJECT: 'typescript-vue-project',
  NEXTJS_PROJECT: 'nextjs-project',
  FASTMCP_PROJECT: 'fastmcp-project',
  MCP_WITH_CONFIG: 'mcp-with-config',
  MULTI_FRAMEWORK_PROJECT: 'multi-framework-project',
  COMPLEXITY_TEST_PROJECT: 'complexity-test-project',
  MALFORMED_PACKAGE_JSON: 'malformed-package-json',
  EMPTY_PACKAGE_JSON: 'empty-package-json',
  NO_DEPS_PACKAGE_JSON: 'no-deps-package-json',
  PYTHON_CASE_VARIATIONS: 'python-case-variations',
  REACT_NO_DOM_PROJECT: 'react-no-dom-project'
} as const;

export type FixtureTemplateId = typeof FIXTURE_TEMPLATES[keyof typeof FIXTURE_TEMPLATES];