"""Data processing service for complex mixed project."""

import statistics
import asyncio
from typing import List, Dict, Any
from datetime import datetime


class DataService:
    """Service for processing various types of data."""
    
    async def process_numbers(self, numbers: List[int]) -> Dict[str, Any]:
        """Process a list of numbers and return statistical information."""
        if not numbers:
            raise ValueError("Cannot process empty list")
        
        # Simulate async processing
        await asyncio.sleep(0.01)
        
        return {
            "count": len(numbers),
            "sum": sum(numbers),
            "mean": statistics.mean(numbers),
            "median": statistics.median(numbers),
            "std_dev": statistics.stdev(numbers) if len(numbers) > 1 else 0,
            "min": min(numbers),
            "max": max(numbers),
            "processed_at": datetime.now().isoformat()
        }
    
    async def calculate_fibonacci(self, n: int) -> int:
        """Calculate nth Fibonacci number."""
        if n < 0:
            raise ValueError("Fibonacci is not defined for negative numbers")
        if n == 0:
            return 0
        if n == 1:
            return 1
        
        # Simulate async computation
        await asyncio.sleep(0.001)
        
        a, b = 0, 1
        for _ in range(2, n + 1):
            a, b = b, a + b
        return b
    
    def validate_data_structure(self, data: Dict[str, Any]) -> bool:
        """Validate that data has required structure."""
        required_keys = ["numbers", "metadata"]
        return all(key in data for key in required_keys)
    
    async def batch_process(self, data_batches: List[List[int]]) -> List[Dict[str, Any]]:
        """Process multiple batches of data concurrently."""
        tasks = [self.process_numbers(batch) for batch in data_batches]
        return await asyncio.gather(*tasks)