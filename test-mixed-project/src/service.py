# Python service file
import json
import requests

class DataService:
    def fetch_data(self, url):
        response = requests.get(url)
        return response.json()
    
    def process_data(self, data):
        return [item for item in data if item.get('active')]