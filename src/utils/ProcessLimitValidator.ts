import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface ProcessCount {
  claude: number;
  total: number;
  details: string[];
}

export class ProcessLimitValidator {
  private static readonly MAX_CLAUDE_PROCESSES = 5;
  private static readonly WARNING_THRESHOLD = 3;

  /**
   * Get the count of active Claude processes across the system
   */
  static getActiveClaudeProcessCount(): ProcessCount {
    const details: string[] = [];
    let claudeCount = 0;

    try {
      // Try Linux/macOS first
      if (process.platform !== 'win32') {
        try {
          // Use pgrep for more reliable process detection
          const pgrep = execSync('pgrep -f "claude|claude-cli" 2>/dev/null || true', {
            encoding: 'utf8',
          }).trim();
          
          if (pgrep) {
            const pids = pgrep.split('\n').filter(pid => pid);
            claudeCount = pids.length;
            
            // Get details for each process
            for (const pid of pids) {
              try {
                const cmd = execSync(`ps -p ${pid} -o comm= 2>/dev/null || true`, {
                  encoding: 'utf8'
                }).trim();
                if (cmd) {
                  details.push(`PID ${pid}: ${cmd}`);
                }
              } catch {
                // Process might have ended, ignore
              }
            }
          }
        } catch (error) {
          // Fallback to ps aux
          const ps = execSync('ps aux | grep -E "claude|claude-cli" | grep -v grep || true', {
            encoding: 'utf8',
          });
          
          const lines = ps.split('\n').filter(line => line.trim());
          claudeCount = lines.length;
          
          lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length > 10) {
              details.push(`PID ${parts[1]}: ${parts.slice(10).join(' ')}`);
            }
          });
        }
      } else {
        // Windows support (WSL or PowerShell)
        try {
          const wmic = execSync(
            'wmic process where "name like \'%claude%\'" get ProcessId,CommandLine /format:csv 2>nul || echo ""',
            { encoding: 'utf8' }
          );
          
          const lines = wmic.split('\n').filter(line => line.includes('claude'));
          claudeCount = lines.length;
          
          lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 3) {
              details.push(`PID ${parts[2]}: ${parts[1]}`);
            }
          });
        } catch {
          logger.warn('Unable to check Claude processes on Windows');
        }
      }
    } catch (error) {
      logger.warn('Failed to check active Claude processes:', error);
    }

    return {
      claude: claudeCount,
      total: claudeCount,
      details,
    };
  }

  /**
   * Validate if it's safe to spawn more Claude processes
   */
  static validateProcessLimit(requestedCount: number = 1): {
    allowed: boolean;
    current: number;
    max: number;
    message?: string;
  } {
    const processCount = this.getActiveClaudeProcessCount();
    const projected = processCount.claude + requestedCount;

    if (projected > this.MAX_CLAUDE_PROCESSES) {
      return {
        allowed: false,
        current: processCount.claude,
        max: this.MAX_CLAUDE_PROCESSES,
        message: `Cannot spawn ${requestedCount} more Claude process(es). Current: ${processCount.claude}, Max: ${this.MAX_CLAUDE_PROCESSES}`,
      };
    }

    if (projected > this.WARNING_THRESHOLD) {
      logger.warn(
        `⚠️  Approaching Claude process limit: ${projected}/${this.MAX_CLAUDE_PROCESSES} processes will be active`
      );
    }

    return {
      allowed: true,
      current: processCount.claude,
      max: this.MAX_CLAUDE_PROCESSES,
    };
  }

  /**
   * Wait for process count to drop below limit
   */
  static async waitForProcessSlot(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const validation = this.validateProcessLimit(1);
      if (validation.allowed) {
        return true;
      }
      
      logger.info(
        `Waiting for Claude process slot... (${validation.current}/${validation.max} active)`
      );
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return false;
  }

  /**
   * Get a human-readable process status
   */
  static getProcessStatus(): string {
    const count = this.getActiveClaudeProcessCount();
    const status = [
      `Claude processes: ${count.claude}/${this.MAX_CLAUDE_PROCESSES}`,
    ];
    
    if (count.details.length > 0) {
      status.push('Active processes:');
      count.details.forEach(detail => status.push(`  - ${detail}`));
    }
    
    return status.join('\n');
  }
}