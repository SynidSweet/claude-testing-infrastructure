"""
Global test configuration and fixtures for pytest
"""
import asyncio
import os
import pytest
import tempfile
from typing import Generator
from unittest.mock import Mock, patch

# Set test environment
os.environ["TESTING"] = "1"
os.environ["ENVIRONMENT"] = "test"

{{#if fastapi}}
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.database import get_db, Base
from src.config import settings

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def test_db():
    """Create test database tables."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(test_db):
    """Create test client."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def db_session(test_db):
    """Create database session for tests."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
{{/if}}

{{#if flask}}
import pytest
from src import create_app
from src.database import db as _db
from src.config import TestConfig

@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    app = create_app(TestConfig)
    
    with app.app_context():
        yield app

@pytest.fixture(scope='session')
def db(app):
    """Create database for testing."""
    _db.app = app
    _db.create_all()
    
    yield _db
    
    _db.drop_all()

@pytest.fixture
def session(db):
    """Create database session for tests."""
    connection = db.engine.connect()
    transaction = connection.begin()
    
    options = dict(bind=connection, binds={})
    session = db.create_scoped_session(options=options)
    
    db.session = session
    
    yield session
    
    transaction.rollback()
    connection.close()
    session.remove()

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()
{{/if}}

{{#if django}}
import pytest
from django.test import Client
from django.contrib.auth import get_user_model
from django.core.management import call_command

User = get_user_model()

@pytest.fixture(scope='session')
def django_db_setup(django_db_setup, django_db_blocker):
    """Load initial data for tests."""
    with django_db_blocker.unblock():
        call_command('loaddata', 'test_fixtures.json')

@pytest.fixture
def client():
    """Create Django test client."""
    return Client()

@pytest.fixture
def user(db):
    """Create test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )

@pytest.fixture
def admin_user(db):
    """Create admin user."""
    return User.objects.create_superuser(
        username='admin',
        email='admin@example.com',
        password='adminpass123'
    )
{{/if}}

# Generic fixtures
@pytest.fixture
def temp_file():
    """Create temporary file for testing."""
    fd, path = tempfile.mkstemp()
    yield path
    os.close(fd)
    os.unlink(path)

@pytest.fixture
def temp_dir():
    """Create temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

@pytest.fixture
def mock_redis():
    """Mock Redis connection."""
    with patch('redis.Redis') as mock:
        mock_instance = Mock()
        mock.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_email():
    """Mock email sending."""
    with patch('smtplib.SMTP') as mock:
        yield mock

@pytest.fixture
def mock_s3():
    """Mock AWS S3."""
    with patch('boto3.client') as mock:
        yield mock

@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "email": "test@example.com",
        "password": "password123",
        "name": "Test User",
        "role": "user"
    }

@pytest.fixture
def sample_product_data():
    """Sample product data for testing."""
    return {
        "name": "Test Product",
        "price": 99.99,
        "description": "A test product",
        "category": "electronics",
        "in_stock": True
    }

@pytest.fixture
def auth_headers():
    """Create authorization headers for API tests."""
    def _auth_headers(token):
        return {"Authorization": f"Bearer {token}"}
    return _auth_headers

@pytest.fixture
def api_client():
    """Enhanced API client with helper methods."""
    class APIClient:
        def __init__(self, client):
            self.client = client
            self._token = None
        
        def set_token(self, token):
            """Set authentication token."""
            self._token = token
        
        def get_headers(self):
            """Get headers with authentication."""
            headers = {"Content-Type": "application/json"}
            if self._token:
                headers["Authorization"] = f"Bearer {self._token}"
            return headers
        
        def get(self, url, **kwargs):
            """GET request with auth."""
            headers = kwargs.pop("headers", {})
            headers.update(self.get_headers())
            return self.client.get(url, headers=headers, **kwargs)
        
        def post(self, url, json=None, **kwargs):
            """POST request with auth."""
            headers = kwargs.pop("headers", {})
            headers.update(self.get_headers())
            return self.client.post(url, json=json, headers=headers, **kwargs)
        
        def put(self, url, json=None, **kwargs):
            """PUT request with auth."""
            headers = kwargs.pop("headers", {})
            headers.update(self.get_headers())
            return self.client.put(url, json=json, headers=headers, **kwargs)
        
        def delete(self, url, **kwargs):
            """DELETE request with auth."""
            headers = kwargs.pop("headers", {})
            headers.update(self.get_headers())
            return self.client.delete(url, headers=headers, **kwargs)
    
    return APIClient

# Async fixtures
@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def async_client():
    """Create async test client."""
    # This would be specific to your async framework
    # Example for httpx:
    # import httpx
    # async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
    #     yield ac
    pass

# Database cleanup
@pytest.fixture(autouse=True)
def clean_database():
    """Clean database after each test."""
    yield
    # Add cleanup logic here
    # For SQLAlchemy: session.rollback()
    # For Django: call_command('flush', '--noinput')

# Test data factories
class TestDataFactory:
    """Factory for creating test data."""
    
    @staticmethod
    def create_user(**kwargs):
        """Create user data."""
        defaults = {
            "email": "test@example.com",
            "password": "password123",
            "name": "Test User",
            "role": "user",
            "is_active": True
        }
        defaults.update(kwargs)
        return defaults
    
    @staticmethod
    def create_product(**kwargs):
        """Create product data."""
        defaults = {
            "name": "Test Product",
            "price": 99.99,
            "description": "A test product",
            "category": "electronics",
            "in_stock": True,
            "sku": "TEST-001"
        }
        defaults.update(kwargs)
        return defaults

@pytest.fixture
def factory():
    """Test data factory."""
    return TestDataFactory

# Markers
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )

# Hooks
def pytest_runtest_setup(item):
    """Run before each test."""
    # Add any setup logic here
    pass

def pytest_runtest_teardown(item, nextitem):
    """Run after each test."""
    # Add any teardown logic here
    pass