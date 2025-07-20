/**
 * MCP Cache Performance Monitor
 * 
 * Comprehensive performance monitoring and optimization tools for MCPCacheManager.
 * Provides cache effectiveness tracking, optimization recommendations, warmup strategies,
 * and health monitoring with alerting capabilities.
 * 
 * Implements TASK-2025-186: Add cache performance monitoring and optimization tools
 * 
 * @module mcp/services/MCPCachePerformanceMonitor
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../../utils/logger';
import { MCPCacheManager, CacheLayer } from './MCPCacheManager';

/**
 * Cache performance metrics for detailed monitoring
 */
export interface CachePerformanceMetrics {
  // Basic metrics
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryEfficiency: number;
  
  // Performance timing
  averageResponseTime: number;
  cacheLookupTime: number;
  cacheSetTime: number;
  
  // Trend analysis
  hitRateTrend: PerformanceTrend;
  responseTimeTrend: PerformanceTrend;
  memoryUsageTrend: PerformanceTrend;
  
  // Health indicators
  healthScore: number;
  status: 'optimal' | 'good' | 'degraded' | 'critical';
  
  // Recommendations
  recommendations: CacheRecommendation[];
}

/**
 * Performance trend analysis
 */
export interface PerformanceTrend {
  direction: 'improving' | 'stable' | 'degrading';
  percentage: number;
  significance: 'high' | 'medium' | 'low';
  lastUpdated: number;
}

/**
 * Cache optimization recommendation
 */
export interface CacheRecommendation {
  type: 'configuration' | 'usage' | 'architecture' | 'maintenance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionRequired: string;
  estimatedImprovement: string;
}

/**
 * Cache warmup configuration
 */
export interface CacheWarmupConfig {
  layers: CacheLayer[];
  commonOperations: WarmupOperation[];
  scheduleInterval?: number; // milliseconds
  batchSize: number;
  enabled: boolean;
}

/**
 * Warmup operation definition
 */
export interface WarmupOperation {
  layer: CacheLayer;
  keys: string[];
  priority: 'high' | 'medium' | 'low';
  dataGenerator: () => Promise<any>;
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlert {
  metric: string;
  threshold: number;
  condition: 'above' | 'below';
  severity: 'warning' | 'critical';
  enabled: boolean;
}

/**
 * Cache usage analytics data
 */
export interface CacheUsageAnalytics {
  mostAccessedKeys: Array<{ key: string; count: number; layer: CacheLayer }>;
  leastAccessedKeys: Array<{ key: string; count: number; layer: CacheLayer }>;
  layerEfficiency: Record<CacheLayer, number>;
  peakUsageTimes: Array<{ timestamp: number; usage: number }>;
  patternDetection: {
    sequentialAccess: boolean;
    burstPatterns: boolean;
    cyclic: boolean;
  };
}

/**
 * MCP Cache Performance Monitor
 * 
 * Provides comprehensive monitoring, analytics, and optimization for MCPCacheManager
 */
export class MCPCachePerformanceMonitor extends EventEmitter {
  private static instance: MCPCachePerformanceMonitor;
  private cacheManager: MCPCacheManager;
  private performanceHistory: Map<string, number[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private warmupConfig: CacheWarmupConfig;
  private alerts: PerformanceAlert[] = [];
  private analytics: CacheUsageAnalytics;
  
  // Performance tracking
  private operationTimings: Map<string, number[]> = new Map();

  private constructor() {
    super();
    this.cacheManager = MCPCacheManager.getInstance();
    this.warmupConfig = this.getDefaultWarmupConfig();
    this.analytics = this.initializeAnalytics();
    this.setupDefaultAlerts();
    this.startPerformanceMonitoring();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPCachePerformanceMonitor {
    if (!MCPCachePerformanceMonitor.instance) {
      MCPCachePerformanceMonitor.instance = new MCPCachePerformanceMonitor();
    }
    return MCPCachePerformanceMonitor.instance;
  }

  /**
   * Get comprehensive performance metrics for all cache layers
   */
  public async getPerformanceMetrics(): Promise<Record<CacheLayer, CachePerformanceMetrics>> {
    const allMetrics = this.cacheManager.getMetrics();
    const result: Record<CacheLayer, CachePerformanceMetrics> = {} as any;

    for (const [layerName, metrics] of Object.entries(allMetrics)) {
      const layer = layerName as CacheLayer;
      const performanceMetrics = await this.calculatePerformanceMetrics(layer, metrics);
      result[layer] = performanceMetrics;
    }

    return result;
  }

  /**
   * Get cache performance dashboard data
   */
  public async getPerformanceDashboard(): Promise<{
    overview: {
      totalHitRate: number;
      averageResponseTime: number;
      memoryEfficiency: number;
      alertsActive: number;
    };
    layerMetrics: Record<CacheLayer, CachePerformanceMetrics>;
    healthStatus: any;
    recentAlerts: Array<{ timestamp: number; message: string; severity: string }>;
    recommendations: CacheRecommendation[];
  }> {
    const layerMetrics = await this.getPerformanceMetrics();
    const healthStatus = this.cacheManager.getHealthStatus();

    // Calculate overview metrics
    const layers = Object.values(layerMetrics);
    const totalHitRate = layers.reduce((sum, m) => sum + m.hitRate, 0) / layers.length || 0;
    const averageResponseTime = layers.reduce((sum, m) => sum + m.averageResponseTime, 0) / layers.length || 0;
    const memoryEfficiency = layers.reduce((sum, m) => sum + m.memoryEfficiency, 0) / layers.length || 0;
    const alertsActive = this.alerts.filter(a => a.enabled).length;

    // Generate comprehensive recommendations
    const recommendations = await this.generateOptimizationRecommendations(layerMetrics);

    return {
      overview: {
        totalHitRate,
        averageResponseTime,
        memoryEfficiency,
        alertsActive
      },
      layerMetrics,
      healthStatus,
      recentAlerts: [], // Would be populated with real alert history
      recommendations
    };
  }

  /**
   * Execute cache warmup strategies
   */
  public async executeCacheWarmup(config?: Partial<CacheWarmupConfig>): Promise<{
    success: boolean;
    warmedKeys: number;
    duration: number;
    errors: string[];
  }> {
    const startTime = performance.now();
    const warmupConfig = { ...this.warmupConfig, ...config };
    let warmedKeys = 0;
    const errors: string[] = [];

    this.emit('warmup:started', { config: warmupConfig });

    try {
      for (const layer of warmupConfig.layers) {
        for (const operation of warmupConfig.commonOperations) {
          if (operation.layer !== layer) continue;

          try {
            // Execute warmup operation in batches
            const batches = this.createBatches(operation.keys, warmupConfig.batchSize);
            
            for (const batch of batches) {
              await this.warmupBatch(layer, batch, operation.dataGenerator);
              warmedKeys += batch.length;
              
              // Emit progress for monitoring
              this.emit('warmup:progress', {
                layer,
                completed: warmedKeys,
                total: operation.keys.length
              });
            }
          } catch (error) {
            const errorMessage = `Warmup failed for layer ${layer}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMessage);
            logger.warn('MCPCachePerformanceMonitor: Warmup error', { layer, error: errorMessage });
          }
        }
      }

      const duration = performance.now() - startTime;
      const result = {
        success: errors.length === 0,
        warmedKeys,
        duration,
        errors
      };

      this.emit('warmup:completed', result);
      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      const result = {
        success: false,
        warmedKeys,
        duration,
        errors
      };

      this.emit('warmup:failed', result);
      return result;
    }
  }

  /**
   * Get cache usage analytics and pattern detection
   */
  public async getCacheAnalytics(): Promise<CacheUsageAnalytics> {
    // Analyze cache usage patterns across all layers
    const allMetrics = this.cacheManager.getMetrics();
    
    // Would analyze access patterns, frequency, and timing
    // For now, return initialized analytics structure
    return {
      ...this.analytics,
      layerEfficiency: this.calculateLayerEfficiency(allMetrics),
      peakUsageTimes: this.identifyPeakUsageTimes(),
      patternDetection: this.detectUsagePatterns()
    };
  }

  /**
   * Generate optimization recommendations based on current performance
   */
  public async generateOptimizationRecommendations(
    metrics?: Record<CacheLayer, CachePerformanceMetrics>
  ): Promise<CacheRecommendation[]> {
    const performanceMetrics = metrics || await this.getPerformanceMetrics();
    const recommendations: CacheRecommendation[] = [];

    for (const [layer, layerMetrics] of Object.entries(performanceMetrics)) {
      // Hit rate recommendations
      if (layerMetrics.hitRate < 0.5) {
        recommendations.push({
          type: 'configuration',
          priority: 'high',
          title: `Improve ${layer} hit rate`,
          description: `Hit rate is ${(layerMetrics.hitRate * 100).toFixed(1)}%, below optimal threshold`,
          impact: 'Significant performance improvement expected',
          actionRequired: 'Increase cache size or adjust TTL settings',
          estimatedImprovement: '30-50% response time reduction'
        });
      }

      // Memory efficiency recommendations
      if (layerMetrics.memoryEfficiency < 0.7) {
        recommendations.push({
          type: 'configuration',
          priority: 'medium',
          title: `Optimize ${layer} memory usage`,
          description: `Memory efficiency is ${(layerMetrics.memoryEfficiency * 100).toFixed(1)}%`,
          impact: 'Reduced memory consumption and better performance',
          actionRequired: 'Review eviction policy or reduce cache size',
          estimatedImprovement: '15-25% memory reduction'
        });
      }

      // Response time recommendations
      if (layerMetrics.averageResponseTime > 100) {
        recommendations.push({
          type: 'architecture',
          priority: 'medium',
          title: `Reduce ${layer} response time`,
          description: `Average response time is ${layerMetrics.averageResponseTime.toFixed(1)}ms`,
          impact: 'Better user experience and system responsiveness',
          actionRequired: 'Implement cache warmup or pre-loading strategies',
          estimatedImprovement: '20-40% response time improvement'
        });
      }

      // Health score recommendations
      if (layerMetrics.healthScore < 0.8) {
        recommendations.push({
          type: 'maintenance',
          priority: layerMetrics.healthScore < 0.6 ? 'high' : 'medium',
          title: `Address ${layer} health issues`,
          description: `Health score is ${(layerMetrics.healthScore * 100).toFixed(1)}%`,
          impact: 'Prevent cache degradation and failures',
          actionRequired: 'Review cache configuration and usage patterns',
          estimatedImprovement: 'Improved reliability and performance stability'
        });
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });

    return recommendations;
  }

  /**
   * Configure performance alerts
   */
  public configureAlerts(alerts: PerformanceAlert[]): void {
    this.alerts = alerts;
    logger.info('MCPCachePerformanceMonitor: Performance alerts configured', {
      alertCount: alerts.length,
      enabled: alerts.filter(a => a.enabled).length
    });
  }

  /**
   * Start real-time performance monitoring
   */
  public startPerformanceMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCycle();
    }, intervalMs);

    logger.info('MCPCachePerformanceMonitor: Started performance monitoring', { intervalMs });
  }

  /**
   * Stop performance monitoring
   */
  public stopPerformanceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      delete this.monitoringInterval;
    }
    logger.info('MCPCachePerformanceMonitor: Stopped performance monitoring');
  }

  /**
   * Calculate performance metrics for a specific cache layer
   */
  private async calculatePerformanceMetrics(
    layer: CacheLayer, 
    basicMetrics: any
  ): Promise<CachePerformanceMetrics> {
    const totalRequests = basicMetrics.hits + basicMetrics.misses;
    const hitRate = totalRequests > 0 ? basicMetrics.hits / totalRequests : 0;
    const missRate = 1 - hitRate;
    
    // Calculate eviction rate
    const evictionRate = totalRequests > 0 ? basicMetrics.evictions / totalRequests : 0;
    
    // Memory efficiency calculation
    const memoryEfficiency = this.calculateMemoryEfficiency(basicMetrics);
    
    // Get performance timing data
    const averageResponseTime = this.getAverageResponseTime(layer);
    const cacheLookupTime = this.getCacheLookupTime(layer);
    const cacheSetTime = this.getCacheSetTime(layer);
    
    // Calculate trends
    const hitRateTrend = this.calculateTrend(`${layer}_hit_rate`, hitRate);
    const responseTimeTrend = this.calculateTrend(`${layer}_response_time`, averageResponseTime);
    const memoryUsageTrend = this.calculateTrend(`${layer}_memory_usage`, basicMetrics.memoryUsage);
    
    // Calculate health score
    const healthScore = this.calculateHealthScore(hitRate, memoryEfficiency, averageResponseTime, evictionRate);
    
    // Determine status
    const status = this.determineStatus(healthScore);
    
    // Generate recommendations
    const recommendations = await this.generateLayerRecommendations(layer, {
      hitRate,
      memoryEfficiency,
      averageResponseTime,
      healthScore
    });

    return {
      hitRate,
      missRate,
      evictionRate,
      memoryEfficiency,
      averageResponseTime,
      cacheLookupTime,
      cacheSetTime,
      hitRateTrend,
      responseTimeTrend,
      memoryUsageTrend,
      healthScore,
      status,
      recommendations
    };
  }

  /**
   * Calculate memory efficiency score
   */
  private calculateMemoryEfficiency(metrics: any): number {
    // Simple calculation based on entry count vs memory usage
    if (metrics.entryCount === 0) return 1.0;
    
    const avgEntrySize = metrics.memoryUsage / metrics.entryCount;
    const efficiency = Math.min(1.0, 1024 / avgEntrySize); // Assuming 1KB is optimal entry size
    
    return Math.max(0, efficiency);
  }

  /**
   * Get average response time for cache operations
   */
  private getAverageResponseTime(layer: CacheLayer): number {
    const timings = this.operationTimings.get(`${layer}_get`) || [];
    return timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
  }

  /**
   * Get cache lookup time
   */
  private getCacheLookupTime(layer: CacheLayer): number {
    const timings = this.operationTimings.get(`${layer}_lookup`) || [];
    return timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
  }

  /**
   * Get cache set time
   */
  private getCacheSetTime(layer: CacheLayer): number {
    const timings = this.operationTimings.get(`${layer}_set`) || [];
    return timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(metricKey: string, currentValue: number): PerformanceTrend {
    const history = this.performanceHistory.get(metricKey) || [];
    history.push(currentValue);
    
    // Keep only last 10 values
    if (history.length > 10) {
      history.shift();
    }
    
    this.performanceHistory.set(metricKey, history);

    if (history.length < 2) {
      return {
        direction: 'stable',
        percentage: 0,
        significance: 'low',
        lastUpdated: Date.now()
      };
    }

    const oldValue = history[0];
    if (oldValue === undefined || oldValue === 0) {
      return {
        direction: 'stable',
        percentage: 0,
        significance: 'low',
        lastUpdated: Date.now()
      };
    }
    const percentage = ((currentValue - oldValue) / oldValue) * 100;
    
    let direction: 'improving' | 'stable' | 'degrading' = 'stable';
    let significance: 'high' | 'medium' | 'low' = 'low';

    if (Math.abs(percentage) > 10) {
      significance = 'high';
      direction = percentage > 0 ? 'improving' : 'degrading';
    } else if (Math.abs(percentage) > 5) {
      significance = 'medium';
      direction = percentage > 0 ? 'improving' : 'degrading';
    }

    return {
      direction,
      percentage: Math.abs(percentage),
      significance,
      lastUpdated: Date.now()
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(
    hitRate: number,
    memoryEfficiency: number,
    responseTime: number,
    evictionRate: number
  ): number {
    // Weighted scoring
    const hitRateScore = hitRate * 0.4;
    const memoryScore = memoryEfficiency * 0.3;
    const responseTimeScore = Math.max(0, (100 - responseTime) / 100) * 0.2;
    const evictionScore = Math.max(0, (1 - evictionRate)) * 0.1;
    
    return Math.min(1.0, hitRateScore + memoryScore + responseTimeScore + evictionScore);
  }

  /**
   * Determine status from health score
   */
  private determineStatus(healthScore: number): 'optimal' | 'good' | 'degraded' | 'critical' {
    if (healthScore >= 0.9) return 'optimal';
    if (healthScore >= 0.75) return 'good';
    if (healthScore >= 0.5) return 'degraded';
    return 'critical';
  }

  /**
   * Generate layer-specific recommendations
   */
  private async generateLayerRecommendations(
    layer: CacheLayer,
    metrics: { hitRate: number; memoryEfficiency: number; averageResponseTime: number; healthScore: number }
  ): Promise<CacheRecommendation[]> {
    const recommendations: CacheRecommendation[] = [];

    // Quick wins for low hit rates
    if (metrics.hitRate < 0.6) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        title: 'Increase cache size',
        description: `${layer} hit rate is ${(metrics.hitRate * 100).toFixed(1)}%`,
        impact: 'Immediate performance improvement',
        actionRequired: 'Increase maxSize configuration',
        estimatedImprovement: '20-40% hit rate increase'
      });
    }

    return recommendations;
  }

  /**
   * Get default warmup configuration
   */
  private getDefaultWarmupConfig(): CacheWarmupConfig {
    return {
      layers: [
        CacheLayer.ProjectAnalysis,
        CacheLayer.TemplateCompilation,
        CacheLayer.Configuration
      ],
      commonOperations: [
        {
          layer: CacheLayer.ProjectAnalysis,
          keys: ['./src', './tests', './docs'],
          priority: 'high',
          dataGenerator: async () => ({ analysis: 'cached' })
        },
        {
          layer: CacheLayer.TemplateCompilation,
          keys: ['javascript-unit', 'typescript-unit', 'react-component'],
          priority: 'medium',
          dataGenerator: async () => ({ template: 'compiled' })
        }
      ],
      batchSize: 5,
      enabled: true
    };
  }

  /**
   * Initialize analytics structure
   */
  private initializeAnalytics(): CacheUsageAnalytics {
    return {
      mostAccessedKeys: [],
      leastAccessedKeys: [],
      layerEfficiency: {} as Record<CacheLayer, number>,
      peakUsageTimes: [],
      patternDetection: {
        sequentialAccess: false,
        burstPatterns: false,
        cyclic: false
      }
    };
  }

  /**
   * Setup default performance alerts
   */
  private setupDefaultAlerts(): void {
    this.alerts = [
      {
        metric: 'hit_rate',
        threshold: 0.5,
        condition: 'below',
        severity: 'warning',
        enabled: true
      },
      {
        metric: 'response_time',
        threshold: 200,
        condition: 'above',
        severity: 'warning',
        enabled: true
      },
      {
        metric: 'memory_efficiency',
        threshold: 0.3,
        condition: 'below',
        severity: 'critical',
        enabled: true
      }
    ];
  }

  /**
   * Perform monitoring cycle
   */
  private async performMonitoringCycle(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();
      
      // Check alerts
      await this.checkAlerts(metrics);
      
      // Update analytics
      this.analytics = await this.getCacheAnalytics();
      
      // Emit monitoring event
      this.emit('monitoring:cycle', {
        timestamp: Date.now(),
        metrics,
        analytics: this.analytics
      });
      
    } catch (error) {
      logger.error('MCPCachePerformanceMonitor: Monitoring cycle error', { error });
    }
  }

  /**
   * Check performance alerts
   */
  private async checkAlerts(metrics: Record<CacheLayer, CachePerformanceMetrics>): Promise<void> {
    for (const alert of this.alerts.filter(a => a.enabled)) {
      for (const [layer, layerMetrics] of Object.entries(metrics)) {
        const value = this.getMetricValue(layerMetrics, alert.metric);
        
        if (this.shouldTriggerAlert(value, alert)) {
          this.emit('alert:triggered', {
            layer,
            metric: alert.metric,
            value,
            threshold: alert.threshold,
            severity: alert.severity,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Get metric value by name
   */
  private getMetricValue(metrics: CachePerformanceMetrics, metricName: string): number {
    switch (metricName) {
      case 'hit_rate': return metrics.hitRate;
      case 'response_time': return metrics.averageResponseTime;
      case 'memory_efficiency': return metrics.memoryEfficiency;
      case 'health_score': return metrics.healthScore;
      default: return 0;
    }
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(value: number, alert: PerformanceAlert): boolean {
    if (alert.condition === 'above') {
      return value > alert.threshold;
    } else {
      return value < alert.threshold;
    }
  }

  /**
   * Create batches for warmup operations
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Warmup cache batch
   */
  private async warmupBatch(
    layer: CacheLayer,
    keys: string[],
    dataGenerator: () => Promise<any>
  ): Promise<void> {
    for (const key of keys) {
      try {
        const data = await dataGenerator();
        await this.cacheManager.set(layer, key, data);
      } catch (error) {
        logger.warn('MCPCachePerformanceMonitor: Warmup batch error', {
          layer,
          key,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Calculate layer efficiency
   */
  private calculateLayerEfficiency(allMetrics: Record<string, any>): Record<CacheLayer, number> {
    const efficiency: Record<CacheLayer, number> = {} as any;
    
    for (const [layerName, metrics] of Object.entries(allMetrics)) {
      const layer = layerName as CacheLayer;
      const totalRequests = metrics.hits + metrics.misses;
      efficiency[layer] = totalRequests > 0 ? metrics.hits / totalRequests : 0;
    }
    
    return efficiency;
  }

  /**
   * Identify peak usage times
   */
  private identifyPeakUsageTimes(): Array<{ timestamp: number; usage: number }> {
    // Would analyze historical usage data
    return [];
  }

  /**
   * Detect usage patterns
   */
  private detectUsagePatterns(): { sequentialAccess: boolean; burstPatterns: boolean; cyclic: boolean } {
    // Would analyze access patterns
    return {
      sequentialAccess: false,
      burstPatterns: false,
      cyclic: false
    };
  }
}

/**
 * Convenience functions for cache performance monitoring
 */

/**
 * Get performance monitor instance
 */
export function getCachePerformanceMonitor(): MCPCachePerformanceMonitor {
  return MCPCachePerformanceMonitor.getInstance();
}

/**
 * Execute cache warmup with default configuration
 */
export async function executeCacheWarmup(): Promise<any> {
  const monitor = MCPCachePerformanceMonitor.getInstance();
  return monitor.executeCacheWarmup();
}

/**
 * Get cache performance dashboard
 */
export async function getCachePerformanceDashboard(): Promise<any> {
  const monitor = MCPCachePerformanceMonitor.getInstance();
  return monitor.getPerformanceDashboard();
}

/**
 * Generate cache optimization recommendations
 */
export async function generateCacheRecommendations(): Promise<CacheRecommendation[]> {
  const monitor = MCPCachePerformanceMonitor.getInstance();
  return monitor.generateOptimizationRecommendations();
}