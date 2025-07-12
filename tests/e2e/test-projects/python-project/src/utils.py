import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import hashlib
import json

def validate_email(email: str) -> bool:
    """
    Validate email format using regex
    
    Args:
        email: Email string to validate
        
    Returns:
        bool: True if valid email format
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def calculate_age(birthdate: datetime) -> int:
    """
    Calculate age from birthdate
    
    Args:
        birthdate: DateTime object of birth
        
    Returns:
        int: Age in years
    """
    today = datetime.now()
    age = today.year - birthdate.year
    
    # Check if birthday hasn't occurred this year
    if (today.month, today.day) < (birthdate.month, birthdate.day):
        age -= 1
    
    return age

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """
    Hash a password with salt
    
    Args:
        password: Plain text password
        salt: Optional salt string
        
    Returns:
        tuple: (hashed_password, salt)
    """
    if salt is None:
        salt = hashlib.sha256(str(datetime.now()).encode()).hexdigest()[:16]
    
    salted = f"{password}{salt}"
    hashed = hashlib.sha256(salted.encode()).hexdigest()
    
    return hashed, salt

def parse_priority(priority_str: str) -> int:
    """
    Parse priority string to integer
    
    Args:
        priority_str: Priority as string (low, medium, high, urgent, critical)
        
    Returns:
        int: Priority level 1-5
    """
    priority_map = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'urgent': 4,
        'critical': 5
    }
    
    return priority_map.get(priority_str.lower(), 1)

def format_duration(seconds: int) -> str:
    """
    Format duration in seconds to human readable string
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        str: Formatted duration (e.g., "2h 30m 45s")
    """
    if seconds < 0:
        return "Invalid duration"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if secs > 0 or not parts:
        parts.append(f"{secs}s")
    
    return " ".join(parts)

def paginate_items(items: List[Any], page: int = 1, per_page: int = 10) -> Dict[str, Any]:
    """
    Paginate a list of items
    
    Args:
        items: List of items to paginate
        page: Current page number (1-indexed)
        per_page: Items per page
        
    Returns:
        dict: Paginated response with metadata
    """
    total_items = len(items)
    total_pages = (total_items + per_page - 1) // per_page
    
    # Ensure page is within valid range
    page = max(1, min(page, total_pages))
    
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    
    return {
        'items': items[start_idx:end_idx],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total_items': total_items,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }

class DataProcessor:
    """Class for processing various data formats"""
    
    def __init__(self):
        self.processed_count = 0
    
    def process_json(self, json_str: str) -> Dict[str, Any]:
        """
        Process JSON string and extract metadata
        
        Args:
            json_str: JSON string to process
            
        Returns:
            dict: Processed data with metadata
        """
        try:
            data = json.loads(json_str)
            self.processed_count += 1
            
            return {
                'data': data,
                'metadata': {
                    'processed_at': datetime.now().isoformat(),
                    'size': len(json_str),
                    'type': type(data).__name__,
                    'count': self.processed_count
                }
            }
        except json.JSONDecodeError as e:
            return {
                'error': f"Invalid JSON: {str(e)}",
                'metadata': {
                    'processed_at': datetime.now().isoformat(),
                    'count': self.processed_count
                }
            }
    
    def sanitize_input(self, text: str) -> str:
        """
        Sanitize user input by removing potentially harmful characters
        
        Args:
            text: Input text to sanitize
            
        Returns:
            str: Sanitized text
        """
        # Remove control characters
        sanitized = re.sub(r'[\x00-\x1F\x7F]', '', text)
        
        # Remove multiple spaces
        sanitized = re.sub(r'\s+', ' ', sanitized)
        
        # Trim whitespace
        return sanitized.strip()