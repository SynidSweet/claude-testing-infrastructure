/**
 * Factory for creating and managing FileDiscoveryService instances
 *
 * This factory implements the singleton pattern to ensure consistent service
 * instance usage across all components in the CLI application.
 */

import { FileDiscoveryServiceImpl } from './FileDiscoveryService';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import type { ConfigurationService } from '../config/ConfigurationService';

/**
 * Factory class for creating FileDiscoveryService instances
 */
export class FileDiscoveryServiceFactory {
  private static instance: FileDiscoveryService | null = null;

  /**
   * Create or return existing FileDiscoveryService instance
   *
   * @param configService Configuration service for FileDiscoveryService
   * @returns FileDiscoveryService instance
   */
  static create(configService: ConfigurationService): FileDiscoveryService {
    if (!this.instance) {
      this.instance = new FileDiscoveryServiceImpl(configService);
    }
    return this.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Get current instance without creating new one
   *
   * @returns Current FileDiscoveryService instance or null if not created
   */
  static getInstance(): FileDiscoveryService | null {
    return this.instance;
  }

  /**
   * Check if instance is currently active
   *
   * @returns True if instance exists
   */
  static hasInstance(): boolean {
    return this.instance !== null;
  }
}
