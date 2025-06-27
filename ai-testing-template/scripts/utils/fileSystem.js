const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

/**
 * File system analysis utilities for project detection
 */
class FileSystemAnalyzer {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
  }

  /**
   * Detects if the current directory is a JavaScript/TypeScript project
   * @returns {Object} Detection results with framework info
   */
  detectJavaScriptProject() {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return { isJavaScript: false };
    }

    try {
      const packageJson = fs.readJsonSync(packageJsonPath);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const frameworks = {
        react: !!(dependencies.react || dependencies['@types/react']),
        nextjs: !!(dependencies.next),
        vue: !!(dependencies.vue || dependencies['@vue/cli-service']),
        angular: !!(dependencies['@angular/core']),
        express: !!(dependencies.express),
        fastify: !!(dependencies.fastify),
        nestjs: !!(dependencies['@nestjs/core']),
        vite: !!(dependencies.vite),
        webpack: !!(dependencies.webpack),
        typescript: !!(dependencies.typescript || dependencies['@types/node'])
      };

      // Detect project type
      const projectType = this.determineProjectType(frameworks, packageJson);
      
      return {
        isJavaScript: true,
        frameworks,
        projectType,
        packageJson,
        hasTypeScript: frameworks.typescript || this.hasTypeScriptFiles()
      };
    } catch (error) {
      console.warn('Error reading package.json:', error.message);
      return { isJavaScript: false };
    }
  }

  /**
   * Detects if the current directory is a Python project
   * @returns {Object} Detection results with framework info
   */
  detectPythonProject() {
    const indicators = [
      'requirements.txt',
      'pyproject.toml',
      'setup.py',
      'Pipfile',
      'poetry.lock'
    ];

    const hasIndicator = indicators.some(file => 
      fs.existsSync(path.join(this.projectPath, file))
    );

    if (!hasIndicator && !this.hasPythonFiles()) {
      return { isPython: false };
    }

    const frameworks = this.detectPythonFrameworks();
    const projectType = this.determinePythonProjectType(frameworks);

    return {
      isPython: true,
      frameworks,
      projectType,
      hasRequirementsTxt: fs.existsSync(path.join(this.projectPath, 'requirements.txt')),
      hasPyprojectToml: fs.existsSync(path.join(this.projectPath, 'pyproject.toml')),
      hasSetupPy: fs.existsSync(path.join(this.projectPath, 'setup.py'))
    };
  }

  /**
   * Determines JavaScript project type based on detected frameworks
   */
  determineProjectType(frameworks, packageJson) {
    if (frameworks.react || frameworks.nextjs || frameworks.vue || frameworks.angular) {
      return 'frontend';
    }
    
    if (frameworks.express || frameworks.fastify || frameworks.nestjs) {
      return 'backend';
    }

    // Check scripts for clues
    const scripts = packageJson.scripts || {};
    if (scripts.start || scripts.dev || scripts.serve) {
      if (scripts.build && (scripts.build.includes('react') || scripts.build.includes('vue'))) {
        return 'frontend';
      }
      return 'backend';
    }

    // Check for common frontend files
    if (this.hasFiles(['src/App.js', 'src/App.tsx', 'src/main.js', 'src/main.ts', 'public/index.html'])) {
      return 'frontend';
    }

    // Check for common backend files
    if (this.hasFiles(['server.js', 'app.js', 'index.js', 'src/server.js', 'src/app.js'])) {
      return 'backend';
    }

    return 'unknown';
  }

  /**
   * Detects Python frameworks by checking for common imports and files
   */
  detectPythonFrameworks() {
    const frameworks = {
      fastapi: this.checkPythonFramework('fastapi', ['from fastapi', 'import fastapi']),
      flask: this.checkPythonFramework('flask', ['from flask', 'import flask']),
      django: this.checkPythonFramework('django', ['django', 'manage.py']),
      starlette: this.checkPythonFramework('starlette', ['from starlette', 'import starlette']),
      tornado: this.checkPythonFramework('tornado', ['import tornado', 'from tornado'])
    };

    return frameworks;
  }

  /**
   * Determines Python project type
   */
  determinePythonProjectType(frameworks) {
    if (frameworks.fastapi || frameworks.flask || frameworks.django || 
        frameworks.starlette || frameworks.tornado) {
      return 'backend';
    }

    // Check for common backend patterns
    if (this.hasFiles(['main.py', 'app.py', 'server.py', 'api.py'])) {
      return 'backend';
    }

    return 'unknown';
  }

  /**
   * Checks if Python framework is present
   */
  checkPythonFramework(framework, patterns) {
    // Check requirements files
    const reqFiles = ['requirements.txt', 'pyproject.toml'];
    for (const reqFile of reqFiles) {
      const reqPath = path.join(this.projectPath, reqFile);
      if (fs.existsSync(reqPath)) {
        const content = fs.readFileSync(reqPath, 'utf-8');
        if (content.toLowerCase().includes(framework)) {
          return true;
        }
      }
    }

    // Check Python files for imports
    const pythonFiles = glob.sync('**/*.py', { 
      cwd: this.projectPath,
      ignore: ['node_modules/**', 'venv/**', '__pycache__/**', '.git/**']
    });

    for (const file of pythonFiles.slice(0, 10)) { // Limit to first 10 files for performance
      const filePath = path.join(this.projectPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (patterns.some(pattern => content.includes(pattern))) {
          return true;
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return false;
  }

  /**
   * Checks if any of the specified files exist
   */
  hasFiles(files) {
    return files.some(file => fs.existsSync(path.join(this.projectPath, file)));
  }

  /**
   * Checks if project has TypeScript files
   */
  hasTypeScriptFiles() {
    const tsFiles = glob.sync('**/*.{ts,tsx}', { 
      cwd: this.projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });
    return tsFiles.length > 0;
  }

  /**
   * Checks if project has Python files
   */
  hasPythonFiles() {
    const pyFiles = glob.sync('**/*.py', { 
      cwd: this.projectPath,
      ignore: ['node_modules/**', 'venv/**', '__pycache__/**']
    });
    return pyFiles.length > 0;
  }

  /**
   * Gets existing test directories and files
   */
  getExistingTestStructure() {
    const testPatterns = [
      'test/**',
      'tests/**',
      '__tests__/**',
      '**/*.test.{js,ts,py}',
      '**/*.spec.{js,ts,py}',
      'src/**/*.test.{js,ts}',
      'src/**/*.spec.{js,ts}'
    ];

    const testFiles = [];
    testPatterns.forEach(pattern => {
      const matches = glob.sync(pattern, { 
        cwd: this.projectPath,
        ignore: ['node_modules/**', 'venv/**', '__pycache__/**']
      });
      testFiles.push(...matches);
    });

    return {
      hasExistingTests: testFiles.length > 0,
      testFiles,
      testDirectories: [...new Set(testFiles.map(file => path.dirname(file)))]
    };
  }

  /**
   * Analyzes the complete project structure
   */
  analyzeProject() {
    const jsAnalysis = this.detectJavaScriptProject();
    const pyAnalysis = this.detectPythonProject();
    const testStructure = this.getExistingTestStructure();

    return {
      projectPath: this.projectPath,
      javascript: jsAnalysis,
      python: pyAnalysis,
      testing: testStructure,
      isEmpty: !jsAnalysis.isJavaScript && !pyAnalysis.isPython,
      isMultiLanguage: jsAnalysis.isJavaScript && pyAnalysis.isPython
    };
  }
}

module.exports = FileSystemAnalyzer;