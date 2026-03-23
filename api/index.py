import os
import sys

# Add the backend directory to sys.path so we can import from it
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app

# For Vercel, the variable must be named 'app'
# Since it's already named 'app' in main.py, we just import it.
