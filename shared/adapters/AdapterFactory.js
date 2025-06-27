/**
 * Adapter Factory
 * 
 * This factory is responsible for selecting and instantiating the appropriate
 * language adapter based on project analysis. It provides a centralized way
 * to manage adapter registration and selection.
 * 
 * @module AdapterFactory
 */

const JavaScriptAdapter = require('./javascript/JavaScriptAdapter');
const PythonAdapter = require('./python/PythonAdapter');

class AdapterFactory {
  constructor() {
    // Registry of available adapters
    this.adapters = new Map();
    this.adapterInstances = new Map();
    
    // Register default adapters
    this.registerDefaultAdapters();
  }

  /**
   * Register default language adapters
   * @private
   */
  registerDefaultAdapters() {
    this.registerAdapter('javascript', JavaScriptAdapter);
    this.registerAdapter('python', PythonAdapter);
  }

  /**
   * Register a new adapter
   * @param {string} language - Language identifier
   * @param {Class} AdapterClass - Adapter class constructor
   */
  registerAdapter(language, AdapterClass) {
    if (!language || !AdapterClass) {
      throw new Error('Language and AdapterClass are required');
    }
    this.adapters.set(language.toLowerCase(), AdapterClass);
  }

  /**
   * Get adapter instance by language
   * @param {string} language - Language identifier
   * @returns {IProjectAdapter} Adapter instance
   */
  getAdapterByLanguage(language) {
    const languageLower = language.toLowerCase();
    
    // Check cache first
    if (this.adapterInstances.has(languageLower)) {
      return this.adapterInstances.get(languageLower);
    }

    // Create new instance
    const AdapterClass = this.adapters.get(languageLower);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for language: ${language}`);
    }

    const instance = new AdapterClass();
    this.adapterInstances.set(languageLower, instance);
    return instance;
  }

  /**
   * Get appropriate adapter for a project path
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<IProjectAdapter>} Selected adapter instance
   */
  async getAdapter(projectPath) {
    const detectionResults = [];

    // Test each adapter in parallel
    const adapterTests = Array.from(this.adapters.entries()).map(async ([language, AdapterClass]) => {
      try {
        const adapter = this.getAdapterByLanguage(language);
        const canHandle = await adapter.detect(projectPath);
        return { language, adapter, canHandle, priority: this.getAdapterPriority(language) };
      } catch (error) {
        console.warn(`Error testing ${language} adapter: ${error.message}`);
        return { language, adapter: null, canHandle: false, priority: 0 };
      }
    });

    const results = await Promise.all(adapterTests);
    
    // Filter adapters that can handle the project
    const validAdapters = results.filter(r => r.canHandle);
    
    if (validAdapters.length === 0) {
      throw new Error(`No suitable adapter found for project at: ${projectPath}`);
    }

    // If multiple adapters match, use priority and additional heuristics
    if (validAdapters.length > 1) {
      return this.selectBestAdapter(validAdapters, projectPath);
    }

    return validAdapters[0].adapter;
  }

  /**
   * Get all registered adapters
   * @returns {IProjectAdapter[]} Array of adapter instances
   */
  getAllAdapters() {
    return Array.from(this.adapters.keys()).map(language => 
      this.getAdapterByLanguage(language)
    );
  }

  /**
   * Get adapter priority (higher number = higher priority)
   * @private
   * @param {string} language - Language identifier
   * @returns {number} Priority value
   */
  getAdapterPriority(language) {
    const priorities = {
      javascript: 10, // Higher priority for JS due to package.json prevalence
      python: 9,
      // Future languages
      typescript: 10,
      java: 8,
      go: 7,
      rust: 6,
      ruby: 5,
      php: 4
    };
    return priorities[language.toLowerCase()] || 0;
  }

  /**
   * Select best adapter when multiple match
   * @private
   * @param {Array} validAdapters - Adapters that can handle the project
   * @param {string} projectPath - Project path
   * @returns {Promise<IProjectAdapter>} Best adapter
   */
  async selectBestAdapter(validAdapters, projectPath) {
    // Sort by priority
    validAdapters.sort((a, b) => b.priority - a.priority);

    // If same priority, use additional heuristics
    if (validAdapters.length > 1 && validAdapters[0].priority === validAdapters[1].priority) {
      // Analyze which has more specific indicators
      const analysisPromises = validAdapters.map(async ({ adapter }) => {
        try {
          const analysis = await adapter.analyze(projectPath);
          return {
            adapter,
            score: this.calculateSpecificityScore(analysis)
          };
        } catch {
          return { adapter, score: 0 };
        }
      });

      const scores = await Promise.all(analysisPromises);
      scores.sort((a, b) => b.score - a.score);
      return scores[0].adapter;
    }

    return validAdapters[0].adapter;
  }

  /**
   * Calculate specificity score for project analysis
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {number} Specificity score
   */
  calculateSpecificityScore(analysis) {
    let score = 0;
    
    // More frameworks detected = more specific
    score += (analysis.frameworks?.length || 0) * 10;
    
    // Known project type = more specific
    if (analysis.projectType && analysis.projectType !== 'unknown') {
      score += 20;
    }
    
    // Has package info = more specific
    if (analysis.packageInfo?.name) {
      score += 15;
    }
    
    // Has entry points = more specific
    score += (analysis.entryPoints?.length || 0) * 5;
    
    // Has existing tests = more specific
    if (analysis.existingTests?.hasTests) {
      score += 25;
    }
    
    return score;
  }

  /**
   * Check if a language is supported
   * @param {string} language - Language to check
   * @returns {boolean} True if language is supported
   */
  isLanguageSupported(language) {
    return this.adapters.has(language.toLowerCase());
  }

  /**
   * Get list of supported languages
   * @returns {string[]} Supported languages
   */
  getSupportedLanguages() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Clear adapter instance cache
   */
  clearCache() {
    this.adapterInstances.clear();
  }

  /**
   * Create a multi-language adapter for projects with multiple languages
   * @param {string} projectPath - Project path
   * @returns {Promise<MultiLanguageAdapter>} Multi-language adapter
   */
  async createMultiLanguageAdapter(projectPath) {
    const adapters = [];
    
    // Check which adapters can handle the project
    for (const [language, AdapterClass] of this.adapters) {
      const adapter = this.getAdapterByLanguage(language);
      if (await adapter.detect(projectPath)) {
        adapters.push({ language, adapter });
      }
    }

    if (adapters.length === 0) {
      throw new Error('No adapters can handle this project');
    }

    return new MultiLanguageAdapter(adapters);
  }
}

/**
 * Multi-language adapter for projects using multiple languages
 */
class MultiLanguageAdapter {
  constructor(adapters) {
    this.adapters = adapters;
    this.primaryAdapter = adapters[0].adapter; // First detected is primary
  }

  /**
   * Detect always returns true for multi-language adapter
   */
  async detect(projectPath) {
    return true;
  }

  /**
   * Analyze project with all applicable adapters
   */
  async analyze(projectPath) {
    const analyses = await Promise.all(
      this.adapters.map(async ({ language, adapter }) => {
        const analysis = await adapter.analyze(projectPath);
        return { language, analysis };
      })
    );

    // Merge analyses
    const merged = {
      language: 'multi',
      languages: analyses.map(a => a.language),
      frameworks: [],
      projectType: 'fullstack',
      packageInfo: {},
      entryPoints: [],
      existingTests: {
        hasTests: false,
        testFiles: [],
        testRunner: null
      },
      structure: {
        sourceDirs: [],
        testDirs: [],
        rootDir: projectPath,
        conventions: {}
      },
      buildConfig: {
        buildTool: 'multi',
        buildConfig: {},
        outputDir: null,
        hasTypeScript: false
      },
      // Store individual analyses
      languageAnalyses: {}
    };

    // Merge data from each analysis
    analyses.forEach(({ language, analysis }) => {
      merged.languageAnalyses[language] = analysis;
      merged.frameworks.push(...(analysis.frameworks || []));
      merged.entryPoints.push(...(analysis.entryPoints || []));
      merged.structure.sourceDirs.push(...(analysis.structure?.sourceDirs || []));
      merged.structure.testDirs.push(...(analysis.structure?.testDirs || []));
      
      if (analysis.existingTests?.hasTests) {
        merged.existingTests.hasTests = true;
        merged.existingTests.testFiles.push(...(analysis.existingTests.testFiles || []));
      }
      
      if (analysis.buildConfig?.hasTypeScript) {
        merged.buildConfig.hasTypeScript = true;
      }
    });

    // Deduplicate
    merged.frameworks = [...new Set(merged.frameworks)];
    merged.entryPoints = [...new Set(merged.entryPoints)];
    merged.structure.sourceDirs = [...new Set(merged.structure.sourceDirs)];
    merged.structure.testDirs = [...new Set(merged.structure.testDirs)];

    return merged;
  }

  /**
   * Generate configuration for all languages
   */
  async generateConfiguration(analysis) {
    const configs = {};
    
    for (const language of analysis.languages) {
      const langAnalysis = analysis.languageAnalyses[language];
      const adapter = this.adapters.find(a => a.language === language).adapter;
      configs[language] = await adapter.generateConfiguration(langAnalysis);
    }

    return {
      testRunner: 'multi',
      testDirectory: 'tests',
      configurations: configs,
      coverage: {
        threshold: 80,
        include: ['src/**/*', 'lib/**/*'],
        exclude: ['**/node_modules/**', '**/__pycache__/**'],
        reporters: ['text', 'html']
      },
      testPatterns: [
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test_*.py',
        '**/*_test.py'
      ],
      environment: {
        multi: true,
        languages: analysis.languages
      }
    };
  }

  /**
   * Get supported frameworks across all languages
   */
  getSupportedFrameworks() {
    const frameworks = [];
    this.adapters.forEach(({ adapter }) => {
      frameworks.push(...adapter.getSupportedFrameworks());
    });
    return [...new Set(frameworks)];
  }

  /**
   * Get language of multi-adapter
   */
  getLanguage() {
    return 'multi';
  }

  /**
   * Get test dependencies for all languages
   */
  async getTestDependencies(analysis) {
    const allDeps = {
      required: [],
      optional: [],
      versions: {}
    };

    for (const language of analysis.languages) {
      const langAnalysis = analysis.languageAnalyses[language];
      const adapter = this.adapters.find(a => a.language === language).adapter;
      const deps = await adapter.getTestDependencies(langAnalysis);
      
      allDeps.required.push(...deps.required);
      allDeps.optional.push(...deps.optional);
      Object.assign(allDeps.versions, deps.versions);
    }

    // Deduplicate
    allDeps.required = [...new Set(allDeps.required)];
    allDeps.optional = [...new Set(allDeps.optional)];

    return allDeps;
  }

  /**
   * Get test templates for all languages
   */
  async getTestTemplates(analysis) {
    const templates = [];

    for (const language of analysis.languages) {
      const langAnalysis = analysis.languageAnalyses[language];
      const adapter = this.adapters.find(a => a.language === language).adapter;
      const langTemplates = await adapter.getTestTemplates(langAnalysis);
      
      // Prefix template names with language
      langTemplates.forEach(template => {
        template.name = `${language}-${template.name}`;
        templates.push(template);
      });
    }

    return templates;
  }

  /**
   * Validate project with all adapters
   */
  async validate(projectPath) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: {}
    };

    for (const { language, adapter } of this.adapters) {
      const validation = await adapter.validate(projectPath);
      
      if (!validation.valid) {
        results.valid = false;
      }
      
      results.errors.push(...validation.errors.map(e => `[${language}] ${e}`));
      results.warnings.push(...validation.warnings.map(w => `[${language}] ${w}`));
      
      // Prefix suggestions with language
      Object.entries(validation.suggestions).forEach(([key, value]) => {
        results.suggestions[`${language}_${key}`] = value;
      });
    }

    return results;
  }
}

// Create singleton instance
const adapterFactory = new AdapterFactory();

module.exports = {
  AdapterFactory,
  adapterFactory,
  MultiLanguageAdapter
};