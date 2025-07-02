"""User service for complex mixed project."""

from typing import List, Optional
from datetime import datetime

from ..models.user import User, UserCreate, UserUpdate


class UserService:
    """Service for managing user operations."""
    
    def __init__(self):
        # Mock database - in real project would use actual database
        self._users: List[User] = [
            User(
                id=1,
                name="John Doe",
                email="john@example.com",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True
            ),
            User(
                id=2,
                name="Jane Smith",
                email="jane@example.com",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                is_active=True
            )
        ]
        self._next_id = 3
    
    async def get_all_users(self) -> List[User]:
        """Get all active users."""
        return [user for user in self._users if user.is_active]
    
    async def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        for user in self._users:
            if user.id == user_id and user.is_active:
                return user
        return None
    
    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        new_user = User(
            id=self._next_id,
            name=user_data.name,
            email=user_data.email,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            is_active=True
        )
        self._users.append(new_user)
        self._next_id += 1
        return new_user
    
    async def update_user(self, user_id: int, updates: UserUpdate) -> Optional[User]:
        """Update user by ID."""
        user = await self.get_user(user_id)
        if not user:
            return None
        
        # Update fields
        if updates.name is not None:
            user.name = updates.name
        if updates.email is not None:
            user.email = updates.email
        
        user.updated_at = datetime.now()
        return user
    
    async def delete_user(self, user_id: int) -> bool:
        """Soft delete user by ID."""
        user = await self.get_user(user_id)
        if not user:
            return False
        
        user.is_active = False
        user.updated_at = datetime.now()
        return True
    
    def validate_email(self, email: str) -> bool:
        """Validate email format."""
        return "@" in email and "." in email.split("@")[-1]