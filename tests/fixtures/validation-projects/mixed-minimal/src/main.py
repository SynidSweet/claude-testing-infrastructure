"""Main Python entry point for mixed project testing."""

from math_utils import calculate_sum, factorial
from api_client import ApiClient


def main():
    """Main function demonstrating Python functionality."""
    result = calculate_sum(10, 20)
    print(f"Sum: {result}")
    
    fact_result = factorial(5)
    print(f"Factorial of 5: {fact_result}")
    
    client = ApiClient()
    # Note: This would fail in real usage due to mock URL
    # but demonstrates the structure for testing
    return result


if __name__ == "__main__":
    main()