#!/usr/bin/env node

/**
 * Comprehensive Production Readiness Validation Script
 * 
 * Prevents false success claims by implementing robust, multi-layered validation
 * that validates ALL production criteria with clear pass/fail thresholds.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProductionReadinessValidator {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            overallScore: 0,
            criticalFailures: [],
            componentScores: {},
            recommendations: [],
            evidence: {}
        };
        this.requiredScore = 95; // Stricter than current 85%
        this.timeoutMs = 300000; // 5 minutes max per test
    }

    async run() {
        console.log('🔍 Comprehensive Production Readiness Validation');
        console.log('==================================================\n');

        try {
            // Phase 1: Critical Blockers (Must be 100%)
            await this.validateCriticalBlockers();
            
            // Phase 2: Test Suite Reliability (Must be 100%)
            await this.validateTestSuite();
            
            // Phase 3: CI/CD Pipeline Health (Must be 100%)
            await this.validateCIPipeline();
            
            // Phase 4: Code Quality Gates (Must pass thresholds)
            await this.validateCodeQuality();
            
            // Phase 5: Deployment Readiness (Must be validated)
            await this.validateDeploymentReadiness();
            
            // Calculate final scores and evidence
            this.calculateOverallScore();
            this.generateReport();
            
            return this.results.overallScore >= this.requiredScore && this.results.criticalFailures.length === 0;
            
        } catch (error) {
            this.results.criticalFailures.push(`Validation script error: ${error.message}`);
            this.generateReport();
            return false;
        }
    }

    async validateCriticalBlockers() {
        console.log('🚨 Phase 1: Critical Blockers');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 1.1 Linting Errors (Must be 0)
        try {
            const lintResult = execSync('npm run lint 2>&1', { encoding: 'utf8', timeout: this.timeoutMs });
            const errorCount = (lintResult.match(/error/gi) || []).length;
            const warningCount = (lintResult.match(/warning/gi) || []).length;
            
            if (errorCount > 0) {
                this.results.criticalFailures.push(`Linting: ${errorCount} errors found (must be 0)`);
                console.log(`❌ Linting: ${errorCount} errors, ${warningCount} warnings`);
            } else {
                console.log(`✅ Linting: 0 errors, ${warningCount} warnings`);
            }
            
            this.results.componentScores.linting = errorCount === 0 ? 100 : 0;
            this.results.evidence.linting = { errorCount, warningCount, output: lintResult.substring(0, 1000) };
            
        } catch (error) {
            this.results.criticalFailures.push(`Linting check failed: ${error.message}`);
            this.results.componentScores.linting = 0;
        }
        
        // 1.2 TypeScript Compilation (Must succeed)
        try {
            execSync('npm run build:check 2>&1', { encoding: 'utf8', timeout: this.timeoutMs });
            console.log('✅ TypeScript compilation: SUCCESS');
            this.results.componentScores.typescript = 100;
        } catch (error) {
            this.results.criticalFailures.push(`TypeScript compilation failed`);
            console.log('❌ TypeScript compilation: FAILED');
            this.results.componentScores.typescript = 0;
            this.results.evidence.typescript = error.message.substring(0, 1000);
        }
        
        // 1.3 Build Success (Must succeed)
        try {
            execSync('npm run build 2>&1', { encoding: 'utf8', timeout: this.timeoutMs });
            console.log('✅ Build: SUCCESS');
            this.results.componentScores.build = 100;
        } catch (error) {
            this.results.criticalFailures.push(`Build failed`);
            console.log('❌ Build: FAILED');
            this.results.componentScores.build = 0;
            this.results.evidence.build = error.message.substring(0, 1000);
        }
    }

    async validateTestSuite() {
        console.log('\n🧪 Phase 2: Test Suite Reliability');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const testConfigs = [
            { name: 'Core Tests', command: 'npm run test:core' },
            { name: 'CI Tests', command: 'npm run test:ci' },
            { name: 'Unit Tests', command: 'npm run test:unit' },
            { name: 'Integration Tests', command: 'npm run test:integration' }
        ];
        
        let totalTests = 0;
        let passedTests = 0;
        const testResults = {};
        
        for (const config of testConfigs) {
            try {
                console.log(`\n🔍 Running ${config.name}...`);
                const result = await this.runTestWithTimeout(config.command);
                
                // Parse Jest output for test counts
                const summary = this.parseJestOutput(result);
                totalTests += summary.total;
                passedTests += summary.passed;
                testResults[config.name] = summary;
                
                if (summary.failed === 0 && !summary.hasTimeouts) {
                    console.log(`✅ ${config.name}: ${summary.passed}/${summary.total} passed`);
                } else {
                    console.log(`❌ ${config.name}: ${summary.failed} failed, ${summary.passed} passed`);
                    if (summary.hasTimeouts) {
                        this.results.criticalFailures.push(`${config.name} has timeout issues`);
                    }
                }
                
            } catch (error) {
                console.log(`❌ ${config.name}: FAILED TO RUN - ${error.message}`);
                this.results.criticalFailures.push(`${config.name} failed to execute: ${error.message}`);
                testResults[config.name] = { failed: 1, passed: 0, total: 1, hasTimeouts: true };
                totalTests += 1;
            }
        }
        
        const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
        this.results.componentScores.testSuite = passRate;
        this.results.evidence.testResults = testResults;
        
        if (passRate < 100) {
            this.results.criticalFailures.push(`Test pass rate: ${passRate.toFixed(1)}% (must be 100%)`);
        }
        
        console.log(`\n📊 Overall Test Results: ${passedTests}/${totalTests} (${passRate.toFixed(1)}%)`);
    }

    async runTestWithTimeout(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command], { 
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: this.timeoutMs 
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout + stderr);
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            
            child.on('error', (error) => {
                reject(error);
            });
            
            // Timeout handling
            setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error(`Command timeout after ${this.timeoutMs}ms`));
            }, this.timeoutMs);
        });
    }

    parseJestOutput(output) {
        const lines = output.split('\n');
        let passed = 0, failed = 0, total = 0, hasTimeouts = false;
        
        for (const line of lines) {
            if (line.includes('Tests:')) {
                const matches = line.match(/(\d+) failed.*?(\d+) passed.*?(\d+) total/);
                if (matches) {
                    failed = parseInt(matches[1]) || 0;
                    passed = parseInt(matches[2]) || 0;
                    total = parseInt(matches[3]) || 0;
                }
            }
            if (line.includes('timeout') || line.includes('Timeout') || line.includes('TIMEOUT')) {
                hasTimeouts = true;
            }
        }
        
        return { passed, failed, total, hasTimeouts };
    }

    async validateCIPipeline() {
        console.log('\n🔄 Phase 3: CI/CD Pipeline Health');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Check if we can validate GitHub Actions status
        try {
            const result = execSync('npm run validation:production:enhanced 2>&1', { 
                encoding: 'utf8', 
                timeout: this.timeoutMs 
            });
            
            const ciScore = result.includes('CI/CD Pipeline: ✅') ? 100 : 0;
            this.results.componentScores.cicd = ciScore;
            
            if (ciScore === 100) {
                console.log('✅ CI/CD Pipeline: Healthy');
            } else {
                console.log('❌ CI/CD Pipeline: Issues detected');
                this.results.criticalFailures.push('CI/CD Pipeline has issues');
            }
            
            this.results.evidence.cicd = result.substring(0, 2000);
            
        } catch (error) {
            console.log('❌ CI/CD Pipeline: Unable to validate');
            this.results.componentScores.cicd = 0;
            this.results.evidence.cicd = error.message;
        }
    }

    async validateCodeQuality() {
        console.log('\n🔍 Phase 4: Code Quality Gates');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Run comprehensive quality checks
        const qualityChecks = [
            { name: 'Format Check', command: 'npm run format:check' },
            { name: 'Type Safety', command: 'npm run type-safety:check' },
            { name: 'Dependency Validation', command: 'npm run validate:dependencies' }
        ];
        
        let qualityScore = 0;
        const qualityResults = {};
        
        for (const check of qualityChecks) {
            try {
                execSync(check.command + ' 2>&1', { encoding: 'utf8', timeout: this.timeoutMs });
                console.log(`✅ ${check.name}: PASSED`);
                qualityResults[check.name] = true;
                qualityScore += 100 / qualityChecks.length;
            } catch (error) {
                console.log(`❌ ${check.name}: FAILED`);
                qualityResults[check.name] = false;
                if (check.name === 'Type Safety') {
                    this.results.criticalFailures.push(`${check.name} validation failed`);
                }
            }
        }
        
        this.results.componentScores.codeQuality = qualityScore;
        this.results.evidence.codeQuality = qualityResults;
    }

    async validateDeploymentReadiness() {
        console.log('\n🚀 Phase 5: Deployment Readiness');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Check CLI functionality
        try {
            const cliResult = execSync('node dist/src/cli/index.js --version 2>&1', { 
                encoding: 'utf8', 
                timeout: 30000 
            });
            
            if (cliResult.includes('2.0.0')) {
                console.log('✅ CLI Functionality: Working');
                this.results.componentScores.cliDeployment = 100;
            } else {
                console.log('❌ CLI Functionality: Version mismatch');
                this.results.componentScores.cliDeployment = 50;
            }
            
            this.results.evidence.cliDeployment = cliResult;
            
        } catch (error) {
            console.log('❌ CLI Functionality: Not working');
            this.results.componentScores.cliDeployment = 0;
            this.results.criticalFailures.push('CLI is not functional for deployment');
        }
        
        // Check documentation completeness
        const requiredDocs = [
            'README.md', 
            'AI_AGENT_GUIDE.md', 
            'PROJECT_CONTEXT.md',
            'docs/CURRENT_FOCUS.md'
        ];
        
        let docScore = 0;
        for (const doc of requiredDocs) {
            if (fs.existsSync(doc)) {
                docScore += 100 / requiredDocs.length;
            } else {
                console.log(`❌ Missing documentation: ${doc}`);
            }
        }
        
        this.results.componentScores.documentation = docScore;
        console.log(`📚 Documentation: ${docScore.toFixed(0)}% complete`);
    }

    calculateOverallScore() {
        const weights = {
            linting: 0.20,        // Critical: Must be 0 errors
            typescript: 0.15,     // Critical: Must compile
            build: 0.15,          // Critical: Must build
            testSuite: 0.25,      // Critical: Must be 100%
            cicd: 0.15,           // High: Must be reliable
            codeQuality: 0.05,    // Medium: Nice to have
            cliDeployment: 0.03,  // Medium: Deployment check
            documentation: 0.02   // Low: Should be complete
        };
        
        let weightedScore = 0;
        for (const [component, weight] of Object.entries(weights)) {
            const score = this.results.componentScores[component] || 0;
            weightedScore += score * weight;
        }
        
        this.results.overallScore = Math.round(weightedScore);
    }

    generateReport() {
        console.log('\n📊 COMPREHENSIVE VALIDATION REPORT');
        console.log('═══════════════════════════════════════');
        
        console.log(`\n🎯 Overall Score: ${this.results.overallScore}%`);
        console.log(`🚨 Critical Failures: ${this.results.criticalFailures.length}`);
        console.log(`📋 Required Score: ${this.requiredScore}%`);
        
        const isProductionReady = this.results.overallScore >= this.requiredScore && 
                                 this.results.criticalFailures.length === 0;
        
        console.log(`\n🏭 Production Ready: ${isProductionReady ? '✅ YES' : '❌ NO'}`);
        
        if (this.results.criticalFailures.length > 0) {
            console.log('\n🚨 CRITICAL FAILURES THAT MUST BE FIXED:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            this.results.criticalFailures.forEach((failure, index) => {
                console.log(`${index + 1}. ${failure}`);
            });
        }
        
        console.log('\n📈 Component Scores:');
        console.log('━━━━━━━━━━━━━━━━━━━━');
        Object.entries(this.results.componentScores).forEach(([component, score]) => {
            const status = score === 100 ? '✅' : score >= 80 ? '⚠️' : '❌';
            console.log(`${status} ${component}: ${score}%`);
        });
        
        // Save detailed report
        const reportPath = './validation-report-comprehensive.json';
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Detailed report saved: ${reportPath}`);
        
        console.log('\n' + '═'.repeat(50));
        console.log(isProductionReady ? 
            '✅ PROJECT IS PRODUCTION READY!' : 
            '❌ PROJECT REQUIRES FIXES BEFORE PRODUCTION');
        console.log('═'.repeat(50));
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new ProductionReadinessValidator();
    validator.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionReadinessValidator;