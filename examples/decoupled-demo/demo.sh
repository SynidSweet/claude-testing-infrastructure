#!/bin/bash

# Decoupled Testing Suite Demo Script
# This script demonstrates how to use the decoupled testing approach

set -e

echo "🚀 Decoupled Testing Suite Demo"
echo "================================="
echo ""

# Get the directory where this script is located
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$DEMO_DIR/sample-react-app"
SUITE_DIR="$DEMO_DIR/../../decoupled-testing-suite"
CONFIG_DIR="$DEMO_DIR/test-config"

echo "📁 Demo Setup:"
echo "   Project: $PROJECT_DIR"
echo "   Suite: $SUITE_DIR"
echo "   Config: $CONFIG_DIR"
echo ""

# Step 1: Discover the project
echo "🔍 Step 1: Discovering project structure..."
echo "============================================"
cd "$SUITE_DIR"
node scripts/discover-project.js --project-path "$PROJECT_DIR" --verbose
echo ""

# Step 2: Check compatibility
echo "🔧 Step 2: Checking compatibility..."
echo "===================================="
node scripts/check-compatibility.js --project-path "$PROJECT_DIR"
echo ""

# Step 3: Initialize testing configuration
echo "⚙️  Step 3: Initializing testing configuration..."
echo "================================================"
node scripts/init-project.js \
  --project-path "$PROJECT_DIR" \
  --config-dir "$CONFIG_DIR" \
  --yes \
  --verbose
echo ""

# Step 4: Validate the setup
echo "✅ Step 4: Validating setup..."
echo "=============================="
node scripts/validate-setup.js \
  --config-dir "$CONFIG_DIR" \
  --project-path "$PROJECT_DIR" \
  --verbose
echo ""

# Step 5: Analyze the project
echo "📊 Step 5: Analyzing project for testing opportunities..."
echo "========================================================"
node scripts/analyze-project.js \
  --project-path "$PROJECT_DIR" \
  --config-dir "$CONFIG_DIR" \
  --format report
echo ""

# Step 6: Show the generated configuration
echo "📋 Step 6: Generated Configuration"
echo "=================================="
echo "Configuration files created:"
ls -la "$CONFIG_DIR"
echo ""
echo "Main configuration:"
cat "$CONFIG_DIR/config.json" | head -20
echo "... (truncated)"
echo ""

# Step 7: Show test structure
echo "🧪 Step 7: Generated Test Structure"
echo "==================================="
echo "Test directory structure:"
find "$CONFIG_DIR/tests" -type f -name "*.js" -o -name "*.py" | head -10
echo ""

# Step 8: Run a sample test (if possible)
echo "🏃 Step 8: Running sample tests..."
echo "=================================="
if [ -d "$CONFIG_DIR/tests" ]; then
  echo "Test files generated successfully!"
  echo "To run tests, execute:"
  echo "  cd $SUITE_DIR"
  echo "  node scripts/run-tests.js --config-dir $CONFIG_DIR"
  echo ""
  echo "Or use the generated package.json:"
  echo "  cd $CONFIG_DIR"
  echo "  npm test"
else
  echo "❌ Test directory not found. Something went wrong."
fi
echo ""

# Step 9: Show maintenance commands
echo "🛠️  Step 9: Maintenance Commands"
echo "==============================="
echo "Available maintenance commands:"
echo ""
echo "1. Update the testing suite:"
echo "   node scripts/safe-update.js --config-dir $CONFIG_DIR"
echo ""
echo "2. Migrate configuration:"
echo "   node scripts/migrate-config.js --config-dir $CONFIG_DIR"
echo ""
echo "3. Re-analyze project:"
echo "   node scripts/analyze-project.js --project-path $PROJECT_DIR"
echo ""

echo "✅ Demo completed successfully!"
echo ""
echo "📚 Next Steps:"
echo "1. Examine the generated test files in: $CONFIG_DIR"
echo "2. Customize the tests for your specific needs"
echo "3. Set up CI/CD integration using the generated configurations"
echo "4. Run tests regularly with: npm run test"
echo ""
echo "🔗 For more information, see:"
echo "   - Main README: ../../README.md"
echo "   - Decoupled Guide: ../../decoupled-testing-suite/CLAUDE.md"
echo "   - Architecture: ../../ARCHITECTURE.md"