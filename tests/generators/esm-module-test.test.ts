/**
 * Test to verify ES Module support in test generation
 * This addresses the user-reported issue where tests generated CommonJS require() 
 * syntax despite projects being ES modules, causing 0 tests to execute.
 */
import { TestTemplateEngine, TemplateContext } from '../../src/generators/templates/TestTemplateEngine';
import { TestType } from '../../src/generators/TestGenerator';

describe('ES Module Support', () => {
  let engine: TestTemplateEngine;

  beforeEach(() => {
    engine = new TestTemplateEngine();
  });

  describe('JavaScript ES Module Templates', () => {
    it('should generate ES module imports for named exports', () => {
      const context: TemplateContext = {
        moduleName: 'calculator',
        imports: [],
        exports: ['add', 'subtract'],
        hasDefaultExport: false,
        testType: TestType.UTILITY,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'esm' // This is the key - ES module system
      };

      const result = engine.generateTest(context);
      
      // Should generate ES module import syntax with .js extension
      expect(result).toContain("import { add, subtract } from './calculator.js';");
      expect(result).not.toContain("require('./calculator')");
      expect(result).toContain("describe('calculator', () => {");
      expect(result).toContain("describe('add', () => {");
      expect(result).toContain('expect(add).toBeDefined()');
    });

    it('should generate ES module imports for default export only', () => {
      const context: TemplateContext = {
        moduleName: 'utils',
        imports: [],
        exports: [],
        hasDefaultExport: true,
        testType: TestType.UTILITY,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate default import with .js extension
      expect(result).toContain("import utils from './utils.js';");
      expect(result).not.toContain("require('./utils')");
      expect(result).toContain('should export a default value');
    });

    it('should generate ES module imports for mixed default and named exports', () => {
      const context: TemplateContext = {
        moduleName: 'api',
        imports: [],
        exports: ['get', 'post'],
        hasDefaultExport: true,
        testType: TestType.API,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate mixed import syntax with .js extension
      expect(result).toContain("import api, { get, post } from './api.js';");
      expect(result).not.toContain("require('./api')");
      expect(result).toContain('should export a default value');
      expect(result).toContain("describe('get', () => {");
    });

    it('should generate fallback wildcard import when no exports detected', () => {
      const context: TemplateContext = {
        moduleName: 'mystery',
        imports: [],
        exports: [],
        hasDefaultExport: false,
        testType: TestType.UTILITY,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate wildcard import with .js extension
      expect(result).toContain("import * as mystery from './mystery.js';");
      expect(result).not.toContain("require('./mystery')");
      expect(result).toContain('should be a valid module structure');
    });
  });

  describe('React ES Module Component Templates', () => {
    it('should generate ES module React component test', () => {
      const context: TemplateContext = {
        moduleName: 'Button',
        imports: ['React'],
        exports: [],
        hasDefaultExport: true,
        testType: TestType.COMPONENT,
        framework: 'react',
        language: 'javascript',
        isAsync: false,
        isComponent: true,
        dependencies: ['react'],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate ES module React imports with .js extension
      expect(result).toContain("import React from 'react';");
      expect(result).toContain("import { render, screen");
      expect(result).toContain("@testing-library/react");
      expect(result).toContain("import Button from './Button.js';");
      expect(result).not.toContain("const React = require('react');");
      expect(result).not.toContain("const Button = require('./Button');");
      expect(result).toContain('render(<Button />)');
    });

    it('should generate ES module React component test with named export', () => {
      const context: TemplateContext = {
        moduleName: 'Card',
        imports: ['React'],
        exports: ['Card'],
        hasDefaultExport: false,
        testType: TestType.COMPONENT,
        framework: 'react',
        language: 'javascript',
        isAsync: false,
        isComponent: true,
        dependencies: ['react'],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate ES module React imports for named component
      expect(result).toContain("import React from 'react';");
      expect(result).toContain("import { Card } from './Card.js';");
      expect(result).not.toContain("const { Card } = require('./Card');");
      expect(result).toContain('render(<Card />)');
    });
  });

  describe('TypeScript ES Module Templates', () => {
    it('should generate ES module TypeScript test', () => {
      const context: TemplateContext = {
        moduleName: 'userService',
        imports: [],
        exports: ['UserService'],
        hasDefaultExport: false,
        testType: TestType.SERVICE,
        framework: 'jest',
        language: 'typescript',
        isAsync: true,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate ES module TypeScript imports with .js extension
      expect(result).toContain("import { UserService } from './userService.js';");
      expect(result).not.toContain("const { UserService } = require('./userService');");
      expect(result).toContain('should have correct TypeScript types');
    });

    it('should generate ES module React TypeScript component test', () => {
      const context: TemplateContext = {
        moduleName: 'UserCard',
        imports: ['React'],
        exports: [],
        hasDefaultExport: true,
        testType: TestType.COMPONENT,
        framework: 'react',
        language: 'typescript',
        isAsync: false,
        isComponent: true,
        dependencies: ['react'],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate ES module React TypeScript imports with .js extension
      expect(result).toContain("import React from 'react';");
      expect(result).toContain("import { render, screen, RenderResult } from '@testing-library/react';");
      expect(result).toContain("import UserCard from './UserCard.js';");
      expect(result).not.toContain("const React = require('react');");
      expect(result).not.toContain("const UserCard = require('./UserCard');");
      expect(result).toContain('render(<UserCard />)');
    });
  });

  describe('Express ES Module API Templates', () => {
    it('should generate ES module Express API test', () => {
      const context: TemplateContext = {
        moduleName: 'userRoutes',
        imports: ['express'],
        exports: ['getUser', 'createUser'],
        hasDefaultExport: false,
        testType: TestType.API,
        framework: 'express',
        language: 'javascript',
        isAsync: true,
        isComponent: false,
        dependencies: ['express'],
        moduleSystem: 'esm'
      };

      const result = engine.generateTest(context);
      
      // Should generate ES module Express API imports with .js extension
      expect(result).toContain("import request from 'supertest';");
      expect(result).toContain("import express from 'express';");
      expect(result).toContain("import { getUser, createUser } from './userRoutes.js';");
      expect(result).not.toContain("const request = require('supertest');");
      expect(result).not.toContain("const { getUser, createUser } = require('./userRoutes');");
      expect(result).toContain("describe('getUser', () => {");
    });
  });

  describe('CommonJS Fallback (Backward Compatibility)', () => {
    it('should still generate CommonJS for projects without moduleSystem', () => {
      const context: TemplateContext = {
        moduleName: 'legacy',
        imports: [],
        exports: ['oldFunction'],
        hasDefaultExport: false,
        testType: TestType.UTILITY,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: []
        // No moduleSystem property - should default to CommonJS
      };

      const result = engine.generateTest(context);
      
      // Should generate CommonJS require syntax (backward compatibility)
      expect(result).toContain("const { oldFunction } = require('./legacy');");
      expect(result).not.toContain("import { oldFunction } from './legacy.js';");
    });

    it('should generate CommonJS when explicitly set', () => {
      const context: TemplateContext = {
        moduleName: 'cjsModule',
        imports: [],
        exports: ['cjsFunction'],
        hasDefaultExport: false,
        testType: TestType.UTILITY,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'commonjs'
      };

      const result = engine.generateTest(context);
      
      // Should explicitly generate CommonJS require syntax
      expect(result).toContain("const { cjsFunction } = require('./cjsModule');");
      expect(result).not.toContain("import { cjsFunction } from './cjsModule.js';");
    });
  });

  describe('Mixed Module System Edge Cases', () => {
    it('should handle mixed module system by using ES modules', () => {
      const context: TemplateContext = {
        moduleName: 'mixedModule',
        imports: [],
        exports: ['mixedFunction'],
        hasDefaultExport: false,
        testType: TestType.UTILITY,
        framework: 'jest',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: [],
        moduleSystem: 'mixed'
      };

      const result = engine.generateTest(context);
      
      // For mixed systems, should default to CommonJS for safety
      expect(result).toContain("const { mixedFunction } = require('./mixedModule');");
      expect(result).not.toContain("import { mixedFunction } from './mixedModule.js';");
    });
  });
});