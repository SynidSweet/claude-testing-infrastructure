/**
 * Python Project Adapter Implementation
 * 
 * This adapter handles Python projects, providing language-specific
 * project detection, analysis, and configuration for various Python
 * frameworks and environments.
 * 
 * @extends BaseProjectAdapter
 */

const path = require('path');
const { BaseProjectAdapter } = require('../base');

class PythonAdapter extends BaseProjectAdapter {
  constructor() {
    super('python');
    this.supportedFrameworks = [
      // Web frameworks
      'fastapi', 'flask', 'django', 'tornado', 'aiohttp', 'sanic',
      // Data science
      'jupyter', 'numpy', 'pandas', 'scikit-learn', 'tensorflow', 'pytorch',
      // Testing frameworks
      'pytest', 'unittest', 'nose', 'doctest',
      // Others
      'click', 'typer', 'streamlit', 'dash'
    ];
  }

  /**
   * Detect if this adapter can handle the project
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<boolean>} True if this is a Python project
   */
  async detect(projectPath) {
    // Check for Python-specific files
    const pythonIndicators = [
      'setup.py',
      'setup.cfg',
      'pyproject.toml',
      'requirements.txt',
      'requirements.in',
      'Pipfile',
      'poetry.lock',
      'environment.yml',
      'environment.yaml',
      'conda.yml',
      'conda.yaml',
      'tox.ini',
      '.python-version',
      'manage.py' // Django
    ];

    for (const indicator of pythonIndicators) {
      if (await this.fileExists(path.join(projectPath, indicator))) {
        return true;
      }
    }

    // Check for Python files
    const pyFiles = await this.findFiles(projectPath, '**/*.py');
    if (pyFiles.length > 0) return true;

    // Check for Jupyter notebooks
    const notebooks = await this.findFiles(projectPath, '**/*.ipynb');
    if (notebooks.length > 0) return true;

    return false;
  }

  /**
   * Get supported frameworks
   * @returns {string[]} Array of supported framework names
   */
  getSupportedFrameworks() {
    return this.supportedFrameworks;
  }

  /**
   * Language-specific validation
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ValidationResult>} Validation results
   */
  async validateLanguageSpecific(projectPath) {
    const errors = [];
    const warnings = [];
    const suggestions = {};

    // Check for package management files
    const hasSetupPy = await this.fileExists(path.join(projectPath, 'setup.py'));
    const hasPyproject = await this.fileExists(path.join(projectPath, 'pyproject.toml'));
    const hasRequirements = await this.fileExists(path.join(projectPath, 'requirements.txt'));
    const hasPipfile = await this.fileExists(path.join(projectPath, 'Pipfile'));
    const hasPoetry = await this.fileExists(path.join(projectPath, 'poetry.lock'));

    if (!hasSetupPy && !hasPyproject && !hasRequirements && !hasPipfile && !hasPoetry) {
      warnings.push('No package management files found (setup.py, pyproject.toml, requirements.txt, etc.)');
      suggestions.packaging = 'Create requirements.txt: pip freeze > requirements.txt';
    }

    // Check for __init__.py in packages
    const pyFiles = await this.findFiles(projectPath, '**/*.py');
    const directories = new Set(pyFiles.map(f => path.dirname(f)));
    
    for (const dir of directories) {
      const relDir = path.relative(projectPath, dir);
      if (relDir && !relDir.includes('__pycache__') && !relDir.startsWith('.')) {
        const hasInit = await this.fileExists(path.join(dir, '__init__.py'));
        if (!hasInit && !dir.includes('test')) {
          warnings.push(`Package directory missing __init__.py: ${relDir}`);
        }
      }
    }

    // Check for Python version specification
    const hasPythonVersion = await this.fileExists(path.join(projectPath, '.python-version')) ||
                            await this.fileExists(path.join(projectPath, 'runtime.txt'));
    
    if (!hasPythonVersion && hasPyproject) {
      const pyproject = await this.readTomlSafe(path.join(projectPath, 'pyproject.toml'));
      if (!pyproject?.tool?.poetry?.dependencies?.python && 
          !pyproject?.project?.['requires-python']) {
        warnings.push('No Python version specified');
        suggestions.pythonVersion = 'Specify Python version in pyproject.toml or .python-version';
      }
    }

    // Check for virtual environment
    const hasVenv = await this.fileExists(path.join(projectPath, 'venv')) ||
                   await this.fileExists(path.join(projectPath, '.venv')) ||
                   await this.fileExists(path.join(projectPath, 'env')) ||
                   await this.fileExists(path.join(projectPath, '.env'));
    
    if (!hasVenv) {
      suggestions.virtualenv = 'Create virtual environment: python -m venv venv';
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Language-specific project analysis
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeLanguageSpecific(projectPath) {
    const [
      packageInfo,
      frameworks,
      projectType,
      entryPoints,
      buildTool,
      testRunner
    ] = await Promise.all([
      this.analyzePackageInfo(projectPath),
      this.detectFrameworks(projectPath),
      this.detectProjectType(projectPath),
      this.findEntryPoints(projectPath),
      this.detectBuildTool(projectPath),
      this.detectTestRunner(projectPath)
    ]);

    return {
      packageInfo,
      frameworks,
      projectType,
      entryPoints,
      buildTool,
      testRunner
    };
  }

  /**
   * Analyze package information
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<PackageInfo>} Package information
   */
  async analyzePackageInfo(projectPath) {
    // Check pyproject.toml first (modern Python packaging)
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');
    if (await this.fileExists(pyprojectPath)) {
      const pyproject = await this.readTomlSafe(pyprojectPath);
      if (pyproject?.project) {
        return {
          name: pyproject.project.name || path.basename(projectPath),
          version: pyproject.project.version || '0.0.0',
          dependencies: pyproject.project.dependencies || {},
          devDependencies: pyproject.project['optional-dependencies']?.dev || {},
          scripts: pyproject.tool?.poetry?.scripts || {}
        };
      }
    }

    // Check setup.py/setup.cfg
    const setupPy = path.join(projectPath, 'setup.py');
    const setupCfg = path.join(projectPath, 'setup.cfg');
    
    if (await this.fileExists(setupCfg)) {
      const setupConfig = await this.readConfigSafe(setupCfg);
      if (setupConfig?.metadata) {
        return {
          name: setupConfig.metadata.name || path.basename(projectPath),
          version: setupConfig.metadata.version || '0.0.0',
          dependencies: this.parseRequirements(setupConfig.options?.install_requires),
          devDependencies: this.parseRequirements(setupConfig.options?.extras_require?.dev),
          scripts: setupConfig.options?.entry_points?.console_scripts || {}
        };
      }
    }

    // Default package info
    return {
      name: path.basename(projectPath),
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    };
  }

  /**
   * Detect frameworks in use
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Detected frameworks
   */
  async detectFrameworks(projectPath) {
    const frameworks = [];
    
    // Read requirements files to check for frameworks
    const requirements = await this.readRequirements(projectPath);
    const allPackages = requirements.map(r => r.toLowerCase());

    // Web frameworks
    if (allPackages.some(p => p.includes('fastapi'))) frameworks.push('fastapi');
    if (allPackages.some(p => p.includes('flask'))) frameworks.push('flask');
    if (allPackages.some(p => p.includes('django'))) frameworks.push('django');
    if (allPackages.some(p => p.includes('tornado'))) frameworks.push('tornado');
    if (allPackages.some(p => p.includes('aiohttp'))) frameworks.push('aiohttp');
    if (allPackages.some(p => p.includes('sanic'))) frameworks.push('sanic');

    // Data science
    if (allPackages.some(p => p.includes('jupyter'))) frameworks.push('jupyter');
    if (allPackages.some(p => p.includes('numpy'))) frameworks.push('numpy');
    if (allPackages.some(p => p.includes('pandas'))) frameworks.push('pandas');
    if (allPackages.some(p => p.includes('scikit-learn'))) frameworks.push('scikit-learn');
    if (allPackages.some(p => p.includes('tensorflow'))) frameworks.push('tensorflow');
    if (allPackages.some(p => p.includes('torch') || p.includes('pytorch'))) frameworks.push('pytorch');

    // CLI frameworks
    if (allPackages.some(p => p.includes('click'))) frameworks.push('click');
    if (allPackages.some(p => p.includes('typer'))) frameworks.push('typer');

    // Dashboard frameworks
    if (allPackages.some(p => p.includes('streamlit'))) frameworks.push('streamlit');
    if (allPackages.some(p => p.includes('dash'))) frameworks.push('dash');

    // Check for Django-specific files
    if (await this.fileExists(path.join(projectPath, 'manage.py'))) {
      if (!frameworks.includes('django')) frameworks.push('django');
    }

    // Check for Jupyter notebooks
    const notebooks = await this.findFiles(projectPath, '**/*.ipynb');
    if (notebooks.length > 0 && !frameworks.includes('jupyter')) {
      frameworks.push('jupyter');
    }

    return frameworks;
  }

  /**
   * Detect project type
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string>} Project type
   */
  async detectProjectType(projectPath) {
    const frameworks = await this.detectFrameworks(projectPath);
    
    // Check if it's a package/library
    if (await this.fileExists(path.join(projectPath, 'setup.py')) ||
        await this.fileExists(path.join(projectPath, 'pyproject.toml'))) {
      const hasMainModule = await this.findFiles(projectPath, '**/__main__.py');
      if (hasMainModule.length === 0) {
        return 'library';
      }
    }

    // Web application
    const webFrameworks = ['fastapi', 'flask', 'django', 'tornado', 'aiohttp', 'sanic'];
    if (frameworks.some(f => webFrameworks.includes(f))) {
      return 'backend';
    }

    // Data science project
    const dataFrameworks = ['jupyter', 'numpy', 'pandas', 'scikit-learn', 'tensorflow', 'pytorch'];
    if (frameworks.some(f => dataFrameworks.includes(f))) {
      return 'data-science';
    }

    // CLI tool
    if (frameworks.includes('click') || frameworks.includes('typer')) {
      return 'cli';
    }

    // Dashboard/UI
    if (frameworks.includes('streamlit') || frameworks.includes('dash')) {
      return 'dashboard';
    }

    return 'unknown';
  }

  /**
   * Find entry points
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Entry points
   */
  async findEntryPoints(projectPath) {
    const entryPoints = [];

    // Check for common entry points
    const commonEntryPoints = [
      'main.py',
      'app.py',
      'application.py',
      'server.py',
      'wsgi.py',
      'asgi.py',
      'manage.py',
      'run.py',
      'cli.py',
      '__main__.py'
    ];

    for (const entry of commonEntryPoints) {
      if (await this.fileExists(path.join(projectPath, entry))) {
        entryPoints.push(entry);
      }
    }

    // Check for package __main__.py
    const mainFiles = await this.findFiles(projectPath, '**/__main__.py');
    mainFiles.forEach(file => {
      entryPoints.push(path.relative(projectPath, file));
    });

    // Check setup.py/pyproject.toml for console scripts
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');
    if (await this.fileExists(pyprojectPath)) {
      const pyproject = await this.readTomlSafe(pyprojectPath);
      if (pyproject?.tool?.poetry?.scripts) {
        Object.values(pyproject.tool.poetry.scripts).forEach(script => {
          if (typeof script === 'string') {
            const [module] = script.split(':');
            entryPoints.push(module.replace(/\./g, '/') + '.py');
          }
        });
      }
    }

    return [...new Set(entryPoints)];
  }

  /**
   * Detect build tool
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string>} Build tool name
   */
  async detectBuildTool(projectPath) {
    // Check for build configuration files
    if (await this.fileExists(path.join(projectPath, 'poetry.lock'))) return 'poetry';
    if (await this.fileExists(path.join(projectPath, 'Pipfile.lock'))) return 'pipenv';
    if (await this.fileExists(path.join(projectPath, 'setup.py'))) return 'setuptools';
    if (await this.fileExists(path.join(projectPath, 'pyproject.toml'))) {
      const pyproject = await this.readTomlSafe(path.join(projectPath, 'pyproject.toml'));
      if (pyproject?.build?.backend) return pyproject.build.backend;
      if (pyproject?.tool?.poetry) return 'poetry';
      if (pyproject?.tool?.hatch) return 'hatch';
      if (pyproject?.tool?.flit) return 'flit';
      return 'setuptools';
    }
    
    return 'pip';
  }

  /**
   * Find test files
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Test file paths
   */
  async findTestFiles(projectPath) {
    const patterns = [
      '**/test_*.py',
      '**/*_test.py',
      '**/tests/*.py',
      '**/test/*.py',
      '**/testing/*.py'
    ];

    const testFiles = [];
    for (const pattern of patterns) {
      const files = await this.findFiles(projectPath, pattern);
      testFiles.push(...files);
    }

    // Filter out __pycache__ and non-test files
    return testFiles.filter(file => 
      !file.includes('__pycache__') && 
      !file.endsWith('__init__.py')
    );
  }

  /**
   * Detect test runner
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string|null>} Test runner name
   */
  async detectTestRunner(projectPath) {
    // Check requirements for test runners
    const requirements = await this.readRequirements(projectPath);
    const packages = requirements.map(r => r.toLowerCase());

    if (packages.some(p => p.includes('pytest'))) return 'pytest';
    if (packages.some(p => p.includes('nose'))) return 'nose';
    if (packages.some(p => p.includes('unittest2'))) return 'unittest';

    // Check for config files
    if (await this.fileExists(path.join(projectPath, 'pytest.ini'))) return 'pytest';
    if (await this.fileExists(path.join(projectPath, 'setup.cfg'))) {
      const setupCfg = await this.readConfigSafe(path.join(projectPath, 'setup.cfg'));
      if (setupCfg?.tool?.pytest) return 'pytest';
    }
    if (await this.fileExists(path.join(projectPath, 'pyproject.toml'))) {
      const pyproject = await this.readTomlSafe(path.join(projectPath, 'pyproject.toml'));
      if (pyproject?.tool?.pytest) return 'pytest';
    }

    // Check for test files using unittest patterns
    const testFiles = await this.findTestFiles(projectPath);
    if (testFiles.length > 0) {
      // Read a sample test file to detect unittest
      const sampleFile = await this.readFileSafe(testFiles[0]);
      if (sampleFile && sampleFile.includes('unittest')) return 'unittest';
    }

    // Default to pytest for new projects
    return null;
  }

  /**
   * Generate test configuration for Python project
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<TestConfiguration>} Test configuration
   */
  async generateConfiguration(analysis) {
    const testRunner = analysis.existingTests.testRunner || this.selectTestRunner(analysis);
    const testDirectory = analysis.structure.testDirs[0] || this.selectTestDirectory(analysis);

    return {
      testRunner,
      testDirectory,
      runnerConfig: await this.generateRunnerConfig(testRunner, analysis),
      coverage: this.generateCoverageConfig(analysis),
      testPatterns: this.generateTestPatterns(testRunner, analysis),
      environment: this.generateEnvironmentConfig(analysis)
    };
  }

  /**
   * Select appropriate test runner
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string} Selected test runner
   */
  selectTestRunner(analysis) {
    // pytest is the de facto standard for Python testing
    return 'pytest';
  }

  /**
   * Select test directory structure
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string} Test directory
   */
  selectTestDirectory(analysis) {
    // Python convention is 'tests' directory
    return 'tests';
  }

  /**
   * Generate runner configuration
   * @private
   * @param {string} runner - Test runner name
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Promise<Object>} Runner configuration
   */
  async generateRunnerConfig(runner, analysis) {
    const configs = {
      pytest: () => this.generatePytestConfig(analysis),
      unittest: () => this.generateUnittestConfig(analysis),
      nose: () => this.generateNoseConfig(analysis)
    };

    const generator = configs[runner];
    return generator ? await generator() : {};
  }

  /**
   * Generate pytest configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} pytest configuration
   */
  generatePytestConfig(analysis) {
    const config = {
      testpaths: ['tests'],
      python_files: ['test_*.py', '*_test.py'],
      python_classes: ['Test*'],
      python_functions: ['test_*'],
      addopts: [
        '-v',
        '--strict-markers',
        '--tb=short',
        '--cov=' + (analysis.packageInfo.name || '.'),
        '--cov-report=html',
        '--cov-report=term-missing'
      ]
    };

    // Add framework-specific settings
    if (analysis.frameworks.includes('django')) {
      config.DJANGO_SETTINGS_MODULE = 'tests.settings';
      config.addopts.push('--reuse-db');
    }

    if (analysis.frameworks.includes('fastapi') || analysis.frameworks.includes('aiohttp')) {
      config.asyncio_mode = 'auto';
    }

    return config;
  }

  /**
   * Generate unittest configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} unittest configuration
   */
  generateUnittestConfig(analysis) {
    return {
      discover: {
        start_directory: 'tests',
        pattern: 'test_*.py'
      }
    };
  }

  /**
   * Generate nose configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} nose configuration
   */
  generateNoseConfig(analysis) {
    return {
      where: 'tests',
      cover_package: analysis.packageInfo.name || '.',
      with_coverage: true,
      cover_html: true
    };
  }

  /**
   * Generate coverage configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {CoverageConfig} Coverage configuration
   */
  generateCoverageConfig(analysis) {
    const packageName = analysis.packageInfo.name || '*';
    
    return {
      threshold: 80,
      include: [`${packageName}/*`],
      exclude: [
        '*/tests/*',
        '*/test/*',
        '*/__pycache__/*',
        '*/migrations/*',
        '*/venv/*',
        '*/.venv/*',
        '*/setup.py',
        '*/conftest.py'
      ],
      reporters: ['term-missing', 'html', 'xml']
    };
  }

  /**
   * Generate test patterns
   * @private
   * @param {string} runner - Test runner
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string[]} Test patterns
   */
  generateTestPatterns(runner, analysis) {
    switch (runner) {
      case 'pytest':
        return ['test_*.py', '*_test.py'];
      case 'unittest':
        return ['test_*.py'];
      case 'nose':
        return ['test_*.py', '*_test.py'];
      default:
        return ['test_*.py'];
    }
  }

  /**
   * Generate environment configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Environment configuration
   */
  generateEnvironmentConfig(analysis) {
    return {
      python: process.version.includes('python') ? process.version : '3.9',
      variables: {
        PYTHONPATH: '.',
        TESTING: 'true'
      }
    };
  }

  /**
   * Get required test dependencies
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<Dependencies>} Required testing dependencies
   */
  async getTestDependencies(analysis) {
    const testRunner = analysis.existingTests.testRunner || 
      this.selectTestRunner(analysis);

    const required = [];
    const optional = [];

    // Test runner dependencies
    switch (testRunner) {
      case 'pytest':
        required.push('pytest', 'pytest-cov');
        if (analysis.frameworks.includes('django')) {
          required.push('pytest-django');
        }
        if (analysis.frameworks.includes('fastapi') || 
            analysis.frameworks.includes('aiohttp')) {
          required.push('pytest-asyncio');
        }
        break;
      case 'unittest':
        // Built-in, no deps needed
        optional.push('coverage');
        break;
      case 'nose':
        required.push('nose', 'coverage');
        break;
    }

    // Framework-specific test dependencies
    if (analysis.frameworks.includes('fastapi')) {
      required.push('httpx'); // For testing async APIs
    }
    if (analysis.frameworks.includes('flask')) {
      required.push('pytest-flask');
    }

    // Mock libraries
    optional.push('pytest-mock', 'responses', 'faker');

    // Type checking
    optional.push('mypy', 'types-requests');

    return {
      required,
      optional,
      versions: {} // Could specify versions here
    };
  }

  /**
   * Get test templates applicable to this project
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<Template[]>} Array of applicable test templates
   */
  async getTestTemplates(analysis) {
    const templates = [];
    const baseTemplatePath = 'python';

    // Basic test templates
    templates.push({
      name: 'unit-test',
      path: `${baseTemplatePath}/unit/basic.template`,
      targetPath: 'tests',
      variables: { testRunner: analysis.existingTests.testRunner || 'pytest' },
      description: 'Basic unit test template'
    });

    // Framework-specific templates
    if (analysis.frameworks.includes('fastapi')) {
      templates.push({
        name: 'fastapi-endpoint',
        path: `${baseTemplatePath}/fastapi/endpoint.template`,
        targetPath: 'tests/api',
        variables: { endpoint: '{{endpoint}}' },
        description: 'FastAPI endpoint test template'
      });
    }

    if (analysis.frameworks.includes('django')) {
      templates.push(
        {
          name: 'django-model',
          path: `${baseTemplatePath}/django/model.template`,
          targetPath: 'tests/models',
          variables: { modelName: '{{modelName}}' },
          description: 'Django model test template'
        },
        {
          name: 'django-view',
          path: `${baseTemplatePath}/django/view.template`,
          targetPath: 'tests/views',
          variables: { viewName: '{{viewName}}' },
          description: 'Django view test template'
        }
      );
    }

    if (analysis.frameworks.includes('flask')) {
      templates.push({
        name: 'flask-route',
        path: `${baseTemplatePath}/flask/route.template`,
        targetPath: 'tests/routes',
        variables: { route: '{{route}}' },
        description: 'Flask route test template'
      });
    }

    // Data science templates
    if (analysis.projectType === 'data-science') {
      templates.push({
        name: 'data-pipeline',
        path: `${baseTemplatePath}/data/pipeline.template`,
        targetPath: 'tests/pipelines',
        variables: { pipelineName: '{{pipelineName}}' },
        description: 'Data pipeline test template'
      });
    }

    return templates;
  }

  /**
   * Analyze build configuration
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<BuildInfo>} Build configuration information
   */
  async analyzeBuildConfig(projectPath) {
    const buildTool = await this.detectBuildTool(projectPath);
    let outputDir = 'dist';
    let buildConfig = {};

    // Python doesn't typically have TypeScript
    const hasTypeScript = false;

    // Load build configuration based on tool
    switch (buildTool) {
      case 'poetry':
        const pyproject = await this.readTomlSafe(path.join(projectPath, 'pyproject.toml'));
        if (pyproject?.tool?.poetry) {
          buildConfig = pyproject.tool.poetry;
        }
        break;
        
      case 'setuptools':
        const setupCfg = await this.readConfigSafe(path.join(projectPath, 'setup.cfg'));
        if (setupCfg) {
          buildConfig = setupCfg;
        }
        break;
    }

    return {
      buildTool,
      buildConfig,
      outputDir,
      hasTypeScript
    };
  }

  // Utility methods specific to Python

  /**
   * Read requirements from various sources
   * @private
   * @param {string} projectPath - Project path
   * @returns {Promise<string[]>} List of requirements
   */
  async readRequirements(projectPath) {
    const requirements = [];

    // Check requirements.txt
    const reqTxt = path.join(projectPath, 'requirements.txt');
    if (await this.fileExists(reqTxt)) {
      const content = await this.readFileSafe(reqTxt);
      if (content) {
        requirements.push(...this.parseRequirementsTxt(content));
      }
    }

    // Check pyproject.toml
    const pyproject = await this.readTomlSafe(path.join(projectPath, 'pyproject.toml'));
    if (pyproject?.project?.dependencies) {
      requirements.push(...pyproject.project.dependencies);
    }
    if (pyproject?.tool?.poetry?.dependencies) {
      requirements.push(...Object.keys(pyproject.tool.poetry.dependencies));
    }

    // Check setup.cfg
    const setupCfg = await this.readConfigSafe(path.join(projectPath, 'setup.cfg'));
    if (setupCfg?.options?.install_requires) {
      requirements.push(...this.parseRequirements(setupCfg.options.install_requires));
    }

    // Check Pipfile
    const pipfile = await this.readTomlSafe(path.join(projectPath, 'Pipfile'));
    if (pipfile?.packages) {
      requirements.push(...Object.keys(pipfile.packages));
    }

    return [...new Set(requirements)];
  }

  /**
   * Parse requirements.txt content
   * @private
   * @param {string} content - File content
   * @returns {string[]} Package names
   */
  parseRequirementsTxt(content) {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('-'))
      .map(line => line.split(/[<>=!]/)[0].trim());
  }

  /**
   * Parse requirements from setup.cfg format
   * @private
   * @param {string|string[]} requires - Requirements
   * @returns {string[]} Package names
   */
  parseRequirements(requires) {
    if (!requires) return [];
    if (typeof requires === 'string') {
      return this.parseRequirementsTxt(requires);
    }
    return requires;
  }

  /**
   * Read TOML file safely
   * @private
   * @param {string} filePath - Path to TOML file
   * @returns {Promise<Object|null>} Parsed TOML or null
   */
  async readTomlSafe(filePath) {
    try {
      const content = await this.readFileSafe(filePath);
      if (!content) return null;
      // In a real implementation, use a TOML parser
      // For now, return null to indicate file exists but not parsed
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Read config file safely (INI format)
   * @private
   * @param {string} filePath - Path to config file
   * @returns {Promise<Object|null>} Parsed config or null
   */
  async readConfigSafe(filePath) {
    try {
      const content = await this.readFileSafe(filePath);
      if (!content) return null;
      // In a real implementation, use an INI parser
      // For now, return null to indicate file exists but not parsed
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Read file safely
   * @private
   * @param {string} filePath - Path to file
   * @returns {Promise<string|null>} File content or null
   */
  async readFileSafe(filePath) {
    try {
      const fs = require('fs-extra');
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }
}

module.exports = PythonAdapter;