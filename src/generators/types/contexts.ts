/**
 * Language and framework context types for test generation
 * 
 * These types define the context information needed by test generators
 * to create appropriate tests for different languages and frameworks.
 */

import type { TestType } from '../TestGenerator';

/**
 * JavaScript/TypeScript specific context
 */
export interface JavaScriptContext {
  /** Module system detection result */
  moduleSystem: ModuleSystemInfo;
  /** React component information if applicable */
  reactInfo?: ReactComponentInfo;
  /** Vue component information if applicable */
  vueInfo?: VueComponentInfo;
  /** Angular component information if applicable */
  angularInfo?: AngularComponentInfo;
  /** Express/Node.js API information if applicable */
  apiInfo?: ApiEndpointInfo;
  /** Whether TypeScript is being used */
  isTypeScript: boolean;
  /** TypeScript configuration if available */
  tsConfig?: TypeScriptConfig;
}

/**
 * Python specific context
 */
export interface PythonContext {
  /** Python version (2 or 3) */
  version: 2 | 3;
  /** Import style (absolute or relative) */
  importStyle: 'absolute' | 'relative';
  /** FastAPI information if applicable */
  fastapiInfo?: FastAPIInfo;
  /** Django information if applicable */
  djangoInfo?: DjangoInfo;
  /** Flask information if applicable */
  flaskInfo?: FlaskInfo;
  /** Whether async is used */
  usesAsync: boolean;
  /** Testing framework (pytest, unittest, etc.) */
  testingFramework: 'pytest' | 'unittest' | 'nose';
  /** Fixture information for pytest */
  fixtures?: PytestFixture[];
}

/**
 * Module system information for JavaScript/TypeScript
 */
export interface ModuleSystemInfo {
  /** Module type detected */
  type: 'commonjs' | 'esm' | 'mixed';
  /** Whether package.json has type field */
  hasPackageJsonType: boolean;
  /** Value of package.json type field if present */
  packageJsonType?: 'module' | 'commonjs';
  /** Confidence level of detection (0-1) */
  confidence: number;
  /** File extension to use for imports */
  importExtension: '' | '.js' | '.mjs' | '.cjs';
}

/**
 * React component information
 */
export interface ReactComponentInfo {
  /** Component name */
  name: string;
  /** Component type */
  type: 'functional' | 'class';
  /** Whether component uses hooks */
  usesHooks: boolean;
  /** List of hooks used */
  hooks?: string[];
  /** Props interface/type name if TypeScript */
  propsType?: string;
  /** Whether component is exported as default */
  isDefaultExport: boolean;
}

/**
 * Vue component information
 */
export interface VueComponentInfo {
  /** Component name */
  name: string;
  /** Vue version (2 or 3) */
  version: 2 | 3;
  /** Component API style */
  apiStyle: 'options' | 'composition' | 'script-setup';
  /** Whether component uses TypeScript */
  usesTypeScript: boolean;
  /** Props definition */
  props?: string[];
  /** Emitted events */
  emits?: string[];
}

/**
 * Angular component information
 */
export interface AngularComponentInfo {
  /** Component name */
  name: string;
  /** Selector name */
  selector: string;
  /** Whether component is standalone */
  standalone: boolean;
  /** Component inputs */
  inputs?: string[];
  /** Component outputs */
  outputs?: string[];
  /** Services injected */
  services?: string[];
}

/**
 * API endpoint information
 */
export interface ApiEndpointInfo {
  /** Framework (express, koa, fastify, etc.) */
  framework: string;
  /** Route path */
  path: string;
  /** HTTP method */
  method: string;
  /** Middleware used */
  middleware?: string[];
  /** Whether endpoint is async */
  isAsync: boolean;
  /** Request validation schema if any */
  validationSchema?: string;
}

/**
 * TypeScript configuration
 */
export interface TypeScriptConfig {
  /** Whether strict mode is enabled */
  strict: boolean;
  /** Module resolution strategy */
  moduleResolution: 'node' | 'bundler';
  /** Target ES version */
  target: string;
  /** Whether source maps are enabled */
  sourceMap: boolean;
  /** Path aliases if configured */
  paths?: Record<string, string[]>;
}

/**
 * FastAPI specific information
 */
export interface FastAPIInfo {
  /** Router or app instance name */
  appName: string;
  /** List of route decorators found */
  routes: FastAPIRoute[];
  /** Whether async routes are used */
  hasAsyncRoutes: boolean;
  /** Pydantic models used */
  models?: string[];
  /** Dependencies defined */
  dependencies?: string[];
}

/**
 * FastAPI route information
 */
export interface FastAPIRoute {
  /** HTTP method */
  method: string;
  /** Route path */
  path: string;
  /** Function name */
  functionName: string;
  /** Whether route is async */
  isAsync: boolean;
  /** Response model if specified */
  responseModel?: string;
}

/**
 * Django specific information
 */
export interface DjangoInfo {
  /** Type of Django file */
  fileType: 'model' | 'view' | 'serializer' | 'form' | 'admin' | 'signal' | 'middleware';
  /** Class or function names defined */
  definitions: string[];
  /** Whether class-based views are used */
  usesClassBasedViews?: boolean;
  /** Model fields for model files */
  modelFields?: string[];
}

/**
 * Flask specific information
 */
export interface FlaskInfo {
  /** Blueprint or app instance name */
  appName: string;
  /** List of route decorators found */
  routes: FlaskRoute[];
  /** Whether async routes are used (Flask 2.0+) */
  hasAsyncRoutes: boolean;
  /** Extensions used (SQLAlchemy, etc.) */
  extensions?: string[];
}

/**
 * Flask route information
 */
export interface FlaskRoute {
  /** HTTP methods */
  methods: string[];
  /** Route path */
  path: string;
  /** Function name */
  functionName: string;
  /** Whether route is async */
  isAsync: boolean;
}

/**
 * Pytest fixture information
 */
export interface PytestFixture {
  /** Fixture name */
  name: string;
  /** Fixture scope */
  scope: 'function' | 'class' | 'module' | 'package' | 'session';
  /** Whether fixture uses async */
  isAsync: boolean;
  /** Parameters the fixture depends on */
  dependencies?: string[];
}

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
  /** Primary framework detected */
  primary: string;
  /** Secondary frameworks or libraries */
  secondary: string[];
  /** Confidence level (0-1) */
  confidence: number;
  /** Framework version if detected */
  version?: string;
  /** Framework-specific context */
  context?: JavaScriptContext | PythonContext;
}

/**
 * Test generation context that combines all relevant information
 */
export interface TestGenerationContext {
  /** Source file being tested */
  sourceFile: string;
  /** Language detected */
  language: 'javascript' | 'typescript' | 'python';
  /** Framework detection result */
  framework: FrameworkDetectionResult;
  /** Test type to generate */
  testType: TestType;
  /** Language-specific context */
  languageContext: JavaScriptContext | PythonContext;
  /** Custom template if provided */
  customTemplate?: string;
  /** Additional options */
  options?: Record<string, any>;
}