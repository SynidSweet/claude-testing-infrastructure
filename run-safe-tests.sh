#!/bin/bash

# Safe test runner - excludes tests that might spawn processes
# and monitors for any runaway process creation

echo "🛡️  Safe Test Runner for Claude Testing Infrastructure"
echo "===================================================="
echo ""

# Safety first - set environment variable
export DISABLE_HEADLESS_AGENTS=true
echo "✅ Set DISABLE_HEADLESS_AGENTS=true"

# Show what we're excluding
echo ""
echo "🚫 Excluding risky test files:"
echo "   - tests/ai/*.test.ts (ClaudeOrchestrator tests)"
echo "   - tests/validation/ai-agents/**/*.test.ts (AI validation tests)"
echo ""

# Create a temporary jest config that excludes risky tests
cat > jest.config.safe.js << 'EOF'
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns,
    // Exclude all AI-related tests that might spawn processes
    'tests/ai/',
    'tests/validation/ai-agents/',
    // Also exclude any test that directly tests process spawning
    '.*ClaudeOrchestrator.*\\.test\\.ts$',
    '.*processBatch.*\\.test\\.ts$'
  ],
  // Reduce timeout to catch hanging tests faster
  testTimeout: 5000,
  // Disable parallel execution for safety
  maxWorkers: 1
};
EOF

echo "📝 Created safe test configuration"
echo ""

# Function to monitor processes
monitor_processes() {
    local max_processes=50
    local check_interval=1
    
    while true; do
        # Count current node processes
        local node_count=$(ps aux | grep -E "node|jest" | grep -v grep | wc -l)
        
        if [ $node_count -gt $max_processes ]; then
            echo ""
            echo "🚨 EMERGENCY: Too many processes detected ($node_count > $max_processes)"
            echo "   Killing all test processes..."
            pkill -f "jest"
            pkill -f "ts-jest"
            pkill -f "claude"
            echo "❌ Tests aborted for safety"
            exit 1
        fi
        
        sleep $check_interval
    done
}

# Start background monitor
echo "👀 Starting process monitor..."
monitor_processes &
MONITOR_PID=$!

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $MONITOR_PID 2>/dev/null
    rm -f jest.config.safe.js
    echo "✅ Cleanup complete"
}
trap cleanup EXIT INT TERM

# Run tests with safe config
echo "🚀 Running safe test suite..."
echo "===================================================="
echo ""

# Use the safe config and add extra safety flags
npx jest --config=jest.config.safe.js \
         --runInBand \
         --detectOpenHandles \
         --forceExit \
         --verbose

TEST_EXIT_CODE=$?

echo ""
echo "===================================================="
echo "📊 Test Summary:"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All safe tests passed!"
else
    echo "❌ Some tests failed (exit code: $TEST_EXIT_CODE)"
fi

echo ""
echo "💡 Note: AI-related tests were skipped for safety."
echo "   To run them individually with monitoring, use:"
echo "   DISABLE_HEADLESS_AGENTS=true npm test -- tests/ai/specific-test.test.ts"

exit $TEST_EXIT_CODE