// TypeScript main entry point for complex mixed project
import { DataProcessor } from './services/DataProcessor';
import { ApiService } from './services/ApiService';
import { calculateComplexSum } from './utils/math';

export interface AppConfig {
  apiUrl: string;
  maxRetries: number;
  timeout: number;
}

export class Application {
  private dataProcessor: DataProcessor;
  private apiService: ApiService;

  constructor(private config: AppConfig) {
    this.dataProcessor = new DataProcessor();
    this.apiService = new ApiService(config.apiUrl);
  }

  async run(): Promise<number> {
    const result = calculateComplexSum([1, 2, 3, 4, 5]);
    const processedData = await this.dataProcessor.processData({ numbers: [1, 2, 3] });
    
    console.log(`Complex sum: ${result}`);
    console.log(`Processed data: ${JSON.stringify(processedData)}`);
    
    return result;
  }
}

export function createApp(config: AppConfig): Application {
  return new Application(config);
}