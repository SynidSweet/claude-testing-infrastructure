import { Template, TemplateContext } from '../TestTemplateEngine';
import { TestType } from '../../TestGenerator';

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pytest Django template for testing Django views and endpoints
 */
export class PytestDjangoTemplate implements Template {
  name = 'pytest-django';
  language = 'python' as const;
  framework = 'django';
  testType = TestType.API;

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

    return `"""Tests for ${moduleName} Django views."""
import pytest
from django.test import Client
from django.urls import reverse
${importStatement}


@pytest.mark.django_db
class Test${capitalize(moduleName)}Views:
    """Test class for ${moduleName} Django views."""

    def setup_method(self):
        """Set up test fixtures."""
        self.client = Client()
        # TODO: Create test data

${validExports
  .map(
    (exportName) => `
    def test_${exportName.toLowerCase()}_get_success(self):
        """Test successful GET request for ${exportName}."""
        url = reverse('${exportName.toLowerCase()}')  # TODO: Update URL name
        response = self.client.get(url)
        assert response.status_code == 200

    def test_${exportName.toLowerCase()}_post_success(self):
        """Test successful POST request for ${exportName}."""
        url = reverse('${exportName.toLowerCase()}')  # TODO: Update URL name
        data = {}  # TODO: Add test data
        response = self.client.post(url, data)
        assert response.status_code in [200, 201, 302]

    def test_${exportName.toLowerCase()}_authentication_required(self):
        """Test authentication requirement for ${exportName}."""
        # Test unauthenticated access
        url = reverse('${exportName.toLowerCase()}')
        response = self.client.get(url)
        assert response.status_code == 401, "Should require authentication"
        
        # Test with authentication
        self.client.force_authenticate(user=self.user)  # Django REST framework
        response = self.client.get(url)
        assert response.status_code == 200, "Should allow authenticated access"

    def test_${exportName.toLowerCase()}_permissions(self):
        """Test permissions for ${exportName}."""
        # Test with user without permission
        url = reverse('${exportName.toLowerCase()}')
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        assert response.status_code == 403, "Should deny access without permission"
        
        # Test with user with permission
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        assert response.status_code == 200, "Should allow access with permission"
`
  )
  .join('')}
`;
  }
}
