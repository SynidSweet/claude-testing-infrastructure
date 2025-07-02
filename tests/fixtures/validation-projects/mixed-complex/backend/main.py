"""FastAPI backend for complex mixed project testing."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uvicorn

from .services.data_service import DataService
from .services.user_service import UserService
from .models.user import User, UserCreate, UserUpdate


app = FastAPI(title="Complex Mixed Project API", version="1.0.0")
data_service = DataService()
user_service = UserService()


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version="1.0.0"
    )


@app.get("/users", response_model=List[User])
async def get_users():
    """Get all users."""
    return await user_service.get_all_users()


@app.post("/users", response_model=User)
async def create_user(user: UserCreate):
    """Create a new user."""
    return await user_service.create_user(user)


@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Get user by ID."""
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: int, updates: UserUpdate):
    """Update user by ID."""
    user = await user_service.update_user(user_id, updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.delete("/users/{user_id}")
async def delete_user(user_id: int):
    """Delete user by ID."""
    success = await user_service.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}


@app.get("/data/process")
async def process_data(numbers: str):
    """Process data endpoint."""
    try:
        num_list = [int(x.strip()) for x in numbers.split(',')]
        result = await data_service.process_numbers(num_list)
        return result
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid number format")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)