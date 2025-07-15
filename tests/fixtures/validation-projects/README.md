# Mixed Project Test Fixtures

This directory contains test fixtures for validating Claude Testing Infrastructure's mixed-language project handling capabilities.

## Test Fixtures

### 1. Mixed Minimal (`mixed-minimal/`)

A minimal project combining Python and JavaScript to test basic mixed-language detection and test generation.

**Structure:**
```
mixed-minimal/
├── package.json          # JavaScript dependencies and scripts
├── requirements.txt      # Python dependencies
└── src/
    ├── index.js          # JavaScript entry point
    ├── main.py           # Python entry point
    ├── utils/
    │   └── math.js       # JavaScript math utilities
    ├── services/
    │   └── api.js        # JavaScript API service
    ├── math_utils.py     # Python math utilities
    └── api_client.py     # Python API client
```

**Languages:** JavaScript, Python  
**Frameworks:** Jest, pytest  
**Purpose:** Basic mixed-language validation

### 2. Mixed Complex (`mixed-complex/`)

A comprehensive project combining Python (FastAPI), TypeScript, React, and Node.js to test advanced mixed-language scenarios.

**Structure:**
```
mixed-complex/
├── package.json          # Frontend dependencies
├── requirements.txt      # Backend dependencies
├── tsconfig.json         # TypeScript configuration
├── src/                  # Frontend TypeScript/React code
│   ├── index.ts          # Main TypeScript entry
│   ├── components/
│   │   └── UserDashboard.tsx
│   ├── services/
│   │   ├── ApiService.ts
│   │   └── DataProcessor.ts
│   └── utils/
│       └── math.ts
└── backend/              # Python FastAPI backend
    ├── main.py           # FastAPI application
    ├── models/
    │   └── user.py       # Pydantic models
    └── services/
        ├── data_service.py
        └── user_service.py
```

**Languages:** JavaScript, TypeScript, Python  
**Frameworks:** React, FastAPI, Jest, pytest  
**Purpose:** Advanced mixed-language validation with modern full-stack architecture

## Test Harness (`mixed-test-harness.test.ts`)

Automated test suite that validates:

1. **Language Detection:** Correctly identifies all languages in mixed projects
2. **Framework Detection:** Identifies appropriate test frameworks for each language
3. **File Analysis:** Properly categorizes files by language and framework
4. **Test Generation:** Successfully generates tests for all detected languages
5. **Configuration Validation:** Ensures all required configuration files are present
6. **Cross-Language Integration:** Validates consistent behavior across languages

## Usage

### Running the Test Harness

```bash
# Run the mixed project validation tests
npm test -- mixed-test-harness.test.ts

# Or run all fixture tests
npm test tests/fixtures/
```

### Using Fixtures for Manual Testing

```bash
# Test minimal mixed project
node dist/src/cli/index.js analyze tests/fixtures/validation-projects/mixed-minimal
node dist/src/cli/index.js test tests/fixtures/validation-projects/mixed-minimal

# Test complex mixed project
node dist/src/cli/index.js analyze tests/fixtures/validation-projects/mixed-complex
node dist/src/cli/index.js test tests/fixtures/validation-projects/mixed-complex
```

## Validation Scenarios

### Scenario 1: Basic Mixed Language Support
- Project has both JavaScript and Python files
- Both languages are detected correctly
- Appropriate test frameworks are identified
- Tests are generated for both languages

### Scenario 2: TypeScript + Python Full-Stack
- Frontend uses TypeScript/React
- Backend uses Python/FastAPI
- All languages and frameworks detected
- Complex project structure handled correctly

### Scenario 3: Configuration Handling
- Multiple package managers (npm + pip)
- Multiple test frameworks (Jest + pytest)
- TypeScript configuration
- Framework-specific configurations

### Scenario 4: File Organization
- Monorepo structure with separate directories
- Mixed file types in same directories
- Complex import/dependency patterns
- Proper exclusion of node_modules, __pycache__, etc.

## Expected Outcomes

When tests pass, the Claude Testing Infrastructure should:

1. **Correctly identify** all languages in mixed projects
2. **Generate appropriate tests** for each language using correct frameworks
3. **Handle complex project structures** with multiple directories and file types
4. **Respect language-specific conventions** for test naming and structure
5. **Properly exclude** irrelevant files (node_modules, build artifacts, etc.)
6. **Generate working test configurations** that can actually execute

## Maintenance

When adding new mixed project scenarios:

1. Create a new fixture directory following the naming pattern
2. Include all necessary configuration files
3. Add validation tests to the test harness
4. Update this README with the new scenario
5. Ensure the fixture covers unique edge cases not covered by existing fixtures

## Troubleshooting

If tests fail:

1. **Check file paths:** Ensure all expected files exist in fixtures
2. **Verify configurations:** Package.json, requirements.txt, tsconfig.json should be valid
3. **Language detection:** May need to update ProjectAnalyzer if new file extensions are used
4. **Framework detection:** May need to update framework detection logic for new frameworks
5. **Test generation:** Check that TestGenerator supports all languages in the fixture