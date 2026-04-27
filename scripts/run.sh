#!/bin/bash

# Workout Tracker - Run Script
# This script starts the workout tracker application

set -e  # Exit on any error

echo "🏋️  Starting Workout Tracker Application..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run ./scripts/setup.sh first."
    exit 1
fi

# Activate virtual environment (Windows compatible)
echo "🔧 Activating virtual environment..."
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Check if we're in the correct directory
if [ ! -f "src/__main__.py" ]; then
    echo "❌ Please run this script from the project root directory."
    exit 1
fi

# Determine Python command for consistency
if command -v py &> /dev/null; then
    PYTHON_CMD="py"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

# Start the application
echo "🚀 Starting Flask application..."
echo "🌐 Application will be available at: http://localhost:5000"
echo "📝 Press Ctrl+C to stop the application"
echo ""

# Run the application
$PYTHON_CMD -m src
