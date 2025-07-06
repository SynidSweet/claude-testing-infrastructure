import { EventEmitter } from 'events';
import chalk from 'chalk';
import type { Ora } from 'ora';
import ora from 'ora';

export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'warning';
  current?: number;
  total?: number;
  message?: string;
  file?: string;
  error?: Error;
}

export interface ProgressStats {
  startTime: number;
  filesProcessed: number;
  totalFiles: number;
  errors: number;
  warnings: number;
}

export class ProgressReporter extends EventEmitter {
  private stats: ProgressStats;
  private spinner: Ora | null = null;
  private verbose: boolean;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 100; // Update at most every 100ms

  constructor(verbose: boolean = false) {
    super();
    this.verbose = verbose;
    this.stats = {
      startTime: Date.now(),
      filesProcessed: 0,
      totalFiles: 0,
      errors: 0,
      warnings: 0,
    };
  }

  start(totalFiles: number, message: string = 'Starting test generation...'): void {
    this.stats.totalFiles = totalFiles;
    this.stats.startTime = Date.now();

    if (!this.verbose) {
      this.spinner = ora({
        text: message,
        spinner: 'dots',
      }).start();
    } else {
      console.log(chalk.blue(`\n${message}`));
      console.log(chalk.gray(`Total files to process: ${totalFiles}`));
    }

    this.emit('start', { type: 'start', total: totalFiles, message });
  }

  updateProgress(current: number, file?: string): void {
    this.stats.filesProcessed = current;

    // Throttle updates to avoid flickering
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval && current < this.stats.totalFiles) {
      return;
    }
    this.lastUpdateTime = now;

    const percentage = Math.round((current / this.stats.totalFiles) * 100);
    const elapsed = now - this.stats.startTime;
    const avgTimePerFile = elapsed / current;
    const remainingFiles = this.stats.totalFiles - current;
    const estimatedTimeRemaining = Math.round((avgTimePerFile * remainingFiles) / 1000);

    const progressMessage = `Generating tests... [${current}/${this.stats.totalFiles}] ${percentage}% - ETA: ${estimatedTimeRemaining}s`;

    if (!this.verbose && this.spinner) {
      this.spinner.text = progressMessage;
      if (file) {
        this.spinner.text += chalk.gray(` - ${this.getShortPath(file)}`);
      }
    } else {
      console.log(
        chalk.cyan(`[${current}/${this.stats.totalFiles}] ${percentage}%`) +
          (file ? chalk.gray(` - Processing: ${this.getShortPath(file)}`) : '')
      );
    }

    this.emit('progress', {
      type: 'progress',
      current,
      total: this.stats.totalFiles,
      file,
      message: progressMessage,
    });
  }

  reportError(error: Error | string, file?: string): void {
    this.stats.errors++;
    const errorMessage = error instanceof Error ? error.message : error;

    if (!this.verbose && this.spinner) {
      // Temporarily stop spinner to show error
      this.spinner.stop();
      console.log(
        chalk.red(`✗ Error${file ? ` in ${this.getShortPath(file)}` : ''}: ${errorMessage}`)
      );
      this.spinner.start();
    } else {
      console.log(
        chalk.red(`✗ Error${file ? ` in ${this.getShortPath(file)}` : ''}: ${errorMessage}`)
      );
    }

    this.emit('error', {
      type: 'error',
      error: error instanceof Error ? error : new Error(errorMessage),
      file,
      message: errorMessage,
    });
  }

  reportWarning(warning: string, file?: string): void {
    this.stats.warnings++;

    if (this.verbose) {
      console.log(
        chalk.yellow(`⚠️  Warning${file ? ` in ${this.getShortPath(file)}` : ''}: ${warning}`)
      );
    }

    this.emit('warning', {
      type: 'warning',
      message: warning,
      file,
    });
  }

  complete(success: boolean, message?: string): void {
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedSeconds = (elapsed / 1000).toFixed(1);

    if (!this.verbose && this.spinner) {
      if (success) {
        this.spinner.succeed(message || 'Test generation completed');
      } else {
        this.spinner.fail(message || 'Test generation failed');
      }
    } else {
      const icon = success ? '✓' : '✗';
      const color = success ? chalk.green : chalk.red;
      console.log(
        color(`\n${icon} ${message || 'Test generation ' + (success ? 'completed' : 'failed')}`)
      );
    }

    if (this.verbose || success) {
      console.log(chalk.cyan('\n📊 Generation Summary:'));
      console.log(`  • Files processed: ${this.stats.filesProcessed}/${this.stats.totalFiles}`);
      console.log(`  • Time elapsed: ${elapsedSeconds}s`);

      if (this.stats.errors > 0) {
        console.log(chalk.red(`  • Errors: ${this.stats.errors}`));
      }
      if (this.stats.warnings > 0) {
        console.log(chalk.yellow(`  • Warnings: ${this.stats.warnings}`));
      }
    }

    this.emit('complete', {
      type: 'complete',
      message: message || (success ? 'Completed' : 'Failed'),
      current: this.stats.filesProcessed,
      total: this.stats.totalFiles,
    });
  }

  private getShortPath(filePath: string): string {
    // Show only last 2-3 path segments for readability
    const parts = filePath.split(/[/\\]/);
    if (parts.length <= 3) {
      return filePath;
    }
    return '.../' + parts.slice(-3).join('/');
  }

  getStats(): ProgressStats {
    return { ...this.stats };
  }
}
