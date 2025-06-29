import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { TestGeneratorConfig } from '../../src/generators/TestGenerator';
import { ProjectAnalysis } from '../../src/analyzers/ProjectAnalyzer';

describe('Python export extraction', () => {
  let generator: StructuralTestGenerator;
  let mockAnalysis: ProjectAnalysis;
  let config: TestGeneratorConfig;

  beforeEach(() => {
    config = {
      projectPath: '/test',
      outputPath: '/test/.claude-testing',
      testFramework: 'pytest',
      options: {}
    };

    mockAnalysis = {
      projectPath: '/test',
      languages: [{ name: 'python', confidence: 1.0, files: [] }],
      frameworks: [],
      packageManagers: [],
      projectStructure: {
        rootFiles: [],
        srcDirectory: undefined,
        testDirectories: [],
        configFiles: [],
        buildOutputs: [],
        entryPoints: []
      },
      dependencies: {
        production: {},
        development: {},
        python: {}
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: [],
        testFiles: [],
        coverageTools: []
      },
      complexity: {
        totalFiles: 0,
        totalLines: 0,
        averageFileSize: 0,
        largestFiles: []
      },
      moduleSystem: {
        type: 'commonjs',
        hasPackageJsonType: false,
        confidence: 0.8
      }
    };

    generator = new StructuralTestGenerator(config, mockAnalysis);
  });

  describe('extractExports method', () => {
    it('should extract valid Python functions and classes', () => {
      const content = `
import os
import sys

def valid_function():
    """A valid function"""
    return "hello"

class MyClass:
    """A valid class"""
    def method(self):
        pass

def another_function():
    return "world"
`;

      // Access the private method for testing
      const exports = (generator as any).extractExports(content, 'python');
      
      expect(exports).toContain('valid_function');
      expect(exports).toContain('MyClass');
      expect(exports).toContain('another_function');
      expect(exports).toHaveLength(3);
    });

    it('should not extract invalid or malformed Python definitions', () => {
      const problematicContent = `
import os

# This would be a problem if we had bugs in regex
def 
class 
  def indented_def():
    pass
`;

      const exports = (generator as any).extractExports(problematicContent, 'python');
      
      // Should not extract anything from malformed definitions
      expect(exports).toEqual([]);
    });

    it('should handle mixed valid and invalid definitions', () => {
      const mixedContent = `
def valid_function():
    pass

def 

class MyClass:
    pass

class 

def another_valid():
    return True
`;

      const exports = (generator as any).extractExports(mixedContent, 'python');
      
      expect(exports).toContain('valid_function');
      expect(exports).toContain('MyClass');
      expect(exports).toContain('another_valid');
      expect(exports).toHaveLength(3);
      
      // Ensure no invalid entries
      expect(exports).not.toContain('');
      expect(exports).not.toContain('class');
      expect(exports).not.toContain('def');
    });

    it('should handle classes with inheritance and complex signatures', () => {
      const inheritanceContent = `
class BaseClass:
    pass

class DerivedClass(BaseClass):
    pass

class MultipleInheritance(BaseClass, object):
    pass

class WithDocstring:
    '''A class with docstring'''
    pass
`;

      const exports = (generator as any).extractExports(inheritanceContent, 'python');
      
      expect(exports).toContain('BaseClass');
      expect(exports).toContain('DerivedClass');
      expect(exports).toContain('MultipleInheritance');
      expect(exports).toContain('WithDocstring');
      expect(exports).toHaveLength(4);
    });

    it('should handle functions with complex signatures', () => {
      const complexFunctionContent = `
def simple_function():
    pass

def function_with_args(arg1, arg2):
    pass

def function_with_defaults(arg1, arg2="default"):
    pass

def function_with_kwargs(*args, **kwargs):
    pass

async def async_function():
    pass
`;

      const exports = (generator as any).extractExports(complexFunctionContent, 'python');
      
      expect(exports).toContain('simple_function');
      expect(exports).toContain('function_with_args');
      expect(exports).toContain('function_with_defaults');
      expect(exports).toContain('function_with_kwargs');
      expect(exports).toContain('async_function');
      expect(exports).toHaveLength(5);
    });

    it('should not extract commented or indented definitions', () => {
      const commentedContent = `
# def commented_function():
#     pass

# class CommentedClass:
#     pass

if True:
    def nested_function():
        pass
    
    class NestedClass:
        pass

def valid_function():
    pass
`;

      const exports = (generator as any).extractExports(commentedContent, 'python');
      
      // Should only extract the valid module-level function
      expect(exports).toContain('valid_function');
      expect(exports).toHaveLength(1);
      
      // Should not extract commented or nested definitions
      expect(exports).not.toContain('commented_function');
      expect(exports).not.toContain('CommentedClass');
      expect(exports).not.toContain('nested_function');
      expect(exports).not.toContain('NestedClass');
    });
  });
});