#!/usr/bin/env python3
"""
claude_test_generator.py - Python module for automated test generation using Claude Code CLI

This module demonstrates how to integrate Claude Code into Python applications
for automated test generation.
"""

import json
import subprocess
import os
import sys
import glob
import argparse
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import time


class ClaudeTestGenerator:
    """Generate tests automatically using Claude Code CLI."""
    
    def __init__(self, framework: str = "pytest", verbose: bool = False):
        """
        Initialize the test generator.
        
        Args:
            framework: Testing framework to use (pytest, unittest, etc.)
            verbose: Enable verbose output
        """
        self.framework = framework
        self.verbose = verbose
        self._check_claude_installed()
    
    def _check_claude_installed(self) -> None:
        """Check if Claude CLI is installed."""
        try:
            subprocess.run(["claude", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise RuntimeError(
                "Claude Code CLI is not installed. "
                "Install it with: npm install -g @anthropic-ai/claude-code"
            )
    
    def generate_tests_for_file(
        self, 
        file_path: str, 
        requirements: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Generate tests for a single Python file.
        
        Args:
            file_path: Path to the source file
            requirements: Additional requirements for test generation
        
        Returns:
            Dictionary containing generation results
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {
                "success": False,
                "source_path": str(file_path),
                "error": f"File not found: {file_path}"
            }
        
        # Read the source code
        try:
            source_code = file_path.read_text()
        except Exception as e:
            return {
                "success": False,
                "source_path": str(file_path),
                "error": f"Failed to read file: {e}"
            }
        
        # Build the prompt
        prompt = self._build_prompt(source_code, file_path.name, requirements)
        
        # Execute Claude command
        try:
            result = self._execute_claude_command(prompt)
            
            # Parse the result
            parsed = self._parse_result(result)
            
            # Save the test file
            test_path = self._save_test_file(file_path, parsed["test_code"])
            
            return {
                "success": True,
                "source_path": str(file_path),
                "test_path": str(test_path),
                "test_code": parsed["test_code"],
                "session_id": parsed.get("session_id"),
                "cost": parsed.get("cost"),
                "duration_ms": parsed.get("duration")
            }
            
        except Exception as e:
            return {
                "success": False,
                "source_path": str(file_path),
                "error": str(e)
            }
    
    def generate_tests_for_directory(
        self, 
        directory: str, 
        pattern: str = "*.py",
        exclude_patterns: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Generate tests for all Python files in a directory.
        
        Args:
            directory: Directory path
            pattern: File pattern to match
            exclude_patterns: Patterns to exclude
        
        Returns:
            Summary of generation results
        """
        directory = Path(directory)
        
        if not directory.is_dir():
            raise ValueError(f"Not a directory: {directory}")
        
        # Default exclusions
        if exclude_patterns is None:
            exclude_patterns = [
                "*test*.py",
                "__pycache__",
                ".*",
                "venv",
                "env",
                ".env"
            ]
        
        # Find all Python files
        files = []
        for file_path in directory.rglob(pattern):
            # Check exclusions
            excluded = False
            for exc_pattern in exclude_patterns:
                if file_path.match(exc_pattern):
                    excluded = True
                    break
            
            if not excluded and file_path.is_file():
                files.append(file_path)
        
        print(f"Found {len(files)} files to process")
        
        # Process files
        results = []
        for i, file_path in enumerate(files):
            print(f"[{i+1}/{len(files)}] Processing: {file_path}")
            
            result = self.generate_tests_for_file(str(file_path))
            results.append(result)
            
            # Add delay to avoid rate limiting
            if i < len(files) - 1:
                time.sleep(1)
        
        # Generate summary
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        total_cost = sum(r.get("cost", 0) for r in successful if r.get("cost"))
        
        return {
            "total": len(results),
            "successful": len(successful),
            "failed": len(failed),
            "total_cost": total_cost,
            "results": results
        }
    
    def _build_prompt(
        self, 
        code: str, 
        filename: str, 
        requirements: Optional[List[str]] = None
    ) -> str:
        """Build the prompt for Claude."""
        if requirements is None:
            requirements = [
                f"Use {self.framework} testing framework",
                "Include unit tests for all functions and classes",
                "Add tests for edge cases and error conditions",
                "Use fixtures for setup and teardown",
                "Include parametrized tests where appropriate",
                "Add docstrings to test functions",
                "Use descriptive test names following test_<function>_<scenario> pattern",
                "Mock external dependencies",
                "Test both positive and negative cases"
            ]
        
        prompt = f"""Generate comprehensive tests for the following Python file named "{filename}".

Requirements:
{chr(10).join(f'- {req}' for req in requirements)}

Code to test:
```python
{code}
```

Generate only the test code, no explanations. The test code should be complete and ready to run."""
        
        return prompt
    
    def _execute_claude_command(self, prompt: str) -> str:
        """Execute Claude CLI command."""
        # Escape the prompt for shell
        escaped_prompt = prompt.replace('"', '\\"').replace("$", "\\$")
        
        cmd = [
            "claude", "-p", escaped_prompt,
            "--output-format", "json"
        ]
        
        if self.verbose:
            print("Executing Claude command...")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        if result.stderr and self.verbose:
            print(f"Claude stderr: {result.stderr}")
        
        return result.stdout
    
    def _parse_result(self, result: str) -> Dict[str, any]:
        """Parse Claude's JSON response."""
        try:
            data = json.loads(result)
            return {
                "test_code": data["result"],
                "session_id": data.get("session_id"),
                "cost": data.get("total_cost_usd"),
                "duration": data.get("duration_ms")
            }
        except json.JSONDecodeError:
            # Fallback to plain text if JSON parsing fails
            return {"test_code": result}
    
    def _save_test_file(self, source_path: Path, test_code: str) -> Path:
        """Save the generated test file."""
        # Determine test file path
        if source_path.stem.startswith("test_"):
            # Already a test file name pattern
            test_name = source_path.name
        else:
            test_name = f"test_{source_path.name}"
        
        test_path = source_path.parent / test_name
        
        # Write the test file
        test_path.write_text(test_code)
        
        return test_path
    
    def generate_coverage_report(self, directory: str) -> Dict[str, any]:
        """
        Generate a test coverage report for a directory.
        
        Args:
            directory: Directory to analyze
        
        Returns:
            Coverage report dictionary
        """
        directory = Path(directory)
        
        # Find all Python files
        all_files = list(directory.rglob("*.py"))
        
        # Filter out test files and special files
        source_files = [
            f for f in all_files
            if not any(part in f.parts for part in ["__pycache__", "venv", "env", ".env"])
            and not f.name.startswith("test_")
            and not f.name.endswith("_test.py")
            and not f.name.startswith(".")
        ]
        
        # Check which files have tests
        files_with_tests = []
        files_without_tests = []
        
        for source_file in source_files:
            test_file = source_file.parent / f"test_{source_file.name}"
            alt_test_file = source_file.parent / source_file.stem / "_test.py"
            
            if test_file.exists() or alt_test_file.exists():
                files_with_tests.append(str(source_file))
            else:
                files_without_tests.append(str(source_file))
        
        total = len(source_files)
        coverage = (len(files_with_tests) / total * 100) if total > 0 else 0
        
        return {
            "total_files": total,
            "files_with_tests": len(files_with_tests),
            "files_without_tests": len(files_without_tests),
            "coverage_percentage": coverage,
            "missing_tests": files_without_tests
        }


def main():
    """CLI interface for the test generator."""
    parser = argparse.ArgumentParser(
        description="Generate tests using Claude Code CLI"
    )
    parser.add_argument(
        "path",
        help="File or directory to generate tests for"
    )
    parser.add_argument(
        "--framework",
        default="pytest",
        help="Testing framework to use (default: pytest)"
    )
    parser.add_argument(
        "--pattern",
        default="*.py",
        help="File pattern to match (default: *.py)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Generate coverage report only"
    )
    
    args = parser.parse_args()
    
    # Create generator
    generator = ClaudeTestGenerator(
        framework=args.framework,
        verbose=args.verbose
    )
    
    try:
        path = Path(args.path)
        
        if args.coverage:
            # Generate coverage report
            report = generator.generate_coverage_report(args.path)
            
            print("\nTest Coverage Report:")
            print(f"Total files: {report['total_files']}")
            print(f"Files with tests: {report['files_with_tests']}")
            print(f"Files without tests: {report['files_without_tests']}")
            print(f"Coverage: {report['coverage_percentage']:.2f}%")
            
            if report['missing_tests']:
                print("\nFiles missing tests:")
                for file in report['missing_tests']:
                    print(f"  - {file}")
        
        elif path.is_file():
            # Generate tests for single file
            result = generator.generate_tests_for_file(args.path)
            
            if result["success"]:
                print("\n✓ Test generated successfully")
                print(f"  Source: {result['source_path']}")
                print(f"  Test: {result['test_path']}")
                if result.get("cost"):
                    print(f"  Cost: ${result['cost']:.4f}")
            else:
                print("\n✗ Failed to generate test")
                print(f"  Error: {result['error']}")
                sys.exit(1)
        
        elif path.is_dir():
            # Generate tests for directory
            summary = generator.generate_tests_for_directory(
                args.path,
                pattern=args.pattern
            )
            
            print("\n=== Test Generation Summary ===")
            print(f"Total files processed: {summary['total']}")
            print(f"Successful: {summary['successful']}")
            print(f"Failed: {summary['failed']}")
            print(f"Total cost: ${summary['total_cost']:.4f}")
            
            if summary['failed'] > 0:
                print("\nFailed files:")
                for result in summary['results']:
                    if not result['success']:
                        print(f"  - {result['source_path']}: {result['error']}")
        
        else:
            print(f"Error: {args.path} is neither a file nor a directory")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()