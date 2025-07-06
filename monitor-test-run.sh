#!/bin/bash

# Smart monitor script that distinguishes between headless and interactive Claude sessions
# This version won't kill your interactive Claude CLI sessions!

echo "🔍 Smart Process Monitor for Safe Test Execution"
echo "=============================================="
echo ""

# Set the safety environment variable
export DISABLE_HEADLESS_AGENTS=true
echo "✅ Set DISABLE_HEADLESS_AGENTS=true for safety"
echo ""

# Function to check if a process is likely headless
# Headless Claude processes typically:
# - Are spawned by jest/node
# - Have --model arguments
# - Don't have interactive flags
is_likely_headless_claude() {
    local cmd="$1"
    
    # Check for typical headless patterns
    if [[ "$cmd" == *"claude"* ]] && [[ "$cmd" == *"--model"* ]]; then
        # Check if it's NOT interactive
        if [[ "$cmd" != *"--interactive"* ]] && [[ "$cmd" != *"claude-desktop"* ]]; then
            return 0  # Likely headless
        fi
    fi
    
    return 1  # Not headless
}

# Function to count headless Claude processes only
count_headless_claude_processes() {
    local count=0
    while IFS= read -r line; do
        if is_likely_headless_claude "$line"; then
            count=$((count + 1))
        fi
    done < <(ps aux | grep -E "claude" | grep -v grep)
    echo $count
}

# Function to show all Claude processes with classification
show_claude_processes() {
    echo "📊 Claude processes breakdown:"
    local headless=0
    local interactive=0
    
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local pid=$(echo "$line" | awk '{print $2}')
            local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
            
            if is_likely_headless_claude "$cmd"; then
                echo "   🤖 [HEADLESS] PID $pid: ${cmd:0:80}..."
                headless=$((headless + 1))
            else
                echo "   💬 [INTERACTIVE] PID $pid: ${cmd:0:80}..."
                interactive=$((interactive + 1))
            fi
        fi
    done < <(ps aux | grep -E "claude" | grep -v grep)
    
    echo ""
    echo "   Total: $headless headless, $interactive interactive"
}

# Function to kill only headless Claude processes
kill_headless_claude_processes() {
    echo "🎯 Targeting only headless Claude processes..."
    local killed=0
    
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local pid=$(echo "$line" | awk '{print $2}')
            local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
            
            if is_likely_headless_claude "$cmd"; then
                echo "   Killing headless process PID $pid"
                kill -9 $pid 2>/dev/null
                killed=$((killed + 1))
            fi
        fi
    done < <(ps aux | grep -E "claude" | grep -v grep)
    
    # Also kill any jest processes that might be spawning them
    if [ $killed -gt 0 ]; then
        echo "   Also killing jest processes..."
        pkill -f "jest.*claude-testing" 2>/dev/null
    fi
    
    echo "   Killed $killed headless processes"
}

# Monitor function that runs in background
monitor_processes() {
    echo "👀 Starting smart process monitor..."
    echo "   Will only kill HEADLESS Claude processes"
    echo "   Your interactive sessions are safe! 💚"
    echo ""
    
    local warning_threshold=2
    local critical_threshold=5
    
    while true; do
        local headless_count=$(count_headless_claude_processes)
        
        if [ $headless_count -gt $critical_threshold ]; then
            echo ""
            echo "🚨🚨🚨 CRITICAL: Detected $headless_count headless Claude processes! (limit: $critical_threshold)"
            show_claude_processes
            echo ""
            kill_headless_claude_processes
            echo "❌ Test aborted due to runaway headless process spawning"
            # Kill the parent test process too
            pkill -P $$ 2>/dev/null
            exit 1
        elif [ $headless_count -gt $warning_threshold ]; then
            echo ""
            echo "⚠️  WARNING: $headless_count headless Claude processes detected"
        fi
        sleep 0.5
    done
}

# Start the monitor in background
monitor_processes &
MONITOR_PID=$!

# Trap to ensure we clean up the monitor on exit
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $MONITOR_PID 2>/dev/null
    wait $MONITOR_PID 2>/dev/null
    echo "✅ Monitor stopped"
}
trap cleanup EXIT INT TERM

# Show current process status
echo "📊 Initial process scan:"
show_claude_processes
echo ""

# Show what we're about to run
echo "🚀 Running test command with smart monitoring..."
echo "   Command: npm test"
echo "   Safety: DISABLE_HEADLESS_AGENTS=true"
echo "   Monitor: Active (PID: $MONITOR_PID) - protecting interactive sessions"
echo ""
echo "Press Ctrl+C at any time to abort"
echo "=============================================="
echo ""

# Run the actual test command
npm test

# Capture the exit code
TEST_EXIT_CODE=$?

# Show final status
echo ""
echo "=============================================="
echo "📊 Final process scan:"
show_claude_processes
echo ""
echo "Test exit code: $TEST_EXIT_CODE"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Tests completed successfully"
else
    echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE