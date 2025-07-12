from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional
from datetime import datetime
import uuid

app = FastAPI(title="Test Python API", version="1.0.0")

# Models
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    age: int
    
    @validator('age')
    def validate_age(cls, v):
        if v < 0 or v > 150:
            raise ValueError('Age must be between 0 and 150')
        return v

class User(UserCreate):
    id: str
    created_at: datetime

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: int = 1
    
    @validator('priority')
    def validate_priority(cls, v):
        if v < 1 or v > 5:
            raise ValueError('Priority must be between 1 and 5')
        return v

class Task(TaskCreate):
    id: str
    user_id: str
    completed: bool = False
    created_at: datetime

# In-memory storage
users_db: dict[str, User] = {}
tasks_db: dict[str, Task] = {}

# Routes
@app.get("/")
def read_root():
    return {"message": "Welcome to Test Python API"}

@app.post("/users", response_model=User)
def create_user(user: UserCreate):
    user_id = str(uuid.uuid4())
    db_user = User(
        id=user_id,
        name=user.name,
        email=user.email,
        age=user.age,
        created_at=datetime.now()
    )
    users_db[user_id] = db_user
    return db_user

@app.get("/users", response_model=List[User])
def get_users():
    return list(users_db.values())

@app.get("/users/{user_id}", response_model=User)
def get_user(user_id: str):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    return users_db[user_id]

@app.post("/users/{user_id}/tasks", response_model=Task)
def create_task(user_id: str, task: TaskCreate):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    task_id = str(uuid.uuid4())
    db_task = Task(
        id=task_id,
        user_id=user_id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        created_at=datetime.now()
    )
    tasks_db[task_id] = db_task
    return db_task

@app.get("/users/{user_id}/tasks", response_model=List[Task])
def get_user_tasks(user_id: str):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_tasks = [task for task in tasks_db.values() if task.user_id == user_id]
    return user_tasks

@app.patch("/tasks/{task_id}/complete")
def complete_task(task_id: str):
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    tasks_db[task_id].completed = True
    return {"message": "Task completed", "task": tasks_db[task_id]}