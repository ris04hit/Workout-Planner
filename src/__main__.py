"""
Workout Tracker Application Entry Point

This module serves as the main entry point for the workout tracker Flask application.
Run with: python -m src
"""

import sys
import os
from pathlib import Path

# Add the src directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app import app

def main():
    """Main entry point for the workout tracker application."""
    print("🏋️  Starting Workout Tracker Application...")
    print("🌐 Access the application at: http://localhost:5000")
    print("📝 Press Ctrl+C to stop the application")
    print("")
    
    # Run the Flask application with cleaner output
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=False  # Prevent duplicate startup messages
    )

if __name__ == '__main__':
    main()
