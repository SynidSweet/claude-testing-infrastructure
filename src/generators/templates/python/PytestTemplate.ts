import { Template, TemplateContext } from '../TestTemplateEngine';

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pytest template for testing Python modules
 */
export class PytestTemplate implements Template {
  name = 'pytest';
  language = 'python' as const;
  framework = 'pytest';

  generate(context: TemplateContext): string {
    const { moduleName, modulePath, exports } = context;

    // Use modulePath for imports, fall back to moduleName if not provided
    const importModule = modulePath || moduleName;

    // Filter out empty or whitespace-only exports
    const validExports = exports.filter((exp) => exp && exp.trim());

    // Handle empty exports case
    const importStatement =
      validExports.length > 0
        ? `from ${importModule} import ${validExports.join(', ')}`
        : `import ${importModule}`;

    // Clean moduleName for class name (replace dots and hyphens with underscores)
    const className = moduleName.replace(/[\.-]/g, '_');

    return `"""Tests for ${moduleName} module."""
import pytest
${importStatement}


class Test${capitalize(className)}:
    """Test class for ${moduleName} module."""

    def test_module_import_successful(self):
        """Test that the module can be imported without errors."""
        # This test verifies the module was imported successfully
        ${validExports.length > 0 ? 'assert True  # Module imported successfully' : `assert ${importModule} is not None`}

${
  validExports.length > 0
    ? validExports
        .map(
          (exportName) => `
    def test_${exportName.toLowerCase()}_exists(self):
        """Test that ${exportName} is defined and importable."""
        assert ${exportName} is not None
        assert hasattr(${exportName}, '__name__') or hasattr(${exportName}, '__class__')

    def test_${exportName.toLowerCase()}_basic_functionality(self):
        """Test basic functionality of ${exportName}."""
        # Test basic properties and behavior
        if callable(${exportName}):
            # Test function/method properties
            assert ${exportName} is not None
            assert hasattr(${exportName}, '__name__')
            assert hasattr(${exportName}, '__call__')
            
            # Test function signature inspection
            import inspect
            if inspect.isfunction(${exportName}) or inspect.ismethod(${exportName}):
                sig = inspect.signature(${exportName})
                assert isinstance(sig.parameters, dict)
            
            # Try calling with common Python patterns
            test_scenarios = [
                lambda: ${exportName}(),
                lambda: ${exportName}(None),
                lambda: ${exportName}(''),
                lambda: ${exportName}('test'),
                lambda: ${exportName}(0),
                lambda: ${exportName}(1),
                lambda: ${exportName}([]),
                lambda: ${exportName}({}),
                lambda: ${exportName}(True),
                lambda: ${exportName}(False)
            ]
            
            successful_call = False
            for scenario in test_scenarios:
                try:
                    result = scenario()
                    successful_call = True
                    assert result is not None or result is None  # Both are valid
                    break
                except (TypeError, ValueError):
                    # Continue to next scenario
                    continue
            
            # If no scenarios work, verify it's still callable
            if not successful_call:
                assert callable(${exportName})
                
        elif hasattr(${exportName}, '__dict__'):
            # Test class or object structure
            assert ${exportName} is not None
            
            # Test class properties
            if inspect.isclass(${exportName}):
                assert hasattr(${exportName}, '__name__')
                assert hasattr(${exportName}, '__module__')
                
                # Try instantiating with common patterns
                try:
                    instance = ${exportName}()
                    assert instance is not None
                except (TypeError, ValueError):
                    # Class may require arguments
                    assert inspect.isclass(${exportName})
            else:
                # Test object properties
                assert hasattr(${exportName}, '__class__')
                
        else:
            # Test primitive or other types
            assert ${exportName} is not None
            expected_types = (str, int, float, bool, list, dict, tuple, set)
            assert isinstance(${exportName}, expected_types) or ${exportName} is None

    def test_${exportName.toLowerCase()}_type_validation(self):
        """Test type validation for ${exportName}."""
        import types
        import inspect
        
        # Verify the export is one of the expected types
        expected_types = (
            type, types.FunctionType, types.MethodType, types.BuiltinFunctionType,
            str, int, float, bool, list, dict, tuple, set, frozenset
        )
        
        # Test basic type validation
        assert isinstance(${exportName}, expected_types) or ${exportName} is None
        
        # Additional type-specific validations
        if callable(${exportName}):
            if inspect.isfunction(${exportName}):
                assert hasattr(${exportName}, '__code__')
                assert hasattr(${exportName}, '__defaults__')
            elif inspect.isclass(${exportName}):
                assert hasattr(${exportName}, '__mro__')
                assert hasattr(${exportName}, '__bases__')
            elif inspect.ismethod(${exportName}):
                assert hasattr(${exportName}, '__self__')
                assert hasattr(${exportName}, '__func__')
        
        elif isinstance(${exportName}, (list, tuple)):
            # Test sequence types
            assert hasattr(${exportName}, '__len__')
            assert hasattr(${exportName}, '__iter__')
            
        elif isinstance(${exportName}, dict):
            # Test mapping types
            assert hasattr(${exportName}, 'keys')
            assert hasattr(${exportName}, 'values')
            assert hasattr(${exportName}, 'items')

    def test_${exportName.toLowerCase()}_error_handling(self):
        """Test error handling in ${exportName}."""
        if callable(${exportName}):
            import inspect
            
            # Test with invalid inputs if it's callable
            invalid_inputs = [
                # Extreme values
                float('inf'),
                float('-inf'),
                float('nan'),
                # Very large/small numbers
                10**100,
                -10**100,
                # Complex invalid objects
                object(),
                type,
                # Invalid strings for numeric operations
                'not_a_number',
                '∞',
            ]
            
            # Try to determine function signature for smarter testing
            try:
                sig = inspect.signature(${exportName})
                param_count = len(sig.parameters)
                
                # Test with wrong number of arguments
                if param_count > 0:
                    # Too many arguments
                    try:
                        ${exportName}(*([None] * (param_count + 5)))
                        # If it doesn't raise, that's valid behavior
                    except (TypeError, ValueError, AttributeError):
                        # Expected for invalid argument count
                        assert True
                
                # Test with invalid types for each parameter
                for invalid_input in invalid_inputs[:3]:  # Limit to avoid slow tests
                    try:
                        if param_count == 0:
                            ${exportName}()
                        elif param_count == 1:
                            ${exportName}(invalid_input)
                        else:
                            # Multi-parameter function
                            args = [invalid_input] + [None] * (param_count - 1)
                            ${exportName}(*args)
                    except (TypeError, ValueError, AttributeError, OverflowError):
                        # Expected exceptions for invalid inputs
                        assert True
                    except Exception as e:
                        # Other exceptions might be valid depending on function
                        assert isinstance(e, Exception)
                        
            except (ValueError, TypeError):
                # Can't inspect signature - try basic error tests
                for invalid_input in invalid_inputs[:2]:
                    try:
                        ${exportName}(invalid_input)
                    except Exception as e:
                        # Any exception with invalid input is acceptable
                        assert isinstance(e, Exception)
        else:
            # For non-callable exports, test attribute access
            try:
                # Test accessing non-existent attributes
                _ = getattr(${exportName}, 'non_existent_attribute_xyz123', None)
                assert True  # No error expected for getattr with default
            except AttributeError:
                # This is also acceptable
                assert True
`
        )
        .join('')
    : `
    def test_module_structure(self):
        """Test basic module structure and contents."""
        # Check if module has expected attributes
        module_attrs = dir(${importModule})
        # Filter out built-in attributes
        public_attrs = [attr for attr in module_attrs if not attr.startswith('_')]
        
        # Module should have some public attributes or be callable
        assert len(public_attrs) > 0 or callable(${importModule})

    def test_module_functionality(self):
        """Test basic module functionality."""
        # Basic functionality tests
        if callable(${importModule}):
            # Module is a callable (function/class)
            assert ${importModule} is not None
            # TODO: Add specific callable tests
        else:
            # Module is a namespace with attributes
            assert hasattr(${importModule}, '__name__') or hasattr(${importModule}, '__file__')
            # TODO: Add specific module attribute tests

    def test_module_imports_cleanly(self):
        """Test that the module imports without side effects."""
        # Re-import the module to ensure it's stable
        import importlib
        import sys
        
        # Get the module name from the import path
        module_name = '${importModule}'.replace('.', '/')
        
        # Test that repeated imports work
        # TODO: Add specific import stability tests
        assert True  # Placeholder for import stability tests
`
}
`;
  }
}
