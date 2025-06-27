/**
 * Default configuration for the Decoupled Testing Suite
 * This file provides sensible defaults for all supported project types
 */

const path = require('path');

/**
 * Base configuration that applies to all projects
 */
const baseConfig = {
  version: "1.0.0",
  projectRoot: "../",
  testingSuite: {
    version: "1.0.0",
    lockMajorVersion: true,
    autoUpdate: "patch-only",
    customConfig: {
      preserveOnUpdate: true
    }
  },
  dependencies: {
    testing: "auto-detected",
    build: "auto-detected",
    runtime: "auto-detected"
  },
  testPatterns: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**", 
      "**/build/**",
      "**/.git/**",
      "**/coverage/**"
    ]
  },
  coverage: {
    threshold: {
      global: 80,
      functions: 80,
      lines: 80,
      statements: 80,
      branches: 70
    },
    reporters: ["text", "html", "lcov"],
    exclude: [
      "**/node_modules/**",
      "**/test/**",
      "**/tests/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/coverage/**"
    ]
  },
  ci: {
    provider: "github-actions",
    triggers: ["push", "pull-request"],
    environments: ["development"]
  },
  accessibility: {
    enabled: true,
    standard: "WCAG2AA",
    tools: ["axe-core"]
  },
  performance: {
    monitoring: false
  }
};

/**
 * Project type specific configurations
 */
const projectTypeConfigs = {
  "react-frontend": {
    language: ["javascript"],
    framework: {
      frontend: "react",
      testing: {
        unit: "jest",
        integration: "jest",
        e2e: "playwright"
      }
    },
    structure: {
      sourceDir: "src",
      testDir: null, // Co-located tests
      buildDir: "build",
      publicDir: "public"
    },
    entryPoints: {
      frontend: "src/index.js"
    },
    testPatterns: {
      unit: "**/*.{test,spec}.{js,jsx,ts,tsx}",
      integration: "**/integration/**/*.{test,spec}.{js,jsx,ts,tsx}",
      e2e: "**/e2e/**/*.{test,spec}.{js,ts}"
    },
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        ...baseConfig.coverage.exclude,
        "src/index.js",
        "src/reportWebVitals.js",
        "src/setupTests.js"
      ]
    },
    environment: {
      node: "16",
      browser: ["chrome", "firefox"]
    }
  },

  "vue-frontend": {
    language: ["javascript"],
    framework: {
      frontend: "vue",
      testing: {
        unit: "vitest",
        integration: "vitest", 
        e2e: "cypress"
      }
    },
    structure: {
      sourceDir: "src",
      testDir: null,
      buildDir: "dist",
      publicDir: "public"
    },
    entryPoints: {
      frontend: "src/main.js"
    },
    testPatterns: {
      unit: "**/*.{test,spec}.{js,ts,vue}",
      integration: "**/integration/**/*.{test,spec}.{js,ts}",
      e2e: "**/e2e/**/*.{test,spec}.{js,ts}"
    },
    coverage: {
      include: ["src/**/*.{js,ts,vue}"],
      exclude: [
        ...baseConfig.coverage.exclude,
        "src/main.js"
      ]
    }
  },

  "node-backend": {
    language: ["javascript"],
    framework: {
      backend: "express",
      database: "postgresql",
      testing: {
        unit: "jest",
        integration: "supertest",
        e2e: "supertest"
      }
    },
    structure: {
      sourceDir: "src",
      testDir: "tests",
      buildDir: "dist"
    },
    entryPoints: {
      backend: "src/server.js",
      api: "src/routes"
    },
    testPatterns: {
      unit: "**/unit/**/*.{test,spec}.{js,ts}",
      integration: "**/integration/**/*.{test,spec}.{js,ts}",
      e2e: "**/e2e/**/*.{test,spec}.{js,ts}"
    },
    coverage: {
      include: ["src/**/*.{js,ts}"],
      exclude: [
        ...baseConfig.coverage.exclude,
        "src/server.js",
        "src/config/**"
      ]
    },
    environment: {
      node: "16",
      variables: {
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://test:test@localhost:5432/test_db"
      }
    }
  },

  "python-backend": {
    language: ["python"],
    framework: {
      backend: "fastapi",
      database: "postgresql",
      testing: {
        unit: "pytest",
        integration: "pytest",
        e2e: "pytest"
      }
    },
    structure: {
      sourceDir: "src",
      testDir: "tests",
      buildDir: "dist"
    },
    entryPoints: {
      backend: "src/main.py",
      api: "src/routes"
    },
    testPatterns: {
      unit: "**/unit/**/test_*.py",
      integration: "**/integration/**/test_*.py", 
      e2e: "**/e2e/**/test_*.py"
    },
    coverage: {
      include: ["src/**/*.py"],
      exclude: [
        ...baseConfig.coverage.exclude,
        "src/main.py",
        "src/config/**"
      ]
    },
    environment: {
      python: "3.9",
      variables: {
        PYTHONPATH: "src",
        DATABASE_URL: "postgresql://test:test@localhost:5432/test_db"
      }
    }
  },

  "react-frontend-node-backend": {
    language: ["javascript", "typescript"],
    framework: {
      frontend: "react",
      backend: "express",
      database: "postgresql",
      testing: {
        unit: "jest",
        integration: "jest",
        e2e: "playwright"
      }
    },
    structure: {
      sourceDir: "src",
      testDir: null,
      buildDir: "dist",
      publicDir: "public"
    },
    entryPoints: {
      frontend: "src/client/index.js",
      backend: "src/server/server.js",
      api: "src/server/routes"
    },
    testPatterns: {
      unit: "**/*.{test,spec}.{js,jsx,ts,tsx}",
      integration: "**/integration/**/*.{test,spec}.{js,ts}",
      e2e: "**/e2e/**/*.{test,spec}.{js,ts}"
    },
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        ...baseConfig.coverage.exclude,
        "src/client/index.js",
        "src/server/server.js"
      ]
    },
    environment: {
      node: "16",
      browser: ["chrome", "firefox"]
    }
  },

  "library": {
    language: ["javascript"],
    framework: {
      testing: {
        unit: "jest",
        integration: "jest"
      }
    },
    structure: {
      sourceDir: "src",
      testDir: "tests",
      buildDir: "lib"
    },
    entryPoints: {
      main: "src/index.js"
    },
    testPatterns: {
      unit: "**/*.{test,spec}.{js,ts}",
      integration: "**/integration/**/*.{test,spec}.{js,ts}"
    },
    coverage: {
      include: ["src/**/*.{js,ts}"],
      exclude: baseConfig.coverage.exclude
    }
  }
};

/**
 * Framework-specific default configurations
 */
const frameworkDefaults = {
  react: {
    testPatterns: {
      unit: "**/*.{test,spec}.{js,jsx,ts,tsx}"
    },
    environment: {
      browser: ["chrome", "firefox"]
    }
  },

  vue: {
    testPatterns: {
      unit: "**/*.{test,spec}.{js,ts,vue}"
    }
  },

  angular: {
    testPatterns: {
      unit: "**/*.{test,spec}.ts"
    }
  },

  express: {
    environment: {
      variables: {
        NODE_ENV: "test",
        PORT: "3001"
      }
    }
  },

  fastapi: {
    environment: {
      variables: {
        ENVIRONMENT: "test"
      }
    }
  },

  flask: {
    environment: {
      variables: {
        FLASK_ENV: "testing"
      }
    }
  },

  django: {
    environment: {
      variables: {
        DJANGO_SETTINGS_MODULE: "myproject.settings.test"
      }
    }
  }
};

/**
 * Get default configuration for a specific project type
 * @param {string} projectType - The project type
 * @param {object} overrides - Configuration overrides
 * @returns {object} Merged configuration
 */
function getDefaultConfig(projectType, overrides = {}) {
  const typeConfig = projectTypeConfigs[projectType] || {};
  const merged = mergeDeep(baseConfig, typeConfig, overrides);
  
  // Add metadata
  merged.metadata = {
    created: new Date().toISOString(),
    createdBy: "decoupled-testing-suite-auto-config"
  };
  
  return merged;
}

/**
 * Get framework-specific defaults
 * @param {string} framework - Framework name
 * @returns {object} Framework defaults
 */
function getFrameworkDefaults(framework) {
  return frameworkDefaults[framework] || {};
}

/**
 * Deep merge objects
 * @param {...object} objects - Objects to merge
 * @returns {object} Merged object
 */
function mergeDeep(...objects) {
  function isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      if (isObject(prev[key]) && isObject(obj[key])) {
        prev[key] = mergeDeep(prev[key], obj[key]);
      } else {
        prev[key] = obj[key];
      }
    });
    return prev;
  }, {});
}

/**
 * Validate configuration against schema
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result
 */
function validateConfig(config) {
  // This would integrate with the JSON schema
  // For now, basic validation
  const required = ['projectRoot', 'projectType', 'language'];
  const missing = required.filter(field => !config[field]);
  
  return {
    valid: missing.length === 0,
    errors: missing.map(field => `Missing required field: ${field}`),
    warnings: []
  };
}

/**
 * Generate configuration from project analysis
 * @param {object} projectAnalysis - Analysis results from project discovery
 * @returns {object} Generated configuration
 */
function generateFromAnalysis(projectAnalysis) {
  const { projectType, framework, language, structure } = projectAnalysis;
  
  let config = getDefaultConfig(projectType);
  
  // Override with detected values
  if (framework) {
    config.framework = { ...config.framework, ...framework };
  }
  
  if (language) {
    config.language = language;
  }
  
  if (structure) {
    config.structure = { ...config.structure, ...structure };
  }
  
  // Apply framework-specific defaults
  if (framework.frontend) {
    const frontendDefaults = getFrameworkDefaults(framework.frontend);
    config = mergeDeep(config, frontendDefaults);
  }
  
  if (framework.backend) {
    const backendDefaults = getFrameworkDefaults(framework.backend);
    config = mergeDeep(config, backendDefaults);
  }
  
  return config;
}

module.exports = {
  baseConfig,
  projectTypeConfigs,
  frameworkDefaults,
  getDefaultConfig,
  getFrameworkDefaults,
  mergeDeep,
  validateConfig,
  generateFromAnalysis
};