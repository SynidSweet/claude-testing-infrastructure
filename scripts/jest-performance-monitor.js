#!/usr/bin/env node

/**
 * Jest Performance Monitor
 * Measures test execution performance across different configurations
 * and provides optimization recommendations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class JestPerformanceMonitor {
  constructor() {
    this.results = [];
    this.systemInfo = this.getSystemInfo();
  }

  getSystemInfo() {
    return {
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),
      platform: os.platform(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };
  }

  async measureConfiguration(configName, command) {
    console.log(`\n📊 Measuring performance: ${configName}`);
    console.log(`Command: ${command}`);
    
    const startTime = Date.now();
    let success = false;
    let testCount = 0;
    let suiteCount = 0;
    let output = '';
    
    try {
      // Execute the test command and capture output
      output = execSync(command, { 
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 300000, // 5 minute timeout
        stdio: 'pipe'
      });
      success = true;
      
      // Parse Jest output for test counts
      const testMatch = output.match(/Tests:\s+(\d+)\s+passed/);
      const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed/);
      
      if (testMatch) testCount = parseInt(testMatch[1]);
      if (suiteMatch) suiteCount = parseInt(suiteMatch[1]);
      
    } catch (error) {
      console.error(`❌ Error running ${configName}:`, error.message);
      output = error.stdout || error.message;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = {
      configName,
      command,
      duration,
      success,
      testCount,
      suiteCount,
      testsPerSecond: testCount > 0 ? Math.round((testCount / duration) * 1000) : 0,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✅ Tests: ${testCount} (${result.testsPerSecond} tests/sec)`);
    console.log(`📦 Suites: ${suiteCount}`);
    
    return result;
  }

  async measureAllConfigurations() {
    console.log('🚀 Starting Jest Performance Benchmark\n');
    console.log(`System: ${this.systemInfo.cpus} cores, ${this.systemInfo.totalMemory}GB RAM`);
    console.log(`Node: ${this.systemInfo.nodeVersion}, Platform: ${this.systemInfo.platform}\n`);

    const configurations = [
      { name: 'Fast (Unit)', command: 'npm run test:fast' },
      { name: 'Optimized', command: 'npm run test:optimized' },
      { name: 'Integration', command: 'npm run test:integration' },
      { name: 'Performance', command: 'npm run test:full' }
    ];

    for (const config of configurations) {
      await this.measureConfiguration(config.name, config.command);
      
      // Small delay between runs to let system settle
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  generateReport() {
    console.log('\n📈 Performance Analysis Report\n');
    console.log('=' .repeat(80));
    
    // Sort by tests per second (performance)
    const sortedResults = [...this.results]
      .filter(r => r.success)
      .sort((a, b) => b.testsPerSecond - a.testsPerSecond);
    
    if (sortedResults.length === 0) {
      console.log('❌ No successful test runs to analyze');
      return;
    }
    
    console.log('\n🏆 Performance Rankings (by tests/second):');
    sortedResults.forEach((result, index) => {
      const rank = index + 1;
      const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📊';
      console.log(`${emoji} #${rank}: ${result.configName}`);
      console.log(`   Duration: ${result.duration}ms | Tests: ${result.testCount} | Speed: ${result.testsPerSecond} tests/sec`);
    });
    
    // Performance improvements analysis
    const fastestConfig = sortedResults[0];
    const baselineConfig = sortedResults.find(r => r.configName === 'Fast (Unit)') || sortedResults[sortedResults.length - 1];
    
    if (fastestConfig && baselineConfig && fastestConfig !== baselineConfig) {
      const improvement = Math.round(((fastestConfig.testsPerSecond - baselineConfig.testsPerSecond) / baselineConfig.testsPerSecond) * 100);
      console.log(`\n⚡ Performance Improvement: ${fastestConfig.configName} is ${improvement}% faster than ${baselineConfig.configName}`);
    }
    
    // Recommendations
    this.generateRecommendations(sortedResults);
    
    // Save detailed results
    this.saveResults();
  }

  generateRecommendations(sortedResults) {
    console.log('\n💡 Optimization Recommendations:\n');
    
    const fastest = sortedResults[0];
    const slowest = sortedResults[sortedResults.length - 1];
    
    if (fastest && slowest) {
      const speedDifference = fastest.testsPerSecond - slowest.testsPerSecond;
      
      if (speedDifference > 50) {
        console.log(`🔧 Consider using "${fastest.configName}" configuration for development`);
        console.log(`   - ${speedDifference} more tests/second than "${slowest.configName}"`);
      }
    }
    
    // System-specific recommendations
    if (this.systemInfo.cpus >= 8) {
      console.log('🖥️  High-core system detected:');
      console.log('   - Consider maxWorkers: 6-7 for optimal parallelization');
      console.log('   - Use aggressive caching and memory settings');
    }
    
    if (this.systemInfo.totalMemory >= 16) {
      console.log('💾 High-memory system detected:');
      console.log('   - Consider workerIdleMemoryLimit: 1GB+');
      console.log('   - Enable heap monitoring for large test suites');
    }
    
    // Configuration-specific recommendations
    const unitTestResult = sortedResults.find(r => r.configName.includes('Unit') || r.configName.includes('Fast'));
    if (unitTestResult && unitTestResult.testsPerSecond < 200) {
      console.log('⚠️  Unit test performance below optimal:');
      console.log('   - Consider transpileOnly: true in ts-jest');
      console.log('   - Reduce testTimeout for fast tests');
      console.log('   - Disable unnecessary features (coverage, open handles detection)');
    }
  }

  saveResults() {
    const reportData = {
      systemInfo: this.systemInfo,
      results: this.results,
      summary: {
        totalConfigurations: this.results.length,
        successfulRuns: this.results.filter(r => r.success).length,
        bestConfiguration: this.results
          .filter(r => r.success)
          .sort((a, b) => b.testsPerSecond - a.testsPerSecond)[0]
      }
    };
    
    const reportPath = path.join(process.cwd(), 'jest-performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the performance monitor
async function main() {
  const monitor = new JestPerformanceMonitor();
  
  try {
    await monitor.measureAllConfigurations();
    monitor.generateReport();
  } catch (error) {
    console.error('❌ Performance monitoring failed:', error.message);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}

module.exports = JestPerformanceMonitor;