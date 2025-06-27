# Testing Methodology for AI Agents

🤖 **This guide provides systematic testing approaches optimized for AI agent implementation**.

## 1. Test-First Development Cycle

### The Red-Green-Refactor Cycle

**ALWAYS follow this sequence when developing features:**

#### Step 1: RED - Write a Failing Test
```bash
# 1. Create a test file first
touch src/components/__tests__/NewComponent.test.jsx
# OR for Python
touch tests/test_new_feature.py

# 2. Write a test that describes the expected behavior
# 3. Run the test - it should FAIL
npm test NewComponent.test.jsx
# OR for Python
pytest tests/test_new_feature.py -v
```

#### Step 2: GREEN - Write Minimal Code to Pass
```bash
# 1. Create the component/function/module
# 2. Write the MINIMUM code needed to make the test pass
# 3. Run the test - it should PASS
npm test NewComponent.test.jsx
# OR
pytest tests/test_new_feature.py -v
```

#### Step 3: REFACTOR - Improve Code Quality
```bash
# 1. Improve the code while keeping tests green
# 2. Run tests after each change
npm test
# OR
pytest
```

### Example TDD Workflow

#### JavaScript/React Example:
```javascript
// 1. RED: Write failing test first
// src/components/__tests__/Button.test.jsx
import { render, screen } from '@testing-library/react';
import Button from '../Button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
});

// 2. GREEN: Create minimal component
// src/components/Button.jsx
export default function Button({ children }) {
  return <button>{children}</button>;
}

// 3. REFACTOR: Add features while keeping tests green
```

#### Python Example:
```python
# 1. RED: Write failing test first
# tests/test_user_service.py
def test_create_user_returns_user_with_id():
    user_data = {"email": "test@example.com", "name": "Test User"}
    user = UserService.create_user(user_data)
    
    assert user.id is not None
    assert user.email == "test@example.com"

# 2. GREEN: Create minimal implementation
# src/services/user_service.py
class UserService:
    @staticmethod
    def create_user(user_data):
        user = User(**user_data)
        user.id = generate_id()
        return user

# 3. REFACTOR: Add validation, database saving, etc.
```

## 2. Test Categories and When to Use

### Unit Tests (70% of your tests)

**When to write**: For individual functions, classes, or components in isolation.

**Characteristics**:
- Fast execution (< 10ms each)
- No external dependencies
- Test one specific behavior
- Easy to debug when they fail

#### JavaScript Unit Test Patterns:
```javascript
// Test pure functions
test('calculateTotal should sum prices correctly', () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});

// Test React components
test('UserCard displays user information', () => {
  const user = { name: 'John Doe', email: 'john@example.com' };
  render(<UserCard user={user} />);
  
  expect(screen.getByText('John Doe')).toBeInTheDocument();
  expect(screen.getByText('john@example.com')).toBeInTheDocument();
});

// Test async functions
test('fetchUser returns user data', async () => {
  const mockUser = { id: 1, name: 'John' };
  jest.spyOn(api, 'get').mockResolvedValue(mockUser);
  
  const user = await fetchUser(1);
  expect(user).toEqual(mockUser);
});
```

#### Python Unit Test Patterns:
```python
# Test pure functions
def test_calculate_total():
    items = [{"price": 10}, {"price": 20}]
    result = calculate_total(items)
    assert result == 30

# Test classes
def test_user_creation():
    user = User("john@example.com", "John Doe")
    assert user.email == "john@example.com"
    assert user.name == "John Doe"

# Test with mocks
@patch('src.services.EmailService.send_email')
def test_user_registration_sends_welcome_email(mock_send_email):
    mock_send_email.return_value = True
    
    result = UserService.register_user("john@example.com", "password")
    
    assert result.success is True
    mock_send_email.assert_called_once()
```

### Integration Tests (20% of your tests)

**When to write**: For testing how multiple components work together.

**Characteristics**:
- Moderate execution time (< 1s each)
- May use database, file system, or external services
- Test workflows and data flow
- Test API endpoints

#### JavaScript Integration Test Patterns:
```javascript
// API endpoint testing
test('POST /users creates user and returns 201', async () => {
  const userData = { email: 'test@example.com', name: 'Test User' };
  
  const response = await request(app)
    .post('/api/users')
    .send(userData)
    .expect(201);
    
  expect(response.body.email).toBe(userData.email);
  expect(response.body.id).toBeDefined();
});

// Database integration
test('UserRepository saves and retrieves user correctly', async () => {
  const userData = { email: 'test@example.com', name: 'Test User' };
  
  const savedUser = await UserRepository.create(userData);
  const retrievedUser = await UserRepository.findById(savedUser.id);
  
  expect(retrievedUser.email).toBe(userData.email);
});
```

#### Python Integration Test Patterns:
```python
# API endpoint testing
def test_create_user_endpoint(client, sample_user_data):
    response = client.post('/users/', json=sample_user_data)
    
    assert response.status_code == 201
    assert response.json()['email'] == sample_user_data['email']

# Database integration
@pytest.mark.integration
def test_user_crud_operations(db_session):
    # Create
    user = User(email="test@example.com", name="Test User")
    db_session.add(user)
    db_session.commit()
    
    # Read
    retrieved = db_session.query(User).filter_by(email="test@example.com").first()
    assert retrieved is not None
    
    # Update
    retrieved.name = "Updated Name"
    db_session.commit()
    
    # Delete
    db_session.delete(retrieved)
    db_session.commit()
```

### End-to-End (E2E) Tests (10% of your tests)

**When to write**: For testing complete user workflows from start to finish.

**Characteristics**:
- Slow execution (5-30s each)
- Use real browser/full application stack
- Test critical business flows
- Catch integration issues

#### E2E Test Patterns:
```javascript
// Playwright E2E test
test('user can register, login, and view dashboard', async ({ page }) => {
  // Registration
  await page.goto('/register');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="register-button"]');
  
  // Login
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');
  
  // Dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Welcome');
});
```

## 3. Code Patterns for Testability

### ✅ GOOD: Testable Code Patterns

#### Pure Functions
```javascript
// Easy to test - no side effects
export function calculateTax(price, taxRate) {
  return price * taxRate;
}

// Test
test('calculateTax returns correct amount', () => {
  expect(calculateTax(100, 0.1)).toBe(10);
});
```

#### Dependency Injection
```javascript
// Testable - dependencies can be mocked
export class UserService {
  constructor(userRepository, emailService) {
    this.userRepository = userRepository;
    this.emailService = emailService;
  }
  
  async createUser(userData) {
    const user = await this.userRepository.save(userData);
    await this.emailService.sendWelcomeEmail(user.email);
    return user;
  }
}
```

#### Small, Focused Functions
```python
# Easy to test - single responsibility
def validate_email(email: str) -> bool:
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
```

### ❌ BAD: Hard to Test Patterns

#### Global State Access
```javascript
// Hard to test - depends on global state
function getUserDisplayName() {
  return window.currentUser.name; // Global dependency
}
```

#### Mixed Responsibilities
```javascript
// Hard to test - does too many things
function saveUserAndSendEmail(userData) {
  // Database operation
  const user = database.save(userData);
  
  // Email operation
  emailService.send(userData.email, 'Welcome!');
  
  // File operation
  fs.writeFileSync('./user-log.txt', user.id);
  
  return user;
}
```

#### Hidden Dependencies
```python
# Hard to test - hidden external dependency
def get_weather():
    import requests
    response = requests.get('https://api.weather.com/current')
    return response.json()
```

## 4. Common Testing Commands

### JavaScript/TypeScript Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test Button.test.jsx

# Run tests matching a pattern
npm test -- --testNamePattern="user"

# Run tests in a specific directory
npm test src/components

# Debug tests
npm test -- --verbose

# Run E2E tests
npm run test:e2e

# Update snapshots
npm test -- --updateSnapshot
```

### Python Commands

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov

# Run specific test file
pytest tests/test_user.py

# Run specific test function
pytest tests/test_user.py::test_create_user

# Run tests matching pattern
pytest -k "user and create"

# Run tests by marker
pytest -m "unit"

# Run tests and stop on first failure
pytest -x

# Run tests in parallel
pytest -n auto

# Generate coverage report in HTML
pytest --cov --cov-report=html

# Run only failed tests from last run
pytest --lf
```

## 5. Debugging Failed Tests

### Systematic Debugging Approach

#### Step 1: Read the Error Message Carefully
```bash
# Run the failing test with verbose output
npm test -- --verbose FailingTest.test.js
# OR
pytest tests/test_failing.py -v -s
```

#### Step 2: Isolate the Problem
```bash
# Run only the failing test
npm test -- --testNamePattern="specific failing test"
# OR
pytest tests/test_failing.py::test_specific_function
```

#### Step 3: Add Debug Output
```javascript
// JavaScript debugging
test('failing test', () => {
  const result = functionUnderTest(input);
  console.log('Input:', input);
  console.log('Expected:', expected);
  console.log('Actual:', result);
  expect(result).toBe(expected);
});
```

```python
# Python debugging
def test_failing():
    result = function_under_test(input_data)
    print(f"Input: {input_data}")
    print(f"Expected: {expected}")
    print(f"Actual: {result}")
    assert result == expected
```

#### Step 4: Check Test Environment
```bash
# Verify test setup
npm test -- --setupFilesAfterEnv

# Check for interference between tests
npm test -- --runInBand

# Clear Jest cache
npm test -- --clearCache

# Reset Python cache
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} +
```

### Common Failure Patterns

#### Async/Await Issues
```javascript
// WRONG - missing await
test('async function', () => {
  const result = asyncFunction(); // Missing await
  expect(result).toBe(expected);
});

// CORRECT
test('async function', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

#### Mock Issues
```javascript
// WRONG - mock not properly configured
jest.mock('./api');
test('function using API', () => {
  api.getData(); // Mock returns undefined
  // Test fails because mock behavior not defined
});

// CORRECT
jest.mock('./api');
test('function using API', () => {
  api.getData.mockResolvedValue({ data: 'test' });
  // Now mock returns expected value
});
```

#### State Pollution
```python
# WRONG - tests affect each other
class TestUser:
    def test_create_user(self):
        user = User.objects.create(email="test@example.com")
        assert user.id is not None
        
    def test_user_count(self):
        count = User.objects.count()
        assert count == 0  # Fails if previous test ran first

# CORRECT - use fixtures for isolation
@pytest.fixture(autouse=True)
def clean_database():
    yield
    User.objects.all().delete()
```

## 6. Test Organization Best Practices

### File Structure
```
tests/
├── unit/                 # Unit tests
│   ├── test_utils.py
│   └── test_models.py
├── integration/          # Integration tests
│   ├── test_api.py
│   └── test_database.py
├── e2e/                  # End-to-end tests
│   └── test_workflows.py
├── fixtures/             # Test data
│   └── sample_data.json
└── conftest.py          # Shared fixtures
```

### Test Naming Conventions
```python
# Good test names - describe behavior
def test_user_creation_with_valid_email_succeeds():
def test_user_creation_with_invalid_email_raises_validation_error():
def test_user_login_with_correct_credentials_returns_token():
def test_user_login_with_wrong_password_returns_unauthorized():

# Pattern: test_[unit]_[condition]_[expected_outcome]
```

### Test Data Management
```python
# Use factories for consistent test data
@pytest.fixture
def user_factory():
    def _create_user(**kwargs):
        defaults = {
            "email": "test@example.com",
            "name": "Test User",
            "password": "password123"
        }
        defaults.update(kwargs)
        return User(**defaults)
    return _create_user

# Usage in tests
def test_user_creation(user_factory):
    user = user_factory(email="custom@example.com")
    assert user.email == "custom@example.com"
```

---

## Quick Reference

### Before Writing Any Code:
1. ✅ Write a failing test
2. ✅ Run the test to confirm it fails
3. ✅ Write minimal code to make it pass
4. ✅ Run the test to confirm it passes
5. ✅ Refactor while keeping tests green

### Test Distribution Goal:
- 70% Unit tests (fast, isolated)
- 20% Integration tests (moderate speed, realistic)
- 10% E2E tests (slow, comprehensive)

### Essential Commands:
- `npm test` / `pytest` - Run all tests
- `npm run test:watch` / `pytest --watch` - Watch mode
- `npm run test:coverage` / `pytest --cov` - Coverage report