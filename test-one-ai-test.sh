#!/bin/bash

# Test a single AI test file with SMART safety measures
# Only kills headless Claude processes, not interactive sessions

echo "🧪 Testing Single AI Test with Smart Safety Measures"
echo "=================================================="
echo ""

# Maximum safety - multiple layers of protection
export DISABLE_HEADLESS_AGENTS=true
export NODE_ENV=test

echo "✅ Safety environment variables set:"
echo "   DISABLE_HEADLESS_AGENTS=true"
echo "   NODE_ENV=test"
echo ""

# Function to detect ONLY headless Claude processes
# Headless processes typically:
# 1. Have a parent process that's jest or node running our infrastructure
# 2. Are spawned with specific arguments (like --model)
# 3. Don't have a TTY attached
is_headless_claude() {
    local pid=$1
    
    # Check if process has a TTY (interactive sessions have TTY)
    if [ -t 0 ] && ps -p $pid -o tty= | grep -q "pts\|tty"; then
        return 1  # Has TTY, likely interactive
    fi
    
    # Check parent process
    local ppid=$(ps -p $pid -o ppid= 2>/dev/null | tr -d ' ')
    if [ -n "$ppid" ]; then
        local parent_cmd=$(ps -p $ppid -o comm= 2>/dev/null)
        # If parent is jest or node, it's likely headless
        if [[ "$parent_cmd" == *"jest"* ]] || [[ "$parent_cmd" == *"node"* ]]; then
            return 0  # Is headless
        fi
    fi
    
    # Check command line for typical headless patterns
    local cmd=$(ps -p $pid -o args= 2>/dev/null)
    if [[ "$cmd" == *"--model"* ]] && [[ "$cmd" != *"--interactive"* ]]; then
        return 0  # Likely headless with model argument
    fi
    
    return 1  # Not definitively headless
}

# Function to list current Claude processes with details
show_claude_processes() {
    echo "📊 Current Claude processes:"
    ps aux | grep -E "claude" | grep -v grep | while read line; do
        local pid=$(echo "$line" | awk '{print $2}')
        local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
        if is_headless_claude $pid; then
            echo "   🤖 [HEADLESS] PID $pid: $cmd"
        else
            echo "   💬 [INTERACTIVE] PID $pid: $cmd"
        fi
    done
}

# Show current state
show_claude_processes
echo ""

# Choose a simple test that shouldn't spawn processes
TEST_FILE="tests/utils/ProcessMonitor.test.ts"

echo "📄 Testing: $TEST_FILE"
echo "   (This test mocks process monitoring, shouldn't spawn real processes)"
echo ""

# Function to kill ONLY headless Claude processes
kill_headless_claude() {
    local killed=0
    ps aux | grep -E "claude" | grep -v grep | while read line; do
        local pid=$(echo "$line" | awk '{print $2}')
        if is_headless_claude $pid; then
            echo "   🎯 Killing headless Claude process: PID $pid"
            kill -9 $pid 2>/dev/null
            killed=$((killed + 1))
        fi
    done
    return $killed
}

# Monitor function that only kills headless processes
monitor() {
    local count=0
    local last_check=""
    
    while true; do
        # Get list of claude processes
        local current_processes=$(ps aux | grep -E "claude.*--model" | grep -v grep | grep -v "claude.*--interactive")
        
        if [ -n "$current_processes" ] && [ "$current_processes" != "$last_check" ]; then
            echo ""
            echo "⚠️  Detected new Claude process:"
            echo "$current_processes" | while read line; do
                local pid=$(echo "$line" | awk '{print $2}')
                if is_headless_claude $pid; then
                    echo "🤖 HEADLESS process detected: PID $pid"
                    echo "   Checking if DISABLE_HEADLESS_AGENTS prevented spawn..."
                    sleep 0.5
                    
                    # If it's still there after half a second, something went wrong
                    if kill -0 $pid 2>/dev/null; then
                        echo "   🚨 Process still alive - killing it!"
                        kill -9 $pid
                        echo "   ❌ Safety mechanism may have failed!"
                    else
                        echo "   ✅ Process terminated itself (safety mechanism worked)"
                    fi
                else
                    echo "💬 Interactive session detected: PID $pid (not touching it)"
                fi
            done
            last_check="$current_processes"
        fi
        
        # Progress indicator
        count=$((count + 1))
        if [ $((count % 20)) -eq 0 ]; then
            echo -n "."
        fi
        
        sleep 0.1
    done
}

# Start monitor in background
echo "👀 Starting smart process monitor (only targets headless processes)..."
monitor &
MONITOR_PID=$!

# Cleanup
cleanup() {
    echo ""
    echo "🧹 Stopping monitor..."
    kill $MONITOR_PID 2>/dev/null
    wait $MONITOR_PID 2>/dev/null
    echo ""
    echo "📊 Final process state:"
    show_claude_processes
}
trap cleanup EXIT

echo "🚀 Running test..."
echo ""

# Run the single test with timeout
timeout 30s npx jest "$TEST_FILE" --runInBand --detectOpenHandles --forceExit

EXIT_CODE=$?

echo ""
echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Test completed successfully"
elif [ $EXIT_CODE -eq 124 ]; then
    echo "⏰ Test timed out after 30 seconds"
else
    echo "❌ Test failed with exit code: $EXIT_CODE"
fi

# Final safety check
if ps aux | grep -E "claude.*--model" | grep -v grep | grep -v "interactive" > /dev/null; then
    echo ""
    echo "⚠️  Warning: Headless Claude processes still running!"
    kill_headless_claude
else
    echo ""
    echo "✅ No headless Claude processes detected - safety mechanism confirmed!"
fi