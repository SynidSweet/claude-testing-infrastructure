"""Python math utilities for mixed project testing."""


def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b


def calculate_multiply(a, b):
    """Calculate the product of two numbers."""
    return a * b


def calculate_divide(a, b):
    """Calculate the division of two numbers."""
    if b == 0:
        raise ValueError("Division by zero")
    return a / b


def factorial(n):
    """Calculate factorial of a number."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)