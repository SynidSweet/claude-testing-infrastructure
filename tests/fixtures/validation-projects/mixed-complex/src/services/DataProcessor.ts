// TypeScript data processing service
import _ from 'lodash';

export interface ProcessingOptions {
  sortBy?: string;
  filterBy?: (item: any) => boolean;
  transform?: (item: any) => any;
}

export interface DataInput {
  numbers: number[];
  strings?: string[];
  objects?: Record<string, any>[];
}

export interface ProcessedData {
  total: number;
  average: number;
  sorted: number[];
  metadata: {
    processedAt: Date;
    itemCount: number;
  };
}

export class DataProcessor {
  async processData(input: DataInput, options: ProcessingOptions = {}): Promise<ProcessedData> {
    const { numbers } = input;
    
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const total = _.sum(numbers);
    const average = _.mean(numbers);
    const sorted = _.sortBy(numbers);
    
    return {
      total,
      average,
      sorted,
      metadata: {
        processedAt: new Date(),
        itemCount: numbers.length
      }
    };
  }

  validateData(input: DataInput): boolean {
    return Array.isArray(input.numbers) && input.numbers.every(n => typeof n === 'number');
  }

  transformData<T, U>(data: T[], transformer: (item: T) => U): U[] {
    return data.map(transformer);
  }
}