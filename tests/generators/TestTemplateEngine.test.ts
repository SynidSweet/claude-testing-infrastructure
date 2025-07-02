import { TestTemplateEngine, TemplateContext, Template } from '../../src/generators/templates/TestTemplateEngine';
import { TestType } from '../../src/generators/TestGenerator';

describe('TestTemplateEngine', () => {
  let engine: TestTemplateEngine;

  beforeEach(() => {
    engine = new TestTemplateEngine();
  });

  describe('JavaScript Jest Templates', () => {
    it('should generate basic JavaScript test', () => {
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
        dependencies: []
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain("const { add, subtract } = require('./calculator');");
      expect(result).toContain("describe('calculator', () => {");
      expect(result).toContain("describe('add', () => {");
      expect(result).toContain("describe('subtract', () => {");
      expect(result).toContain('expect(add).toBeDefined()');
      expect(result).toContain('expect(subtract).toBeDefined()');
    });

    it('should generate React component test', () => {
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
        moduleSystem: 'esm' // Specify ES modules to get React imports
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain("import React from 'react';");
      expect(result).toContain("import { render, screen } from '@testing-library/react';");
      expect(result).toContain("import Button from './Button.js';");
      expect(result).toContain('render(<Button />)');
      expect(result).toContain('should render without crashing');
    });

    it('should generate Express API test', () => {
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
        dependencies: ['express']
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain("const request = require('supertest');");
      expect(result).toContain("const express = require('express');");
      expect(result).toContain("const { getUser, createUser } = require('./userRoutes');");
      expect(result).toContain('describe(\'getUser\', () => {');
      expect(result).toContain('describe(\'createUser\', () => {');
      expect(result).toContain('.expect(200)');
      expect(result).toContain('.expect(400)');
    });
  });

  describe('TypeScript Templates', () => {
    it('should generate TypeScript test', () => {
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
        dependencies: []
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain("const { UserService } = require('./userService');");
      expect(result).toContain("describe('userService', () => {");
      expect(result).toContain('should have correct TypeScript types');
      expect(result).toContain("expect(['function', 'object', 'string', 'number', 'boolean']).toContain(actualType)");
    });

    it('should generate React TypeScript component test', () => {
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
        dependencies: ['react']
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain("const React = require('react');");
      expect(result).toContain("const { render, screen } = require('@testing-library/react');");
      expect(result).toContain("const UserCard = require('./UserCard');");
      expect(result).toContain('render(<UserCard />)');
      expect(result).toContain('should have correct TypeScript props');
      expect(result).toContain('should handle user interactions with type safety');
    });
  });

  describe('Python Templates', () => {
    it('should generate pytest test', () => {
      const context: TemplateContext = {
        moduleName: 'calculator',
        imports: [],
        exports: ['add', 'Calculator'],
        hasDefaultExport: false,
        testType: TestType.UTILITY,
        framework: 'pytest',
        language: 'python',
        isAsync: false,
        isComponent: false,
        dependencies: []
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain('"""Tests for calculator module."""');
      expect(result).toContain('import pytest');
      expect(result).toContain('from calculator import add, Calculator');
      expect(result).toContain('class TestCalculator:');
      expect(result).toContain('def test_add_exists(self):');
      expect(result).toContain('def test_calculator_exists(self):');
      expect(result).toContain('assert add is not None');
    });

    it('should generate FastAPI test', () => {
      const context: TemplateContext = {
        moduleName: 'user_api',
        imports: ['fastapi'],
        exports: ['get_user', 'create_user'],
        hasDefaultExport: false,
        testType: TestType.API,
        framework: 'fastapi',
        language: 'python',
        isAsync: true,
        isComponent: false,
        dependencies: ['fastapi']
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain('"""Tests for user_api FastAPI endpoints."""');
      expect(result).toContain('from fastapi.testclient import TestClient');
      expect(result).toContain('from user_api import get_user, create_user');
      expect(result).toContain('class TestUser_apiApi:');
      expect(result).toContain('def test_get_user_get_success(self, client):');
      expect(result).toContain('def test_create_user_post_success(self, client):');
      expect(result).toContain('if response.status_code in [200, 201, 404]:');
      expect(result).toContain('assert response.status_code in [200, 201, 400, 404, 422, 405]');
    });

    it('should generate Django test', () => {
      const context: TemplateContext = {
        moduleName: 'user_views',
        imports: ['django'],
        exports: ['UserListView', 'UserDetailView'],
        hasDefaultExport: false,
        testType: TestType.API,
        framework: 'django',
        language: 'python',
        isAsync: false,
        isComponent: false,
        dependencies: ['django']
      };

      const result = engine.generateTest(context);
      
      expect(result).toContain('"""Tests for user_views Django views."""');
      expect(result).toContain('import pytest');
      expect(result).toContain('from django.test import Client');
      expect(result).toContain('from user_views import UserListView, UserDetailView');
      expect(result).toContain('@pytest.mark.django_db');
      expect(result).toContain('class TestUser_viewsViews:');
      expect(result).toContain('def test_userlistview_get_success(self):');
      expect(result).toContain('def test_userdetailview_authentication_required(self):');
    });
  });

  describe('Template Registration', () => {
    it('should allow custom template registration', () => {
      const customTemplate: Template = {
        name: 'custom-test',
        language: 'javascript',
        framework: 'custom',
        generate: (context) => `// Custom test for ${context.moduleName}`
      };

      engine.registerTemplate(customTemplate);

      const context: TemplateContext = {
        moduleName: 'testModule',
        imports: [],
        exports: [],
        hasDefaultExport: false,
        testType: TestType.UNIT,
        framework: 'custom',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: []
      };

      const result = engine.generateTest(context);
      expect(result).toBe('// Custom test for testModule');
    });

    it('should fall back to language template when framework not found', () => {
      const context: TemplateContext = {
        moduleName: 'testModule',
        imports: [],
        exports: ['testFunction'],
        hasDefaultExport: false,
        testType: TestType.UNIT,
        framework: 'unknownFramework',
        language: 'javascript',
        isAsync: false,
        isComponent: false,
        dependencies: []
      };

      const result = engine.generateTest(context);
      expect(result).toContain("describe('testModule', () => {");
      expect(result).toContain('testFunction');
    });

    it('should throw error when no suitable template found', () => {
      const context: TemplateContext = {
        moduleName: 'testModule',
        imports: [],
        exports: [],
        hasDefaultExport: false,
        testType: TestType.UNIT,
        framework: 'unknown',
        language: 'rust' as any, // Unsupported language
        isAsync: false,
        isComponent: false,
        dependencies: []
      };

      expect(() => engine.generateTest(context)).toThrow();
    });
  });

  describe('Template Specificity', () => {
    it('should prefer more specific templates', () => {
      // React component should use React template, not generic JavaScript
      const reactContext: TemplateContext = {
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
        moduleSystem: 'esm' // Specify ES modules to get React imports
      };

      const result = engine.generateTest(reactContext);
      expect(result).toContain('@testing-library/react');
      expect(result).toContain('render(<Button />)');
    });
  });
});