#!/usr/bin/env node

/**
 * Test Execution Monitor
 * 
 * Comprehensive test execution monitoring system that provides:
 * - Real-time test execution tracking
 * - Detailed test result logging
 * - Performance metrics collection
 * - Historical comparison
 * - CI/CD pipeline integration
 * - Evidence collection for sprint validation
 * 
 * Features:
 * - Monitors all test executions with detailed logging
 * - Tracks test counts, pass rates, and execution times
 * - Collects memory usage and performance metrics
 * - Generates comprehensive evidence reports
 * - Integrates with existing validation systems
 * 
 * Usage:
 *   node scripts/test-execution-monitor.js [options]
 *   node scripts/test-execution-monitor.js --command "npm test"
 *   node scripts/test-execution-monitor.js --all-tests
 *   node scripts/test-execution-monitor.js --generate-report
 * 
 * Exit codes:
 *   0 = All tests passed with monitoring complete
 *   1 = Test failures detected
 *   2 = Monitoring system error
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class TestExecutionMonitor {
    constructor(options = {}) {
        this.options = {
            command: options.command || null,
            allTests: options.allTests || false,
            generateReport: options.generateReport || true,
            outputDir: options.outputDir || 'test-execution-evidence',
            verbose: options.verbose || false,
            collectMetrics: options.collectMetrics || true,
            historicalComparison: options.historicalComparison || true,
            ...options
        };

        this.results = {
            metadata: {
                startTime: new Date().toISOString(),
                endTime: null,
                duration: null,
                environment: {
                    node: process.version,
                    platform: os.platform(),
                    arch: os.arch(),
                    cpus: os.cpus().length,
                    memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
                }
            },
            executions: [],
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                skippedTests: 0,
                passRate: 0,
                totalSuites: 0,
                passedSuites: 0,
                failedSuites: 0,
                averageExecutionTime: 0,
                peakMemoryUsage: 0
            },
            performance: {
                executionTimes: [],
                memoryUsage: [],
                cpuUsage: []
            },
            evidence: {
                logs: [],
                screenshots: [],
                reports: []
            }
        };

        this.testCommands = [
            { name: 'unit-tests', command: 'npm run test:unit', expectedTests: 600 },
            { name: 'integration-tests', command: 'npm run test:integration', expectedTests: 10 },
            { name: 'all-tests', command: 'npm test', expectedTests: 610 },
            { name: 'fast-tests', command: 'npm run test:fast', expectedTests: 100 },
            { name: 'coverage', command: 'npm run test:coverage', expectedTests: 610 }
        ];

        // Ensure output directory exists
        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
        }
    }

    async monitor() {
        console.log('🔍 Test Execution Monitor v1.0.0');
        console.log('================================\n');

        try {
            if (this.options.allTests) {
                // Monitor all test commands
                for (const testCmd of this.testCommands) {
                    await this.monitorTestExecution(testCmd);
                }
            } else if (this.options.command) {
                // Monitor specific command
                await this.monitorTestExecution({
                    name: 'custom',
                    command: this.options.command,
                    expectedTests: 0
                });
            } else {
                // Default: monitor main test suite
                await this.monitorTestExecution(this.testCommands[2]); // all-tests
            }

            // Finalize results
            this.results.metadata.endTime = new Date().toISOString();
            this.results.metadata.duration = this.calculateDuration();
            this.calculateSummary();

            // Historical comparison
            if (this.options.historicalComparison) {
                await this.compareWithHistory();
            }

            // Generate report
            if (this.options.generateReport) {
                await this.generateEvidenceReport();
            }

            // Display results
            this.displayResults();

            // Save results
            await this.saveResults();

            // Determine exit code
            return this.results.summary.failedTests > 0 ? 1 : 0;

        } catch (error) {
            console.error('❌ Monitor Error:', error.message);
            return 2;
        }
    }

    async monitorTestExecution(testConfig) {
        console.log(`\n📊 Monitoring: ${testConfig.name}`);
        console.log(`   Command: ${testConfig.command}`);
        console.log(`   Expected: ${testConfig.expectedTests || 'Any'} tests\n`);

        const execution = {
            name: testConfig.name,
            command: testConfig.command,
            startTime: new Date().toISOString(),
            endTime: null,
            duration: null,
            output: '',
            metrics: {
                testsDiscovered: 0,
                testsPassed: 0,
                testsFailed: 0,
                testsSkipped: 0,
                suitesTotal: 0,
                suitesPassed: 0,
                suitesFailed: 0,
                memoryUsage: [],
                cpuUsage: []
            },
            status: 'running',
            errors: []
        };

        return new Promise((resolve) => {
            const startTime = Date.now();
            const child = spawn(testConfig.command, [], {
                shell: true,
                env: { ...process.env, CI: 'true' }
            });

            let output = '';
            let errorOutput = '';

            // Monitor resource usage
            const metricsInterval = setInterval(() => {
                if (this.options.collectMetrics) {
                    const usage = process.memoryUsage();
                    execution.metrics.memoryUsage.push({
                        timestamp: Date.now() - startTime,
                        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
                        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
                        rss: Math.round(usage.rss / 1024 / 1024)
                    });
                }
            }, 1000);

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                execution.output += chunk;

                // Real-time parsing
                this.parseTestOutput(chunk, execution);

                if (this.options.verbose) {
                    process.stdout.write(chunk);
                }
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                if (this.options.verbose) {
                    process.stderr.write(chunk);
                }
            });

            child.on('close', (code) => {
                clearInterval(metricsInterval);

                execution.endTime = new Date().toISOString();
                execution.duration = Date.now() - startTime;
                execution.status = code === 0 ? 'passed' : 'failed';
                execution.exitCode = code;

                // Final parsing of complete output
                this.parseCompleteOutput(output + errorOutput, execution);

                // Validate against expectations
                if (testConfig.expectedTests > 0) {
                    if (execution.metrics.testsDiscovered < testConfig.expectedTests) {
                        execution.errors.push(
                            `Expected ${testConfig.expectedTests} tests but found ${execution.metrics.testsDiscovered}`
                        );
                        execution.status = 'failed';
                    }
                }

                this.results.executions.push(execution);

                console.log(`\n✅ Monitoring complete for ${testConfig.name}:`);
                console.log(`   Tests: ${execution.metrics.testsPassed}/${execution.metrics.testsDiscovered} passed`);
                console.log(`   Duration: ${execution.duration}ms`);
                console.log(`   Status: ${execution.status}`);

                resolve(execution);
            });

            // Timeout protection
            setTimeout(() => {
                if (execution.status === 'running') {
                    child.kill('SIGTERM');
                    execution.status = 'timeout';
                    execution.errors.push('Test execution timed out');
                }
            }, 300000); // 5 minutes
        });
    }

    parseTestOutput(output, execution) {
        // Parse Jest output patterns
        const patterns = {
            testCount: /Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+skipped,\s+(\d+)\s+total/,
            suiteCount: /Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/,
            testRunning: /PASS|FAIL|RUNS/,
            snapshot: /Snapshots:\s+(\d+)/
        };

        const testMatch = output.match(patterns.testCount);
        if (testMatch) {
            execution.metrics.testsPassed = parseInt(testMatch[1]) || 0;
            execution.metrics.testsFailed = parseInt(testMatch[2]) || 0;
            execution.metrics.testsSkipped = parseInt(testMatch[3]) || 0;
            execution.metrics.testsDiscovered = parseInt(testMatch[4]) || 0;
        }

        const suiteMatch = output.match(patterns.suiteCount);
        if (suiteMatch) {
            execution.metrics.suitesPassed = parseInt(suiteMatch[1]) || 0;
            execution.metrics.suitesFailed = parseInt(suiteMatch[2]) || 0;
            execution.metrics.suitesTotal = parseInt(suiteMatch[3]) || 0;
        }
    }

    parseCompleteOutput(output, execution) {
        // More comprehensive parsing of complete output
        if (execution.metrics.testsDiscovered === 0) {
            // Try alternative patterns
            const altPatterns = [
                /(\d+)\s+passing/,
                /(\d+)\s+tests?\s+passed/i,
                /All\s+(\d+)\s+tests?\s+passed/i
            ];

            for (const pattern of altPatterns) {
                const match = output.match(pattern);
                if (match) {
                    execution.metrics.testsDiscovered = parseInt(match[1]) || 0;
                    execution.metrics.testsPassed = execution.metrics.testsDiscovered;
                    break;
                }
            }
        }

        // Check for "No tests found" scenarios
        if (output.includes('No tests found') || 
            output.includes('0 tests') ||
            output.includes('no tests to run')) {
            execution.metrics.testsDiscovered = 0;
            execution.errors.push('No tests were discovered or executed');
        }
    }

    calculateDuration() {
        if (!this.results.metadata.startTime || !this.results.metadata.endTime) {
            return 0;
        }
        const start = new Date(this.results.metadata.startTime);
        const end = new Date(this.results.metadata.endTime);
        return end - start;
    }

    calculateSummary() {
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        let skippedTests = 0;
        let totalSuites = 0;
        let passedSuites = 0;
        let failedSuites = 0;
        let totalDuration = 0;
        let peakMemory = 0;

        for (const execution of this.results.executions) {
            totalTests += execution.metrics.testsDiscovered;
            passedTests += execution.metrics.testsPassed;
            failedTests += execution.metrics.testsFailed;
            skippedTests += execution.metrics.testsSkipped;
            totalSuites += execution.metrics.suitesTotal;
            passedSuites += execution.metrics.suitesPassed;
            failedSuites += execution.metrics.suitesFailed;
            totalDuration += execution.duration || 0;

            // Find peak memory usage
            for (const metric of execution.metrics.memoryUsage) {
                if (metric.rss > peakMemory) {
                    peakMemory = metric.rss;
                }
            }
        }

        this.results.summary = {
            totalTests,
            passedTests,
            failedTests,
            skippedTests,
            passRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0,
            totalSuites,
            passedSuites,
            failedSuites,
            averageExecutionTime: this.results.executions.length > 0 
                ? Math.round(totalDuration / this.results.executions.length) 
                : 0,
            peakMemoryUsage: peakMemory
        };
    }

    async compareWithHistory() {
        const historyFile = path.join(this.options.outputDir, 'test-execution-history.json');
        
        if (fs.existsSync(historyFile)) {
            try {
                const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                const lastRun = history[history.length - 1];

                console.log('\n📈 Historical Comparison:');
                console.log(`   Previous pass rate: ${lastRun.summary.passRate}%`);
                console.log(`   Current pass rate: ${this.results.summary.passRate}%`);
                
                const improvement = parseFloat(this.results.summary.passRate) - parseFloat(lastRun.summary.passRate);
                if (improvement > 0) {
                    console.log(`   ✅ Improvement: +${improvement.toFixed(2)}%`);
                } else if (improvement < 0) {
                    console.log(`   ⚠️  Regression: ${improvement.toFixed(2)}%`);
                } else {
                    console.log(`   ➡️  No change`);
                }
            } catch (error) {
                console.log('   ⚠️  No historical data available for comparison');
            }
        }
    }

    async generateEvidenceReport() {
        const report = {
            title: 'Test Execution Evidence Report',
            generated: new Date().toISOString(),
            summary: this.results.summary,
            details: this.results.executions.map(exec => ({
                name: exec.name,
                command: exec.command,
                status: exec.status,
                duration: `${exec.duration}ms`,
                tests: `${exec.metrics.testsPassed}/${exec.metrics.testsDiscovered}`,
                errors: exec.errors
            })),
            validation: {
                allTestsPassed: this.results.summary.failedTests === 0,
                expectedTestCount: this.results.summary.totalTests >= 44,
                performanceAcceptable: this.results.summary.averageExecutionTime < 60000,
                memoryUsageAcceptable: this.results.summary.peakMemoryUsage < 2048
            },
            evidence: {
                logFiles: [],
                screenshots: [],
                artifacts: []
            }
        };

        // Save detailed execution logs
        for (const execution of this.results.executions) {
            const logFile = path.join(
                this.options.outputDir, 
                `${execution.name}-execution.log`
            );
            fs.writeFileSync(logFile, execution.output);
            report.evidence.logFiles.push(logFile);
        }

        // Save report
        const reportFile = path.join(this.options.outputDir, 'test-execution-evidence.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        console.log(`\n📄 Evidence report saved to: ${reportFile}`);
    }

    displayResults() {
        console.log('\n=====================================');
        console.log('📊 Test Execution Summary');
        console.log('=====================================');
        console.log(`Total Tests: ${this.results.summary.totalTests}`);
        console.log(`Passed: ${this.results.summary.passedTests} ✅`);
        console.log(`Failed: ${this.results.summary.failedTests} ❌`);
        console.log(`Skipped: ${this.results.summary.skippedTests} ⏭️`);
        console.log(`Pass Rate: ${this.results.summary.passRate}% ${this.results.summary.passRate >= 100 ? '🎯' : '⚠️'}`);
        console.log(`\nTest Suites: ${this.results.summary.totalSuites}`);
        console.log(`Average Execution Time: ${this.results.summary.averageExecutionTime}ms`);
        console.log(`Peak Memory Usage: ${this.results.summary.peakMemoryUsage}MB`);
        console.log('=====================================\n');

        // Validation status
        console.log('🔍 Validation Status:');
        console.log(`   Test Discovery: ${this.results.summary.totalTests >= 44 ? '✅ 44+ tests found' : '❌ Insufficient tests'}`);
        console.log(`   Pass Rate: ${this.results.summary.passRate >= 100 ? '✅ 100% pass rate' : `⚠️  ${this.results.summary.passRate}% pass rate`}`);
        console.log(`   CI/CD Ready: ${this.results.summary.failedTests === 0 ? '✅ Ready for CI/CD' : '❌ Fix failures first'}`);
    }

    async saveResults() {
        // Save current results
        const resultsFile = path.join(this.options.outputDir, 'latest-execution.json');
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));

        // Update history
        const historyFile = path.join(this.options.outputDir, 'test-execution-history.json');
        let history = [];
        
        if (fs.existsSync(historyFile)) {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        }

        // Add current results to history (keep last 100 runs)
        history.push({
            timestamp: this.results.metadata.startTime,
            summary: this.results.summary
        });

        if (history.length > 100) {
            history = history.slice(-100);
        }

        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

        console.log(`\n💾 Results saved to: ${resultsFile}`);
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        command: null,
        allTests: false,
        generateReport: true,
        verbose: false
    };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--command':
            case '-c':
                options.command = args[++i];
                break;
            case '--all-tests':
            case '-a':
                options.allTests = true;
                break;
            case '--no-report':
                options.generateReport = false;
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--output-dir':
            case '-o':
                options.outputDir = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
Test Execution Monitor

Usage:
  node scripts/test-execution-monitor.js [options]

Options:
  --command, -c <cmd>     Monitor specific test command
  --all-tests, -a         Monitor all test commands
  --no-report            Skip evidence report generation
  --verbose, -v          Show test output in real-time
  --output-dir, -o <dir> Output directory for evidence
  --help, -h             Show this help message

Examples:
  node scripts/test-execution-monitor.js --all-tests
  node scripts/test-execution-monitor.js -c "npm run test:unit"
  node scripts/test-execution-monitor.js --verbose --output-dir ./evidence
`);
                process.exit(0);
        }
    }

    const monitor = new TestExecutionMonitor(options);
    monitor.monitor().then(exitCode => {
        process.exit(exitCode);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(2);
    });
}

module.exports = TestExecutionMonitor;