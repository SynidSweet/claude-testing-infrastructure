/**
 * File Watcher Utility
 *
 * Provides intelligent file watching capabilities for watch mode:
 * - Monitors project files for changes
 * - Filters out irrelevant changes (node_modules, etc.)
 * - Emits change events with file metadata
 * - Handles graceful shutdown
 */

import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import type { Stats } from 'fs';
import { logger } from './logger';

export interface FileChangeEvent {
  /** Type of change */
  type: 'add' | 'change' | 'unlink';
  /** Absolute path to changed file */
  filePath: string;
  /** Relative path from project root */
  relativePath: string;
  /** File extension */
  extension: string;
  /** Timestamp of change */
  timestamp: Date;
  /** File stats if available */
  stats?: {
    size: number;
    mtime: Date;
  };
}

export interface FileWatcherConfig {
  /** Project root path to watch */
  projectPath: string;
  /** File patterns to watch (defaults to common source patterns) */
  includePatterns?: string[];
  /** Patterns to ignore (extends default ignore list) */
  ignorePatterns?: string[];
  /** Whether to watch for file additions */
  watchAdditions?: boolean;
  /** Whether to watch for file deletions */
  watchDeletions?: boolean;
  /** Polling interval for environments that don't support native watching */
  pollingInterval?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Intelligent file watcher for development environments
 */
export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private readonly projectPath: string;
  private readonly config: Required<FileWatcherConfig>;
  private isWatching = false;

  constructor(config: FileWatcherConfig) {
    super();

    this.projectPath = path.resolve(config.projectPath);

    const defaultIncludePatterns = [
      '**/*.{js,jsx,ts,tsx,py,vue,svelte}', // Source files
      '**/package.json', // Dependencies
      '**/requirements.txt', // Python dependencies
      '**/pyproject.toml', // Python projects
      '**/*.json', // Config files
      '**/*.yaml', // Config files
      '**/*.yml', // Config files
    ];

    const defaultIgnorePatterns = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.claude-testing/**', // Our own output
      '**/*.test.{js,ts,jsx,tsx,py}', // Generated tests
      '**/*.spec.{js,ts,jsx,tsx,py}', // Generated tests
      '**/__pycache__/**', // Python cache
      '**/*.pyc', // Python compiled
      '**/.pytest_cache/**', // Pytest cache
      '**/jest.config.*', // Test configs
      '**/babel.config.*', // Build configs
      '**/webpack.config.*', // Build configs
      '**/tsconfig.json', // TS configs (usually don't need test regeneration)
    ];

    this.config = {
      projectPath: this.projectPath,
      includePatterns: config.includePatterns ?? defaultIncludePatterns,
      ignorePatterns: [...defaultIgnorePatterns, ...(config.ignorePatterns ?? [])],
      watchAdditions: config.watchAdditions ?? true,
      watchDeletions: config.watchDeletions ?? true,
      pollingInterval: config.pollingInterval ?? 1000,
      verbose: config.verbose ?? false,
    };

    this.setupEventHandlers();
  }

  /**
   * Start watching for file changes
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      throw new Error('FileWatcher is already watching');
    }

    logger.info('Starting file watcher', {
      projectPath: this.projectPath,
      includePatterns: this.config.includePatterns,
      ignorePatterns: this.config.ignorePatterns.slice(0, 5), // Log first 5 for brevity
    });

    try {
      this.watcher = watch(this.config.includePatterns, {
        cwd: this.projectPath,
        ignored: this.config.ignorePatterns,
        persistent: true,
        ignoreInitial: true, // Don't emit events for existing files
        followSymlinks: false,
        depth: 10, // Reasonable depth limit
        awaitWriteFinish: {
          stabilityThreshold: 100, // Wait 100ms for file writes to finish
          pollInterval: 50,
        },
        usePolling: process.platform === 'win32', // Use polling on Windows
        interval: this.config.pollingInterval,
      });

      // Set up event listeners
      this.watcher.on('add', (filePath, stats) => {
        if (this.config.watchAdditions) {
          this.handleFileChange('add', filePath, stats);
        }
      });

      this.watcher.on('change', (filePath, stats) => {
        this.handleFileChange('change', filePath, stats);
      });

      this.watcher.on('unlink', (filePath) => {
        if (this.config.watchDeletions) {
          this.handleFileChange('unlink', filePath);
        }
      });

      this.watcher.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('File watcher error', { error: errorMessage });
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      });

      this.watcher.on('ready', () => {
        this.isWatching = true;
        this.emit('ready');

        if (this.config.verbose) {
          logger.info('File watcher ready', {
            watchedPaths: this.watcher?.getWatched()
              ? Object.keys(this.watcher.getWatched()).length
              : 0,
          });
        }
      });

      // Wait for watcher to be ready
      await new Promise<void>((resolve, reject) => {
        this.watcher!.on('ready', resolve);
        this.watcher!.on('error', reject);

        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('File watcher startup timeout')), 10000);
      });
    } catch (error) {
      logger.error('Failed to start file watcher', { error });
      throw error;
    }
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    logger.info('Stopping file watcher');

    try {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping file watcher', { error });
      throw error;
    }
  }

  /**
   * Check if currently watching
   */
  get watching(): boolean {
    return this.isWatching;
  }

  /**
   * Get list of currently watched files
   */
  getWatchedFiles(): string[] {
    if (!this.watcher) {
      return [];
    }

    const watched = this.watcher.getWatched();
    const files: string[] = [];

    for (const [dir, fileList] of Object.entries(watched)) {
      for (const file of fileList) {
        files.push(path.join(dir, file));
      }
    }

    return files;
  }

  /**
   * Handle individual file change events
   */
  private handleFileChange(type: FileChangeEvent['type'], filePath: string, stats?: Stats): void {
    const absolutePath = path.resolve(this.projectPath, filePath);
    const relativePath = path.relative(this.projectPath, absolutePath);
    const extension = path.extname(filePath);

    const changeEvent: FileChangeEvent = {
      type,
      filePath: absolutePath,
      relativePath,
      extension,
      timestamp: new Date(),
      ...(stats && {
        stats: {
          size: stats.size,
          mtime: stats.mtime,
        },
      }),
    };

    if (this.config.verbose) {
      logger.debug('File change detected', {
        type,
        relativePath,
        extension,
        size: stats?.size,
      });
    }

    // Emit the change event
    this.emit('fileChange', changeEvent);

    // Emit type-specific events
    this.emit(type, changeEvent);
  }

  /**
   * Set up additional event handlers for cleanup
   */
  private setupEventHandlers(): void {
    // Graceful shutdown on process signals
    const cleanup = (): void => {
      if (this.isWatching) {
        this.stopWatching().catch((error: unknown) => {
          logger.error('Error during file watcher cleanup', { error });
        });
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}

/**
 * Type definitions for events - removing the problematic declare interface
 */
