/**
 * Unit tests for ProcessHealthAnalyzer
 * 
 * Tests pure functions for health analysis without any timing dependencies
 */

import { describe, it, expect } from '@jest/globals';
import { 
  ProcessHealthAnalyzer,
  ProcessMetrics,
  HealthAnalysisConfig,
  OutputEntry 
} from '../../../src/ai/heartbeat/ProcessHealthAnalyzer';

describe('ProcessHealthAnalyzer', () => {
  const defaultConfig: HealthAnalysisConfig = {
    cpuThreshold: 80,
    memoryThresholdMB: 1000,
    minOutputRate: 0.1,
    maxSilenceDuration: 120000,
    maxErrorCount: 50,
    progressMarkerPatterns: ['analyzing', 'processing', '\\d+%'],
    minProgressMarkers: 1,
    analysisWindowMs: 60000
  };

  describe('analyzeHealth', () => {
    it('should return healthy status for normal metrics', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 50,
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 0,
        processRuntime: 60000,
        progressMarkers: 5
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.isHealthy).toBe(true);
      expect(status.shouldTerminate).toBe(false);
      expect(status.warnings).toHaveLength(0);
      expect(status.confidence).toBe(1.0);
      expect(status.reason).toBeUndefined();
    });

    it('should detect high CPU usage', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 90,
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 0,
        processRuntime: 60000,
        progressMarkers: 5
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.warnings).toContain('High CPU usage: 90.0%');
      expect(status.confidence).toBeLessThan(1.0);
    });

    it('should mark as unhealthy for excessive CPU', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 130, // 1.5x threshold
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 0,
        processRuntime: 60000,
        progressMarkers: 5
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.isHealthy).toBe(false);
      expect(status.reason).toContain('Excessive CPU usage');
    });

    it('should detect stuck process with no output', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 50,
        memoryMB: 500,
        outputRate: 0.05, // Below minimum
        lastOutputTime: Date.now() - 130000, // Over 2 minutes ago
        errorCount: 0,
        processRuntime: 180000,
        progressMarkers: 0 // No progress
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.isHealthy).toBe(false);
      expect(status.warnings).toContain('Low output rate: 0.05 lines/min');
      expect(status.reason).toContain('Process appears stuck');
    });

    it('should not mark as stuck if waiting for input', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 10,
        memoryMB: 200,
        outputRate: 0,
        lastOutputTime: Date.now() - 130000,
        errorCount: 0,
        processRuntime: 180000,
        progressMarkers: 0,
        isWaitingForInput: true
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.isHealthy).toBe(true);
      expect(status.warnings).toHaveLength(0);
    });

    it('should detect high error count', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 50,
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 60, // Above threshold
        processRuntime: 60000,
        progressMarkers: 5
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.isHealthy).toBe(false);
      expect(status.warnings).toContain('High error count: 60');
      expect(status.reason).toContain('Too many errors');
    });

    it('should recommend termination for multiple issues', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 130, // Excessive
        memoryMB: 1600, // Excessive
        outputRate: 0,
        lastOutputTime: Date.now() - 130000,
        errorCount: 60,
        processRuntime: 180000,
        progressMarkers: 0
      };

      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, defaultConfig);

      expect(status.isHealthy).toBe(false);
      expect(status.shouldTerminate).toBe(true);
      expect(status.confidence).toBeLessThan(0.5);
    });
  });

  describe('calculateOutputRate', () => {
    it('should calculate rate correctly', () => {
      const now = Date.now();
      const outputs: OutputEntry[] = [
        { timestamp: now - 30000, content: 'line 1', isError: false },
        { timestamp: now - 20000, content: 'line 2', isError: false },
        { timestamp: now - 10000, content: 'line 3', isError: false },
      ];

      const rate = ProcessHealthAnalyzer.calculateOutputRate(outputs, 60000);
      
      // 3 lines in 30 seconds = 6 lines per minute
      expect(rate).toBeCloseTo(6, 0);
    });

    it('should return 0 for empty outputs', () => {
      const rate = ProcessHealthAnalyzer.calculateOutputRate([], 60000);
      expect(rate).toBe(0);
    });

    it('should filter old outputs', () => {
      const now = Date.now();
      const outputs: OutputEntry[] = [
        { timestamp: now - 90000, content: 'old', isError: false }, // Too old
        { timestamp: now - 10000, content: 'recent', isError: false },
      ];

      const rate = ProcessHealthAnalyzer.calculateOutputRate(outputs, 60000);
      
      // Only 1 recent line in 10 seconds = 6 lines per minute
      expect(rate).toBeCloseTo(6, 0);
    });
  });

  describe('detectProgressMarkers', () => {
    it('should detect simple progress markers', () => {
      expect(ProcessHealthAnalyzer.detectProgressMarkers(
        'analyzing file...',
        ['analyzing', 'processing']
      )).toBe(true);

      expect(ProcessHealthAnalyzer.detectProgressMarkers(
        'Processing step 5',
        ['analyzing', 'processing']
      )).toBe(true);
    });

    it('should detect regex patterns', () => {
      expect(ProcessHealthAnalyzer.detectProgressMarkers(
        'Progress: 75%',
        ['\\d+%']
      )).toBe(true);

      expect(ProcessHealthAnalyzer.detectProgressMarkers(
        'Completed step 3/10',
        ['step \\d+']
      )).toBe(true);
    });

    it('should handle invalid regex gracefully', () => {
      expect(ProcessHealthAnalyzer.detectProgressMarkers(
        'test output',
        ['[invalid regex']
      )).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(ProcessHealthAnalyzer.detectProgressMarkers(
        'ANALYZING DATA',
        ['analyzing']
      )).toBe(true);
    });
  });

  describe('detectInputWait', () => {
    it('should detect common input wait patterns', () => {
      expect(ProcessHealthAnalyzer.detectInputWait('Waiting for input...')).toBe(true);
      expect(ProcessHealthAnalyzer.detectInputWait('Press Enter to continue')).toBe(true);
      expect(ProcessHealthAnalyzer.detectInputWait('Continue? (y/n)')).toBe(true);
      expect(ProcessHealthAnalyzer.detectInputWait('Do you want to proceed? [y/N]')).toBe(true);
      expect(ProcessHealthAnalyzer.detectInputWait('Please provide your API key:')).toBe(true);
    });

    it('should not detect false positives', () => {
      expect(ProcessHealthAnalyzer.detectInputWait('Processing data...')).toBe(false);
      expect(ProcessHealthAnalyzer.detectInputWait('Analyzing files...')).toBe(false);
    });
  });

  describe('analyzeErrorSeverity', () => {
    it('should count errors correctly', () => {
      const errors: OutputEntry[] = [
        { timestamp: Date.now(), content: 'Warning: something', isError: true },
        { timestamp: Date.now(), content: 'Error: failed', isError: true },
      ];

      const severity = ProcessHealthAnalyzer.analyzeErrorSeverity(errors);
      expect(severity.count).toBe(2);
      expect(severity.critical).toBe(false);
    });

    it('should detect critical errors', () => {
      const errors: OutputEntry[] = [
        { timestamp: Date.now(), content: 'Fatal error occurred', isError: true },
      ];

      const severity = ProcessHealthAnalyzer.analyzeErrorSeverity(errors);
      expect(severity.critical).toBe(true);
    });

    it('should detect other critical patterns', () => {
      const patterns = [
        'Segmentation fault',
        'Core dumped',
        'Out of memory',
        'PANIC: system failure',
        'CRITICAL: database corrupted',
        'EMERGENCY: shutting down'
      ];

      for (const pattern of patterns) {
        const errors: OutputEntry[] = [
          { timestamp: Date.now(), content: pattern, isError: true },
        ];
        const severity = ProcessHealthAnalyzer.analyzeErrorSeverity(errors);
        expect(severity.critical).toBe(true);
      }
    });
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for good data', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 50,
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 0,
        processRuntime: 60000,
        progressMarkers: 5
      };

      const confidence = ProcessHealthAnalyzer.calculateConfidence(metrics, 10);
      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should reduce confidence for limited data points', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 50,
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 0,
        processRuntime: 60000,
        progressMarkers: 0
      };

      const confidence1 = ProcessHealthAnalyzer.calculateConfidence(metrics, 2);
      const confidence2 = ProcessHealthAnalyzer.calculateConfidence(metrics, 10);
      
      expect(confidence1).toBeLessThan(confidence2);
      expect(confidence1).toBeCloseTo(0.7, 1);
    });

    it('should reduce confidence for very short runtime', () => {
      const metrics: ProcessMetrics = {
        cpuPercent: 50,
        memoryMB: 500,
        outputRate: 1.0,
        lastOutputTime: Date.now(),
        errorCount: 0,
        processRuntime: 3000, // Only 3 seconds
        progressMarkers: 0
      };

      const confidence = ProcessHealthAnalyzer.calculateConfidence(metrics, 10);
      expect(confidence).toBeLessThan(0.9);
    });
  });
});