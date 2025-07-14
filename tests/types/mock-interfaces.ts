/**
 * Mock interfaces for type-safe test utilities
 * Provides strongly typed mock objects for testing infrastructure
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

/**
 * Mock ChildProcess interface for process simulation in tests
 */
export interface MockChildProcess extends EventEmitter {
  pid: number;
  killed: boolean;
  exitCode: number | null;
  signalCode: string | null;
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter;
  stdio: [any, any, any, any?, any?];
  connected: boolean;
  spawnargs: string[];
  spawnfile: string;
  kill: jest.MockedFunction<(signal?: string | number) => boolean>;
  ref: jest.MockedFunction<() => void>;
  unref: jest.MockedFunction<() => void>;
  send?: jest.MockedFunction<(message: any, sendHandle?: any) => boolean>;
  disconnect?: jest.MockedFunction<() => void>;
  [Symbol.dispose]?: jest.MockedFunction<() => void>;
}

/**
 * Mock ProcessMonitor interface for process health monitoring
 */
export interface MockProcessMonitor {
  startMonitoring: jest.MockedFunction<(process: ChildProcess) => void>;
  stopMonitoring: jest.MockedFunction<(pid: number) => void>;
  getProcessHealth: jest.MockedFunction<(pid: number) => ProcessHealth>;
  isHealthy: jest.MockedFunction<(pid: number) => boolean>;
  getStatistics: jest.MockedFunction<() => ProcessMonitorStatistics>;
  getResourceUsage: jest.MockedFunction<(pid: number) => any>;
  getHealthMetrics: jest.MockedFunction<(pid: number) => Promise<any>>;
  stopAll: jest.MockedFunction<() => void>;
}

export interface ProcessHealth {
  pid: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  cpuUsage: number;
  memoryUsage: number;
  lastHeartbeat: Date;
}

export interface ProcessMonitorStatistics {
  totalProcesses: number;
  healthyProcesses: number;
  unhealthyProcesses: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
}

/**
 * Mock HeartbeatMonitor interface for heartbeat monitoring
 */
export interface MockHeartbeatMonitor {
  startHeartbeat: jest.MockedFunction<(pid: number, interval: number) => void>;
  stopHeartbeat: jest.MockedFunction<(pid: number) => void>;
  getLastHeartbeat: jest.MockedFunction<(pid: number) => Date | null>;
  isHeartbeatHealthy: jest.MockedFunction<(pid: number) => boolean>;
  getHeartbeatStatistics: jest.MockedFunction<() => HeartbeatStatistics>;
}

export interface HeartbeatStatistics {
  totalHeartbeats: number;
  missedHeartbeats: number;
  averageInterval: number;
  healthyProcesses: number;
}

/**
 * Mock Configuration Service interface
 */
export interface MockConfigurationService {
  loadConfiguration: jest.MockedFunction<(path?: string) => Promise<any>>;
  mergeConfigurations: jest.MockedFunction<(configs: any[]) => any>;
  validateConfiguration: jest.MockedFunction<(config: any) => ValidationResult>;
  getDefaultConfiguration: jest.MockedFunction<() => any>;
  saveConfiguration: jest.MockedFunction<(config: any, path: string) => Promise<void>>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value: any;
}

/**
 * Mock File System interface for file operations
 */
export interface MockFileSystem {
  readFile: jest.MockedFunction<(path: string) => Promise<string>>;
  writeFile: jest.MockedFunction<(path: string, content: string) => Promise<void>>;
  exists: jest.MockedFunction<(path: string) => Promise<boolean>>;
  mkdir: jest.MockedFunction<(path: string, options?: any) => Promise<void>>;
  readdir: jest.MockedFunction<(path: string) => Promise<string[]>>;
  stat: jest.MockedFunction<(path: string) => Promise<FileStats>>;
}

export interface FileStats {
  isFile: () => boolean;
  isDirectory: () => boolean;
  size: number;
  mtime: Date;
  ctime: Date;
}

/**
 * Mock Logger interface for logging operations
 */
export interface MockLogger {
  debug: jest.MockedFunction<(message: string, ...args: any[]) => void>;
  info: jest.MockedFunction<(message: string, ...args: any[]) => void>;
  warn: jest.MockedFunction<(message: string, ...args: any[]) => void>;
  error: jest.MockedFunction<(message: string, ...args: any[]) => void>;
  setLevel: jest.MockedFunction<(level: LogLevel) => void>;
  getLevel: jest.MockedFunction<() => LogLevel>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Mock Timer interface for time-related operations
 */
export interface MockTimer {
  setTimeout: jest.MockedFunction<(callback: () => void, delay: number) => NodeJS.Timeout>;
  clearTimeout: jest.MockedFunction<(timeout: NodeJS.Timeout) => void>;
  setInterval: jest.MockedFunction<(callback: () => void, interval: number) => NodeJS.Timeout>;
  clearInterval: jest.MockedFunction<(interval: NodeJS.Timeout) => void>;
  now: jest.MockedFunction<() => number>;
}

/**
 * Mock HTTP Response interface for network operations
 */
export interface MockHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  json: jest.MockedFunction<() => Promise<any>>;
  text: jest.MockedFunction<() => Promise<string>>;
  ok: boolean;
}

/**
 * Mock Stream interface for stream operations
 */
export interface MockStream extends EventEmitter {
  readable: boolean;
  writable: boolean;
  read: jest.MockedFunction<(size?: number) => any>;
  write: jest.MockedFunction<(chunk: any, encoding?: string) => boolean>;
  end: jest.MockedFunction<(chunk?: any, encoding?: string) => void>;
  pipe: jest.MockedFunction<(destination: any) => any>;
}

/**
 * Generic mock factory type for creating typed mocks
 */
export type MockFactory<T> = () => jest.Mocked<T>;

/**
 * Helper type for converting interface to mocked version
 */
export type Mockify<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? jest.MockedFunction<T[K]> 
    : T[K];
};