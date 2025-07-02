"""Python API client for mixed project testing."""

import requests
import json


class ApiClient:
    """Simple API client for testing purposes."""
    
    def __init__(self, base_url="https://api.example.com"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def get_data(self, endpoint):
        """Fetch data from API endpoint."""
        url = f"{self.base_url}/{endpoint}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def post_data(self, endpoint, data):
        """Post data to API endpoint."""
        url = f"{self.base_url}/{endpoint}"
        response = self.session.post(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def validate_response(self, response):
        """Validate API response structure."""
        return isinstance(response, dict) and len(response) > 0