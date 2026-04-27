"""
Workout Tracker Flask Application

This is the main Flask application that serves the workout tracker.
It imports and registers all API routes from organized modules.
"""

import os
from flask import Flask, render_template
from storage import *

# Import API modules
from api.users import register_user_routes
from api.workouts import register_workout_routes
from api.exercises import register_exercises_routes
from api.config import register_config_routes

# Get the parent directory (project root) for templates and static files
project_root = os.path.dirname(os.path.dirname(__file__))
template_dir = os.path.join(project_root, 'templates')
static_dir = os.path.join(project_root, 'static')

# Create Flask app with correct template and static directories
app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# Register all API routes
register_user_routes(app)
register_workout_routes(app)
register_exercises_routes(app)
register_config_routes(app)

# Main route - serves the frontend
@app.route("/")
def index():
    """Serve the main application page."""
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
