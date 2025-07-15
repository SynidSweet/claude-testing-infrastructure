# Configuration Templates

This directory contains pre-configured `.claude-testing.config.json` templates for common project types. These templates provide optimized settings for test generation, coverage, and AI features based on project-specific best practices.

## Available Templates

### Frontend Frameworks

#### React TypeScript (`react-typescript.json`)
- **Use for**: React projects with TypeScript
- **Test Framework**: Jest
- **Features**: Component testing, JSX support, React Testing Library integration
- **Coverage**: 80% lines, 75% functions, 70% branches
- **Special**: Excludes Storybook files and stories

#### Vue TypeScript (`vue-typescript.json`)
- **Use for**: Vue.js projects with TypeScript and Composition API
- **Test Framework**: Vitest (Vue ecosystem standard)
- **Features**: Vue component testing, composables testing
- **Coverage**: 80% lines, 75% functions, 70% branches
- **Special**: Supports .vue files, excludes Nuxt build artifacts

#### Next.js TypeScript (`nextjs-typescript.json`)
- **Use for**: Next.js applications with TypeScript
- **Test Framework**: Jest
- **Features**: Pages, App Router, API routes, components
- **Coverage**: 75% lines, 70% functions, 65% branches
- **Special**: Excludes .next build folder, public assets

### Backend Frameworks

#### Node.js Express TypeScript (`express-typescript.json`)
- **Use for**: Express.js APIs with TypeScript
- **Test Framework**: Jest
- **Features**: API testing, middleware testing, service layer
- **Coverage**: 85% lines, 80% functions, 75% branches
- **Special**: Excludes database configs and migrations

#### Node.js JavaScript (`node-javascript.json`)
- **Use for**: Node.js applications using JavaScript
- **Test Framework**: Jest
- **Features**: API testing, business logic, utilities
- **Coverage**: 85% lines, 80% functions, 75% branches
- **Special**: Higher coverage expectations for JavaScript projects

#### Python Django (`python-django.json`)
- **Use for**: Django web applications
- **Test Framework**: pytest
- **Features**: Model testing, view testing, API testing
- **Coverage**: 90% lines, 85% functions, 80% branches
- **Special**: Excludes migrations, Django-specific files

## How to Use Templates

### 1. Copy Template to Your Project

```bash
# Copy template to your project root
cp claude-testing-infrastructure/templates/config/react-typescript.json /path/to/your/project/.claude-testing.config.json
```

### 2. Customize for Your Project

Edit the copied file to match your project structure:

```json
{
  "include": [
    "src/**/*.{ts,tsx}",
    "your-custom-folder/**/*.{ts,tsx}"
  ],
  "exclude": [
    "**/*.test.*",
    "your-specific-excludes/**"
  ]
}
```

### 3. Verify Configuration

Run analysis to verify your configuration works:

```bash
node dist/src/cli/index.js analyze /path/to/your/project --show-config-sources
```

## Template Customization Guide

### Common Adjustments

#### File Patterns
```json
{
  "include": [
    "src/**/*.{js,ts,jsx,tsx}",  // Add/remove file extensions
    "lib/**/*.js",               // Add additional directories
    "custom-folder/**/*.ts"      // Project-specific folders
  ],
  "exclude": [
    "**/*.stories.*",            // Exclude Storybook
    "**/vendor/**",              // Exclude third-party code
    "your-specific-pattern/**"   // Project-specific exclusions
  ]
}
```

#### Coverage Thresholds
```json
{
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 85,        // Adjust based on project maturity
        "functions": 80,    // Stricter for critical projects
        "branches": 75,     // Lower for complex logic
        "statements": 85    // Should match lines generally
      }
    }
  }
}
```

#### AI Cost Limits
```json
{
  "ai": {
    "maxCost": 2.00,      // Lower for budget constraints
    "batchSize": 5,       // Smaller batches for complex files
    "timeout": 300        // Longer for complex projects
  }
}
```

### Framework-Specific Notes

#### React Projects
- Include `@testing-library/react` support
- Component testing with proper mocking
- Hook testing capabilities
- JSX/TSX file handling

#### Vue Projects
- Prefer Vitest over Jest for better Vue integration
- Support for Single File Components (.vue)
- Composables and stores testing
- Vue Test Utils integration

#### Node.js APIs
- API endpoint testing with supertest
- Database mocking strategies
- Environment variable handling
- Request/response testing

#### Python/Django
- Django test client integration
- Model and migration testing
- API testing with Django REST framework
- Database fixture management

## Best Practices

### 1. Start Conservative
Begin with lower coverage thresholds and gradually increase:
```json
{
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 70,     // Start here
        "functions": 65,
        "branches": 60,
        "statements": 70
      }
    }
  }
}
```

### 2. Exclude Appropriately
Don't test generated code, configs, or vendor files:
```json
{
  "exclude": [
    "**/*.config.*",      // Configuration files
    "**/generated/**",    // Auto-generated code
    "**/vendor/**",       // Third-party code
    "**/migrations/**"    // Database migrations
  ]
}
```

### 3. Balance AI Usage
Set reasonable cost limits to avoid surprise charges:
```json
{
  "ai": {
    "maxCost": 3.00,      // Monthly budget consideration
    "batchSize": 5        // Balance speed vs cost
  }
}
```

### 4. Use Incremental Testing
Enable for active development projects:
```json
{
  "incremental": {
    "enabled": true,
    "gitHooks": true,      // For team projects
    "baselineBranch": "main"
  }
}
```

## Template Selection Guide

| Project Type | Template | Key Features |
|--------------|----------|--------------|
| React + TypeScript | `react-typescript.json` | JSX, components, hooks |
| Vue + TypeScript | `vue-typescript.json` | SFC, composables, Vitest |
| Next.js | `nextjs-typescript.json` | Pages, API routes, SSR |
| Express API | `express-typescript.json` | REST APIs, middleware |
| Node.js CLI/Utils | `node-javascript.json` | Business logic, utilities |
| Django Web App | `python-django.json` | Models, views, APIs |

## Troubleshooting

### Configuration Not Loading
```bash
# Verify file location and syntax
node dist/src/cli/index.js analyze /path/to/project --debug
```

### Coverage Too Strict
Temporarily lower thresholds while improving test coverage:
```json
{
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 60,
        "functions": 55,
        "branches": 50,
        "statements": 60
      }
    }
  }
}
```

### AI Costs Too High
Reduce AI usage for large projects:
```json
{
  "ai": {
    "maxCost": 1.00,
    "batchSize": 3
  },
  "features": {
    "aiGeneration": false  // Use structural tests only
  }
}
```

## Contributing Templates

To add a new template:

1. Create `{framework}-{language}.json` file
2. Follow existing template structure
3. Include appropriate defaults for the framework
4. Add entry to this README
5. Test with real project of that type

## Support

For template-specific issues:
- Check the main [Configuration Guide](../../docs/configuration.md)
- Review [Getting Started](../../docs/user/getting-started.md)
- File issues at [GitHub Issues](https://github.com/SynidSweet/claude-testing-infrastructure/issues)