#!/usr/bin/env node

/**
 * CI/CD Pipeline Success Validation Script
 * 
 * This script validates that all CI/CD checks pass on GitHub Actions
 * It's designed to be run as part of the final validation task
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function runCommand(command, description) {
  console.log(`${colors.blue}Running: ${description}${colors.reset}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('warning')) {
      console.error(`${colors.yellow}Warning: ${stderr}${colors.reset}`);
    }
    return { success: true, output: stdout };
  } catch (error) {
    console.error(`${colors.red}Failed: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function validateLocalBuild() {
  console.log(`\n${colors.blue}=== Local Build Validation ===${colors.reset}\n`);
  
  const checks = [
    { command: 'npm run build', description: 'TypeScript compilation' },
    { command: 'npm run lint', description: 'ESLint checks' },
    { command: 'npm run format:check', description: 'Prettier formatting' },
    { command: 'npm run type-safety:check', description: 'Type safety analysis' },
    { command: 'npm run test:unit', description: 'Unit tests' },
    { command: 'npm run test:integration', description: 'Integration tests' }
  ];
  
  const results = [];
  for (const check of checks) {
    const result = await runCommand(check.command, check.description);
    results.push({ ...check, ...result });
    
    if (!result.success) {
      console.log(`${colors.red}✗ ${check.description} failed${colors.reset}`);
      return { localValidation: false, results };
    } else {
      console.log(`${colors.green}✓ ${check.description} passed${colors.reset}`);
    }
  }
  
  return { localValidation: true, results };
}

async function checkGitHubWorkflow() {
  console.log(`\n${colors.blue}=== GitHub Actions Status ===${colors.reset}\n`);
  
  // Get current branch
  const { output: branch } = await runCommand('git branch --show-current', 'Get current branch');
  const currentBranch = branch.trim();
  
  // Get latest commit SHA
  const { output: sha } = await runCommand('git rev-parse HEAD', 'Get latest commit');
  const commitSha = sha.trim();
  
  console.log(`Branch: ${currentBranch}`);
  console.log(`Commit: ${commitSha}`);
  
  // Check GitHub workflow status using gh CLI
  const { success, output } = await runCommand(
    `gh run list --branch ${currentBranch} --limit 1 --json status,conclusion,headSha,name`,
    'Check GitHub Actions status'
  );
  
  if (!success) {
    console.log(`${colors.yellow}Could not fetch GitHub Actions status. Make sure 'gh' CLI is installed and authenticated.${colors.reset}`);
    return { githubValidation: false, reason: 'gh CLI not available' };
  }
  
  try {
    const runs = JSON.parse(output);
    if (runs.length === 0) {
      console.log(`${colors.yellow}No workflow runs found for branch ${currentBranch}${colors.reset}`);
      return { githubValidation: false, reason: 'No workflow runs found' };
    }
    
    const latestRun = runs[0];
    console.log(`\nLatest workflow: ${latestRun.name}`);
    console.log(`Status: ${latestRun.status}`);
    console.log(`Conclusion: ${latestRun.conclusion || 'In progress'}`);
    
    if (latestRun.headSha !== commitSha) {
      console.log(`${colors.yellow}Warning: Latest run is for a different commit${colors.reset}`);
    }
    
    if (latestRun.status === 'completed' && latestRun.conclusion === 'success') {
      console.log(`${colors.green}✓ GitHub Actions passed!${colors.reset}`);
      return { githubValidation: true, run: latestRun };
    } else if (latestRun.status === 'in_progress') {
      console.log(`${colors.yellow}⏳ Workflow still running...${colors.reset}`);
      return { githubValidation: false, reason: 'Workflow in progress', run: latestRun };
    } else {
      console.log(`${colors.red}✗ GitHub Actions failed${colors.reset}`);
      return { githubValidation: false, reason: 'Workflow failed', run: latestRun };
    }
  } catch (error) {
    console.error(`${colors.red}Error parsing GitHub Actions response: ${error.message}${colors.reset}`);
    return { githubValidation: false, reason: 'Parse error' };
  }
}

async function generateValidationReport(localResult, githubResult) {
  console.log(`\n${colors.blue}=== Validation Summary ===${colors.reset}\n`);
  
  const report = {
    timestamp: new Date().toISOString(),
    localValidation: localResult.localValidation,
    githubValidation: githubResult.githubValidation,
    details: {
      local: localResult.results,
      github: githubResult
    },
    overallSuccess: localResult.localValidation && githubResult.githubValidation
  };
  
  if (report.overallSuccess) {
    console.log(`${colors.green}✅ ALL VALIDATIONS PASSED!${colors.reset}`);
    console.log(`${colors.green}The project is ready for production with 100% test pass rate and successful CI/CD pipeline!${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ VALIDATION FAILED${colors.reset}`);
    
    if (!localResult.localValidation) {
      console.log(`${colors.red}Local validation failed. Fix the issues above before pushing.${colors.reset}`);
    }
    
    if (!githubResult.githubValidation) {
      console.log(`${colors.red}GitHub Actions validation failed: ${githubResult.reason}${colors.reset}`);
      
      if (githubResult.run) {
        console.log(`\n${colors.yellow}To view detailed logs:${colors.reset}`);
        console.log(`gh run view ${githubResult.run.databaseId} --log-failed`);
      }
    }
  }
  
  // Save report to file
  const fs = require('fs');
  fs.writeFileSync('ci-cd-validation-report.json', JSON.stringify(report, null, 2));
  console.log(`\n${colors.blue}Full report saved to: ci-cd-validation-report.json${colors.reset}`);
  
  return report;
}

async function main() {
  console.log(`${colors.blue}🚀 CI/CD Success Validation Script${colors.reset}`);
  console.log(`${colors.blue}===================================${colors.reset}\n`);
  
  // Run local validation
  const localResult = await validateLocalBuild();
  
  // Check GitHub Actions status
  const githubResult = await checkGitHubWorkflow();
  
  // Generate report
  const report = await generateValidationReport(localResult, githubResult);
  
  // Exit with appropriate code
  process.exit(report.overallSuccess ? 0 : 1);
}

// Run the validation
main().catch(error => {
  console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
  process.exit(1);
});