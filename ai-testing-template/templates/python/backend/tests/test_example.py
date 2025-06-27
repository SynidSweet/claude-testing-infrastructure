"""
Example tests for Python backend
"""
import pytest
import json
from unittest.mock import Mock, patch, AsyncMock

{{#if fastapi}}
def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_create_user(client, sample_user_data):
    """Test user creation endpoint."""
    response = client.post("/users/", json=sample_user_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["email"] == sample_user_data["email"]
    assert data["name"] == sample_user_data["name"]
    assert "password" not in data  # Password should not be returned

def test_get_user(client, sample_user_data):
    """Test get user endpoint."""
    # Create user first
    create_response = client.post("/users/", json=sample_user_data)
    user_id = create_response.json()["id"]
    
    # Get user
    response = client.get(f"/users/{user_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == user_id
    assert data["email"] == sample_user_data["email"]

def test_user_not_found(client):
    """Test get non-existent user."""
    response = client.get("/users/999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_async_endpoint(async_client):
    """Test async endpoint."""
    response = await async_client.get("/async-endpoint")
    assert response.status_code == 200
{{/if}}

{{#if flask}}
def test_health_check(client):
    """Test health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'healthy'

def test_create_user(client, sample_user_data):
    """Test user creation endpoint."""
    response = client.post('/api/users', 
                          data=json.dumps(sample_user_data),
                          content_type='application/json')
    assert response.status_code == 201
    
    data = json.loads(response.data)
    assert data['email'] == sample_user_data['email']
    assert data['name'] == sample_user_data['name']

def test_login(client, sample_user_data):
    """Test user login."""
    # Create user first
    client.post('/api/users', 
                data=json.dumps(sample_user_data),
                content_type='application/json')
    
    # Login
    login_data = {
        'email': sample_user_data['email'],
        'password': sample_user_data['password']
    }
    response = client.post('/api/auth/login',
                          data=json.dumps(login_data),
                          content_type='application/json')
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'token' in data
{{/if}}

{{#if django}}
import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.mark.django_db
def test_user_creation():
    """Test creating a user."""
    user = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )
    assert user.username == 'testuser'
    assert user.email == 'test@example.com'
    assert user.check_password('testpass123')

@pytest.mark.django_db
def test_user_api_list(client, user):
    """Test user list API."""
    url = reverse('user-list')
    response = client.get(url)
    assert response.status_code == 200

@pytest.mark.django_db
def test_user_api_create(client):
    """Test user creation API."""
    url = reverse('user-list')
    data = {
        'username': 'newuser',
        'email': 'newuser@example.com',
        'password': 'newpass123'
    }
    response = client.post(url, data, content_type='application/json')
    assert response.status_code == 201
    assert User.objects.filter(username='newuser').exists()
{{/if}}

# Unit tests for utility functions
class TestUtilityFunctions:
    """Test utility functions."""
    
    def test_validate_email(self):
        """Test email validation."""
        from src.utils import validate_email
        
        # Valid emails
        valid_emails = [
            'test@example.com',
            'user.name@domain.co.uk',
            'user+tag@example.org'
        ]
        
        for email in valid_emails:
            assert validate_email(email) is True
        
        # Invalid emails
        invalid_emails = [
            'invalid-email',
            '@example.com',
            'user@',
            'user@.com',
            ''
        ]
        
        for email in invalid_emails:
            assert validate_email(email) is False
    
    def test_hash_password(self):
        """Test password hashing."""
        from src.utils import hash_password
        
        password = 'testpassword123'
        hashed = hash_password(password)
        
        assert hashed != password
        assert len(hashed) > 50  # Hashed passwords are long
        
        # Same password should produce different hashes
        hashed2 = hash_password(password)
        assert hashed != hashed2
    
    def test_verify_password(self):
        """Test password verification."""
        from src.utils import hash_password, verify_password
        
        password = 'testpassword123'
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        assert verify_password('wrongpassword', hashed) is False
    
    def test_generate_token(self):
        """Test JWT token generation."""
        from src.utils import generate_token
        
        payload = {'user_id': 123, 'email': 'test@example.com'}
        token = generate_token(payload)
        
        assert isinstance(token, str)
        assert len(token.split('.')) == 3  # JWT has 3 parts

class TestDatabaseOperations:
    """Test database operations."""
    
    @pytest.mark.integration
    def test_user_crud_operations(self, db_session, sample_user_data):
        """Test user CRUD operations."""
        from src.models import User
        
        # Create
        user = User(**sample_user_data)
        db_session.add(user)
        db_session.commit()
        
        assert user.id is not None
        
        # Read
        retrieved_user = db_session.query(User).filter_by(email=sample_user_data['email']).first()
        assert retrieved_user is not None
        assert retrieved_user.email == sample_user_data['email']
        
        # Update
        new_name = 'Updated Name'
        retrieved_user.name = new_name
        db_session.commit()
        
        updated_user = db_session.query(User).filter_by(id=user.id).first()
        assert updated_user.name == new_name
        
        # Delete
        db_session.delete(updated_user)
        db_session.commit()
        
        deleted_user = db_session.query(User).filter_by(id=user.id).first()
        assert deleted_user is None

class TestExternalServices:
    """Test external service integrations."""
    
    @patch('requests.post')
    def test_send_email(self, mock_post):
        """Test email sending service."""
        from src.services import EmailService
        
        # Mock successful response
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {'message_id': 'test123'}
        
        email_service = EmailService()
        result = email_service.send_email(
            to='test@example.com',
            subject='Test Subject',
            body='Test Body'
        )
        
        assert result['success'] is True
        assert result['message_id'] == 'test123'
        mock_post.assert_called_once()
    
    @patch('boto3.client')
    def test_file_upload(self, mock_boto3):
        """Test file upload to S3."""
        from src.services import FileService
        
        # Mock S3 client
        mock_s3 = Mock()
        mock_s3.upload_fileobj.return_value = None
        mock_boto3.return_value = mock_s3
        
        file_service = FileService()
        result = file_service.upload_file('test.txt', b'test content')
        
        assert result['success'] is True
        mock_s3.upload_fileobj.assert_called_once()

class TestAsyncOperations:
    """Test async operations."""
    
    @pytest.mark.asyncio
    async def test_async_function(self):
        """Test async function."""
        from src.services import AsyncService
        
        service = AsyncService()
        result = await service.async_operation()
        
        assert result is not None
    
    @pytest.mark.asyncio
    @patch('aiohttp.ClientSession.get')
    async def test_async_http_request(self, mock_get):
        """Test async HTTP request."""
        from src.services import HTTPService
        
        # Mock async response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={'data': 'test'})
        mock_get.return_value.__aenter__.return_value = mock_response
        
        service = HTTPService()
        result = await service.fetch_data('https://api.example.com/data')
        
        assert result['data'] == 'test'

class TestErrorHandling:
    """Test error handling scenarios."""
    
    def test_validation_errors(self, client):
        """Test validation error responses."""
        # Send invalid data
        invalid_data = {
            'email': 'invalid-email',
            'password': '123'  # too short
        }
        
        response = client.post('/users/', json=invalid_data)
        assert response.status_code == 422
        
        errors = response.json()['detail']
        assert any('email' in str(error) for error in errors)
        assert any('password' in str(error) for error in errors)
    
    def test_not_found_errors(self, client):
        """Test 404 error responses."""
        response = client.get('/users/999999')
        assert response.status_code == 404
        assert 'not found' in response.json()['detail'].lower()
    
    @patch('src.services.EmailService.send_email')
    def test_service_error_handling(self, mock_send_email):
        """Test service error handling."""
        from src.services import EmailService
        
        # Mock service failure
        mock_send_email.side_effect = Exception('Service unavailable')
        
        service = EmailService()
        
        with pytest.raises(Exception) as exc_info:
            service.send_email('test@example.com', 'Subject', 'Body')
        
        assert 'Service unavailable' in str(exc_info.value)

# Performance tests
class TestPerformance:
    """Test performance characteristics."""
    
    @pytest.mark.slow
    def test_bulk_operations(self, db_session):
        """Test bulk database operations."""
        from src.models import User
        
        # Create many users
        users = []
        for i in range(100):
            user = User(
                email=f'user{i}@example.com',
                name=f'User {i}',
                password='password123'
            )
            users.append(user)
        
        db_session.bulk_save_objects(users)
        db_session.commit()
        
        # Verify all users were created
        count = db_session.query(User).count()
        assert count >= 100
    
    @pytest.mark.slow
    def test_endpoint_response_time(self, client):
        """Test endpoint response time."""
        import time
        
        start_time = time.time()
        response = client.get('/users/')
        end_time = time.time()
        
        response_time = end_time - start_time
        assert response_time < 1.0  # Should respond within 1 second
        assert response.status_code == 200