import os
import sys

# Add the backend directory to sys.path so we can import from it
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

# Import the FastAPI app from backend/main.py
from main import app

# Vercel needs a variable named 'app'
app = app
