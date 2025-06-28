# Claude Code Automation Examples

This document provides comprehensive examples of using Claude Code in headless/non-interactive mode for automated tasks, particularly test generation.

## Overview of Claude Code Headless Mode

Claude Code supports headless (non-interactive) mode through the `-p` or `--print` flag, which allows you to:
- Run Claude commands programmatically
- Integrate Claude into scripts and CI/CD pipelines
- Parse responses in JSON format
- Process files and generate code automatically

## Basic Headless Mode Usage

### Simple Command
```bash
# Basic usage - returns text response
claude -p "What is 2+2?"

# With JSON output for programmatic parsing
claude -p "What is 2+2?" --output-format json
```

### Piping Content
```bash
# Analyze file content
cat myfile.js | claude -p "Explain this code"

# Process multiple files
find . -name "*.js" | claude -p "List all the JavaScript files"
```

## Automated Test Generation Examples

### 1. Generate Tests for a Single File

```bash
#!/bin/bash
# generate-test.sh

FILE_PATH=$1
TEST_PATH="${FILE_PATH%.js}.test.js"

# Read the file and generate tests
cat "$FILE_PATH" | claude -p "Generate comprehensive Jest tests for this JavaScript code. Include edge cases and error handling tests." > "$TEST_PATH"

echo "Generated tests at: $TEST_PATH"
```

### 2. Batch Test Generation with JSON Output

```bash
#!/bin/bash
# batch-test-generation.sh

# Process all JS files and generate tests
for file in src/**/*.js; do
  if [[ ! -f "${file%.js}.test.js" ]]; then
    echo "Generating tests for: $file"
    
    # Generate with JSON output for better parsing
    RESULT=$(cat "$file" | claude -p "Generate Jest tests for this code" --output-format json)
    
    # Extract the test code from JSON response
    TEST_CODE=$(echo "$RESULT" | jq -r '.result')
    
    # Save to test file
    echo "$TEST_CODE" > "${file%.js}.test.js"
  fi
done
```

### 3. Interactive Test Generation Script

```bash
#!/bin/bash
# smart-test-generator.sh

# Function to generate tests with context
generate_tests() {
  local file=$1
  local context=$2
  
  # Build the prompt with context
  PROMPT="Generate comprehensive tests for the following code.
Context: $context
Code:
$(cat "$file")

Requirements:
- Use Jest testing framework
- Include unit tests for all exported functions
- Add edge case tests
- Include error handling tests
- Add integration tests if applicable
- Use descriptive test names"

  # Generate tests
  claude -p "$PROMPT" --output-format json
}

# Example usage
RESULT=$(generate_tests "src/utils/validator.js" "This is a validation utility for user input")
TEST_CODE=$(echo "$RESULT" | jq -r '.result')
echo "$TEST_CODE" > "src/utils/validator.test.js"
```

### 4. Python Test Generation

```bash
#!/bin/bash
# python-test-gen.sh

# Generate pytest tests for Python files
for file in **/*.py; do
  if [[ ! -f "test_${file##*/}" ]]; then
    claude -p "Generate pytest tests for this Python code with fixtures and parametrized tests:
$(cat "$file")" > "tests/test_${file##*/}"
  fi
done
```

## Advanced Automation Patterns

### 1. CI/CD Integration

```yaml
# .github/workflows/test-generation.yml
name: Auto-generate Tests

on:
  push:
    paths:
      - 'src/**/*.js'

jobs:
  generate-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      
      - name: Generate Tests
        run: |
          for file in $(git diff --name-only HEAD^ HEAD | grep -E '\.js$'); do
            if [[ -f "$file" ]]; then
              TEST_FILE="${file%.js}.test.js"
              cat "$file" | claude -p "Generate Jest tests" > "$TEST_FILE"
              git add "$TEST_FILE"
            fi
          done
      
      - name: Commit Tests
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git commit -m "Auto-generate tests" || echo "No tests to commit"
          git push
```

### 2. Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for files without tests
for file in $(git diff --cached --name-only | grep -E '\.(js|ts)$'); do
  TEST_FILE="${file%.*}.test.${file##*.}"
  
  if [[ ! -f "$TEST_FILE" ]]; then
    echo "Generating test for: $file"
    cat "$file" | claude -p "Generate minimal test file to ensure this code works" > "$TEST_FILE"
    git add "$TEST_FILE"
  fi
done
```

### 3. Test Quality Analysis

```bash
#!/bin/bash
# analyze-test-quality.sh

# Analyze existing tests and suggest improvements
for test_file in **/*.test.js; do
  ANALYSIS=$(cat "$test_file" | claude -p "Analyze this test file and suggest improvements. Output as JSON with fields: coverage_gaps, suggested_tests, quality_score" --output-format json)
  
  SCORE=$(echo "$ANALYSIS" | jq -r '.result' | jq -r '.quality_score')
  
  if [[ $(echo "$SCORE < 0.8" | bc) -eq 1 ]]; then
    echo "Low quality test detected: $test_file (score: $SCORE)"
    echo "$ANALYSIS" | jq -r '.result.suggested_tests' > "${test_file}.suggestions"
  fi
done
```

## JSON Output Format

When using `--output-format json`, the response structure is:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 3973,
  "duration_api_ms": 3905,
  "num_turns": 1,
  "result": "Your generated code or response here",
  "session_id": "10be270e-c2c0-421b-9e26-c92e9efc5776",
  "total_cost_usd": 0.025241999999999997,
  "usage": {
    "input_tokens": 3,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 16498,
    "output_tokens": 6,
    "server_tool_use": {
      "web_search_requests": 0
    },
    "service_tier": "standard"
  }
}
```

## Node.js Integration Example

```javascript
// claude-test-generator.js
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ClaudeTestGenerator {
  async generateTestsForFile(filePath) {
    const code = await fs.readFile(filePath, 'utf-8');
    
    const prompt = `Generate comprehensive Jest tests for this code:
${code}

Requirements:
- Test all exported functions
- Include edge cases
- Add error scenarios
- Use async/await for async functions`;

    return new Promise((resolve, reject) => {
      exec(
        `claude -p "${prompt.replace(/"/g, '\\"')}" --output-format json`,
        { maxBuffer: 10 * 1024 * 1024 }, // 10MB buffer
        async (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          
          try {
            const result = JSON.parse(stdout);
            const testCode = result.result;
            
            const testPath = filePath.replace(/\.js$/, '.test.js');
            await fs.writeFile(testPath, testCode);
            
            resolve({
              testPath,
              testCode,
              sessionId: result.session_id,
              cost: result.total_cost_usd
            });
          } catch (parseError) {
            reject(parseError);
          }
        }
      );
    });
  }

  async generateTestsForDirectory(dirPath, pattern = '*.js') {
    const glob = require('glob');
    const files = glob.sync(path.join(dirPath, '**', pattern));
    
    const results = [];
    for (const file of files) {
      if (!file.includes('.test.')) {
        console.log(`Generating tests for: ${file}`);
        const result = await this.generateTestsForFile(file);
        results.push(result);
      }
    }
    
    return results;
  }
}

// Usage
const generator = new ClaudeTestGenerator();
generator.generateTestsForDirectory('./src')
  .then(results => {
    console.log(`Generated ${results.length} test files`);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    console.log(`Total cost: $${totalCost.toFixed(4)}`);
  })
  .catch(console.error);
```

## Best Practices

1. **Use JSON output** for programmatic parsing:
   ```bash
   claude -p "prompt" --output-format json
   ```

2. **Escape quotes** in prompts:
   ```bash
   PROMPT='Generate tests for function "getName()"'
   claude -p "$PROMPT"
   ```

3. **Handle errors** in scripts:
   ```bash
   RESULT=$(claude -p "prompt" --output-format json 2>&1)
   if [ $? -ne 0 ]; then
     echo "Error: $RESULT"
     exit 1
   fi
   ```

4. **Use verbose mode** for debugging:
   ```bash
   claude -p "prompt" --verbose
   ```

5. **Limit API calls** with caching:
   ```bash
   # Cache results to avoid regenerating
   CACHE_FILE=".test-cache/${file}.cache"
   if [[ ! -f "$CACHE_FILE" ]]; then
     claude -p "prompt" > "$CACHE_FILE"
   fi
   ```

## Limitations

- Each headless invocation is independent (no session persistence)
- No conversation context between calls
- Rate limits apply to API usage
- Large files may exceed token limits

## Additional Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
- [Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)