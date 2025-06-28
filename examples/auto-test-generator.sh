#!/bin/bash
# auto-test-generator.sh - Automated test generation using Claude Code CLI
#
# This script demonstrates how to use Claude in headless mode to automatically
# generate tests for JavaScript/TypeScript files.
#
# Usage:
#   ./auto-test-generator.sh <file-or-directory>
#
# Examples:
#   ./auto-test-generator.sh src/utils/validator.js
#   ./auto-test-generator.sh src/
#   ./auto-test-generator.sh .

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Claude is installed
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI is not installed${NC}"
    echo "Install it with: npm install -g @anthropic-ai/claude-code"
    exit 1
fi

# Function to generate tests for a single file
generate_test() {
    local file=$1
    local test_file="${file%.*}.test.${file##*.}"
    
    # Skip if test already exists
    if [[ -f "$test_file" ]]; then
        echo -e "${YELLOW}Skip: Test already exists for $file${NC}"
        return 0
    fi
    
    echo -e "${GREEN}Generating tests for: $file${NC}"
    
    # Build the prompt
    local prompt="Generate comprehensive tests for the following code.

Requirements:
- Use appropriate testing framework (Jest for JS/TS, pytest for Python)
- Include unit tests for all exported functions/classes
- Add edge case tests
- Include error handling tests
- Use descriptive test names
- Add setup/teardown if needed
- Include mocking where appropriate

Code to test:
$(cat "$file")

Generate only the test code, no explanations."

    # Generate tests using Claude in headless mode
    local result
    if result=$(claude -p "$prompt" --output-format json 2>&1); then
        # Extract test code from JSON response
        local test_code=$(echo "$result" | jq -r '.result' 2>/dev/null || echo "$result")
        
        # Save test file
        echo "$test_code" > "$test_file"
        echo -e "${GREEN}✓ Created: $test_file${NC}"
        
        # Extract cost if available
        local cost=$(echo "$result" | jq -r '.total_cost_usd' 2>/dev/null)
        if [[ -n "$cost" && "$cost" != "null" ]]; then
            echo -e "  Cost: \$${cost}"
        fi
    else
        echo -e "${RED}✗ Failed to generate test for $file${NC}"
        echo -e "  Error: $result"
        return 1
    fi
}

# Function to process a directory
process_directory() {
    local dir=$1
    local count=0
    local failed=0
    
    echo -e "${GREEN}Processing directory: $dir${NC}"
    
    # Find all JavaScript and TypeScript files
    while IFS= read -r -d '' file; do
        # Skip test files, node_modules, and hidden directories
        if [[ ! "$file" =~ \.(test|spec)\. ]] && \
           [[ ! "$file" =~ node_modules ]] && \
           [[ ! "$file" =~ /\. ]]; then
            
            if generate_test "$file"; then
                ((count++))
            else
                ((failed++))
            fi
        fi
    done < <(find "$dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -print0)
    
    # Also find Python files
    while IFS= read -r -d '' file; do
        if [[ ! "$file" =~ (test_|_test\.py) ]] && \
           [[ ! "$file" =~ __pycache__ ]] && \
           [[ ! "$file" =~ /\. ]]; then
            
            if generate_test "$file"; then
                ((count++))
            else
                ((failed++))
            fi
        fi
    done < <(find "$dir" -type f -name "*.py" -print0)
    
    echo -e "\n${GREEN}Summary:${NC}"
    echo -e "  Tests generated: $count"
    if [[ $failed -gt 0 ]]; then
        echo -e "  ${RED}Failed: $failed${NC}"
    fi
}

# Main script
main() {
    local target=$1
    
    if [[ -z "$target" ]]; then
        echo "Usage: $0 <file-or-directory>"
        echo "Examples:"
        echo "  $0 src/utils/validator.js"
        echo "  $0 src/"
        echo "  $0 ."
        exit 1
    fi
    
    if [[ ! -e "$target" ]]; then
        echo -e "${RED}Error: $target does not exist${NC}"
        exit 1
    fi
    
    if [[ -f "$target" ]]; then
        # Single file
        generate_test "$target"
    elif [[ -d "$target" ]]; then
        # Directory
        process_directory "$target"
    else
        echo -e "${RED}Error: $target is neither a file nor a directory${NC}"
        exit 1
    fi
}

# Run main function
main "$@"