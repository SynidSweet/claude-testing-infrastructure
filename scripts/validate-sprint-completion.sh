#!/bin/bash

# Sprint Validation Script
# Runs all validation checks for the Heartbeat Monitoring Test Suite sprint

echo "🎯 Heartbeat Monitoring Test Suite Sprint Validation"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track overall success
ALL_PASSED=true

# 1. Unit Test Coverage Validation
echo "1️⃣  Unit Test Coverage Validation"
echo "--------------------------------"
if node scripts/validate-heartbeat-coverage.js; then
    echo -e "${GREEN}✓ Unit test coverage validation PASSED${NC}"
else
    echo -e "${RED}✗ Unit test coverage validation FAILED${NC}"
    ALL_PASSED=false
fi
echo ""

# 2. Integration Test Reliability
echo "2️⃣  Integration Test Reliability Validation"
echo "----------------------------------------"
if node scripts/validate-integration-reliability.js; then
    echo -e "${GREEN}✓ Integration test reliability PASSED${NC}"
else
    echo -e "${RED}✗ Integration test reliability FAILED${NC}"
    ALL_PASSED=false
fi
echo ""

# 3. Test Helper Utility Verification
echo "3️⃣  Test Helper Utility Verification"
echo "-----------------------------------"
if [ -f "src/utils/HeartbeatTestHelper.ts" ]; then
    echo -e "${GREEN}✓ HeartbeatTestHelper exists${NC}"
    # Run type checking
    if npx tsc --noEmit src/utils/HeartbeatTestHelper.ts; then
        echo -e "${GREEN}✓ HeartbeatTestHelper type checks pass${NC}"
    else
        echo -e "${RED}✗ HeartbeatTestHelper has type errors${NC}"
        ALL_PASSED=false
    fi
else
    echo -e "${RED}✗ HeartbeatTestHelper not found${NC}"
    ALL_PASSED=false
fi
echo ""

# 4. Documentation Completeness
echo "4️⃣  Documentation Completeness Check"
echo "----------------------------------"
DOC_FILE="docs/testing/heartbeat-monitoring-guide.md"
if [ -f "$DOC_FILE" ]; then
    echo -e "${GREEN}✓ Testing guide exists${NC}"
    
    # Check for required sections
    REQUIRED_SECTIONS=("Unit Testing Strategy" "Integration Testing" "Common Pitfalls" "Example Code")
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if grep -q "$section" "$DOC_FILE"; then
            echo -e "${GREEN}  ✓ Contains section: $section${NC}"
        else
            echo -e "${YELLOW}  ⚠ Missing section: $section${NC}"
        fi
    done
else
    echo -e "${RED}✗ Testing guide not found at $DOC_FILE${NC}"
    ALL_PASSED=false
fi
echo ""

# 5. Evidence Collection
echo "5️⃣  Evidence Collection"
echo "--------------------"
EVIDENCE_DIR="sprint-evidence"
mkdir -p $EVIDENCE_DIR

# Collect coverage report
if [ -f "coverage-validation-report.json" ]; then
    cp coverage-validation-report.json $EVIDENCE_DIR/
    echo -e "${GREEN}✓ Coverage report collected${NC}"
fi

# Collect reliability report
if [ -f "integration-reliability-report.json" ]; then
    cp integration-reliability-report.json $EVIDENCE_DIR/
    echo -e "${GREEN}✓ Reliability report collected${NC}"
fi

# Generate summary
cat > $EVIDENCE_DIR/validation-summary.json << EOF
{
  "sprint": "Heartbeat Monitoring Test Suite Production Readiness",
  "validation_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "overall_result": "$( [ "$ALL_PASSED" = true ] && echo "PASS" || echo "FAIL" )",
  "checks": {
    "unit_test_coverage": "$( [ -f "coverage-validation-report.json" ] && echo "COMPLETE" || echo "MISSING" )",
    "integration_reliability": "$( [ -f "integration-reliability-report.json" ] && echo "COMPLETE" || echo "MISSING" )",
    "test_utilities": "$( [ -f "src/utils/HeartbeatTestHelper.ts" ] && echo "COMPLETE" || echo "MISSING" )",
    "documentation": "$( [ -f "$DOC_FILE" ] && echo "COMPLETE" || echo "MISSING" )"
  }
}
EOF

echo -e "${GREEN}✓ Evidence collected in $EVIDENCE_DIR/${NC}"
echo ""

# Final Result
echo "=================================================="
if [ "$ALL_PASSED" = true ]; then
    echo -e "${GREEN}🎉 SPRINT VALIDATION PASSED! 🎉${NC}"
    echo "All validation criteria have been met."
    exit 0
else
    echo -e "${RED}❌ SPRINT VALIDATION FAILED ❌${NC}"
    echo "Some validation criteria were not met."
    echo "Please review the failed checks above."
    exit 1
fi