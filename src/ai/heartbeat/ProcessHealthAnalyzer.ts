/**
 * Process Health Analyzer - Pure functions for analyzing process health
 *
 * This module contains no side effects, no timers, and no external dependencies.
 * All functions are pure and completely testable.
 */

export interface ProcessMetrics {
  cpuPercent: number;
  memoryMB: number;
  outputRate: number;
  lastOutputTime: number;
  errorCount: number;
  processRuntime: number;
  progressMarkers: number;
  isWaitingForInput?: boolean;
}

export interface HealthStatus {
  isHealthy: boolean;
  shouldTerminate: boolean;
  warnings: string[];
  confidence: number;
  reason?: string;
}

export interface HealthAnalysisConfig {
  cpuThreshold: number;
  memoryThresholdMB: number;
  minOutputRate: number;
  maxSilenceDuration: number;
  maxErrorCount: number;
  progressMarkerPatterns: string[];
  minProgressMarkers: number;
  analysisWindowMs: number;
}

export interface OutputEntry {
  timestamp: number;
  content: string;
  isError: boolean;
}

export class ProcessHealthAnalyzer {
  /**
   * Analyzes process health based on metrics
   * Pure function - no side effects
   */
  static analyzeHealth(metrics: ProcessMetrics, config: HealthAnalysisConfig): HealthStatus {
    const warnings: string[] = [];
    let unhealthyReasons: string[] = [];
    let confidence = 1.0;

    // CPU analysis
    if (metrics.cpuPercent > config.cpuThreshold) {
      warnings.push(`High CPU usage: ${metrics.cpuPercent.toFixed(1)}%`);
      confidence *= 0.95; // Slight confidence reduction for high CPU
      if (metrics.cpuPercent > config.cpuThreshold * 1.5) {
        unhealthyReasons.push('Excessive CPU usage');
        confidence *= 0.8;
      }
    }

    // Memory analysis
    if (metrics.memoryMB > config.memoryThresholdMB) {
      warnings.push(`High memory usage: ${metrics.memoryMB.toFixed(1)}MB`);
      if (metrics.memoryMB > config.memoryThresholdMB * 1.5) {
        unhealthyReasons.push('Excessive memory usage');
        confidence *= 0.8;
      }
    }

    // Output rate analysis
    if (!metrics.isWaitingForInput && metrics.outputRate < config.minOutputRate) {
      const timeSinceOutput = Date.now() - metrics.lastOutputTime;
      const isEarlyPhase = metrics.processRuntime < 60000; // First 60 seconds

      // Be more lenient during early phase - use shorter threshold
      const silenceThreshold = isEarlyPhase ? 30000 : config.maxSilenceDuration; // 30s for early, configured for later

      if (timeSinceOutput > silenceThreshold) {
        const warningMessage = isEarlyPhase
          ? `Low output rate: ${metrics.outputRate.toFixed(2)} lines/min (early phase)`
          : `Low output rate: ${metrics.outputRate.toFixed(2)} lines/min`;
        warnings.push(warningMessage);

        if (metrics.progressMarkers < config.minProgressMarkers && !isEarlyPhase) {
          unhealthyReasons.push('Process appears stuck (no output or progress)');
          confidence *= 0.6;
        }
      }
    }

    // Error count analysis
    if (metrics.errorCount > config.maxErrorCount) {
      warnings.push(`High error count: ${metrics.errorCount}`);
      unhealthyReasons.push('Too many errors');
      confidence *= 0.7;
    }

    // Progress marker analysis
    if (
      !metrics.isWaitingForInput &&
      metrics.processRuntime > 60000 &&
      metrics.progressMarkers === 0
    ) {
      warnings.push('No progress markers detected');
      confidence *= 0.9;
    }

    // Determine overall health
    const isHealthy = unhealthyReasons.length === 0;
    const shouldTerminate =
      unhealthyReasons.length > 1 || (unhealthyReasons.length === 1 && confidence < 0.5);

    const result: HealthStatus = {
      isHealthy,
      shouldTerminate,
      warnings,
      confidence,
    };

    if (unhealthyReasons.length > 0) {
      result.reason = unhealthyReasons.join('; ');
    }

    return result;
  }

  /**
   * Calculates output rate from output entries
   * Pure function - no side effects
   */
  static calculateOutputRate(outputs: OutputEntry[], windowMs: number): number {
    if (outputs.length === 0) return 0;

    const now = Date.now();
    const cutoff = now - windowMs;
    const recentOutputs = outputs.filter((o) => o.timestamp > cutoff);

    if (recentOutputs.length === 0) return 0;

    // Calculate rate per minute
    const timeSpan = Math.max(
      now - Math.min(...recentOutputs.map((o) => o.timestamp)),
      1000 // Minimum 1 second to avoid division by zero
    );

    return (recentOutputs.length / timeSpan) * 60000; // Convert to per minute
  }

  /**
   * Detects progress markers in output
   * Pure function - no side effects
   */
  static detectProgressMarkers(output: string, patterns: string[]): boolean {
    const lowerOutput = output.toLowerCase();

    return patterns.some((pattern) => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(output);
      } catch {
        // Fallback to simple string matching if regex is invalid
        return lowerOutput.includes(pattern.toLowerCase());
      }
    });
  }

  /**
   * Detects if process is waiting for input
   * Pure function - no side effects
   */
  static detectInputWait(
    output: string,
    patterns: string[] = [
      'waiting for input',
      'press enter',
      'continue\\?',
      'y/n',
      '\\[y/N\\]',
      'provide your',
      'enter your',
    ]
  ): boolean {
    const lowerOutput = output.toLowerCase();

    return patterns.some((pattern) => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(output);
      } catch {
        return lowerOutput.includes(pattern.toLowerCase());
      }
    });
  }

  /**
   * Analyzes error severity
   * Pure function - no side effects
   */
  static analyzeErrorSeverity(errors: OutputEntry[]): { count: number; critical: boolean } {
    const criticalPatterns = [
      'fatal',
      'critical',
      'emergency',
      'panic',
      'segmentation fault',
      'core dumped',
      'out of memory',
    ];

    let criticalFound = false;

    for (const error of errors) {
      const lowerContent = error.content.toLowerCase();
      if (criticalPatterns.some((p) => lowerContent.includes(p))) {
        criticalFound = true;
        break;
      }
    }

    return {
      count: errors.length,
      critical: criticalFound,
    };
  }

  /**
   * Calculates health confidence based on data quality
   * Pure function - no side effects
   */
  static calculateConfidence(metrics: ProcessMetrics, dataPoints: number): number {
    let confidence = 1.0;

    // Reduce confidence for limited data
    if (dataPoints < 3) {
      confidence *= 0.7;
    } else if (dataPoints < 5) {
      confidence *= 0.85;
    }

    // Reduce confidence for very short runtime
    if (metrics.processRuntime < 5000) {
      confidence *= 0.8;
    }

    // Increase confidence if we have progress markers
    if (metrics.progressMarkers > 0) {
      confidence = Math.min(confidence * 1.1, 1.0);
    }

    return confidence;
  }
}
