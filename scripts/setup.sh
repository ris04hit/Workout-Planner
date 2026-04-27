#!/bin/bash

# Workout Tracker - Environment Setup Script
# Run once from the project root: bash scripts/setup.sh

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
RESET="\033[0m"

info()    { echo -e "${BOLD}$1${RESET}"; }
success() { echo -e "${GREEN}✔  $1${RESET}"; }
warn()    { echo -e "${YELLOW}⚠  $1${RESET}"; }
fail()    { echo -e "${RED}✘  $1${RESET}"; exit 1; }

echo ""
info "Workout Tracker — Environment Setup"
echo "======================================"
echo ""

# ── Verify project root ────────────────────────────────────────────────────────
if [ ! -f "requirements.txt" ] || [ ! -f "package.json" ]; then
    fail "Run this script from the project root directory."
fi

# ── Python ─────────────────────────────────────────────────────────────────────
if command -v py &> /dev/null; then
    PYTHON="py"; PIP="py -m pip"
elif command -v python3 &> /dev/null; then
    PYTHON="python3"; PIP="python3 -m pip"
elif command -v python &> /dev/null; then
    PYTHON="python"; PIP="python -m pip"
else
    fail "Python 3 is required but not found. Install it from https://python.org"
fi

PYTHON_VERSION=$($PYTHON --version 2>&1)
success "Python found: $PYTHON_VERSION"

# Virtual environment
if [ ! -d "venv" ]; then
    info "Creating virtual environment..."
    $PYTHON -m venv venv
    success "Virtual environment created"
else
    warn "Virtual environment already exists — skipping creation"
fi

# Activate
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate          # Windows (Git Bash / MSYS2)
    PIP="pip"
else
    source venv/bin/activate              # macOS / Linux
    PIP="pip"
fi
success "Virtual environment activated"

# Upgrade pip silently
$PIP install --upgrade pip --quiet
success "pip up to date"

# Install Python dependencies
info "Installing Python dependencies..."
$PIP install -r requirements.txt --quiet
success "Python dependencies installed"

# ── Node.js ────────────────────────────────────────────────────────────────────
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    success "Node.js found: $NODE_VERSION"
else
    warn "Node.js not found — JS tests will not be available."
    warn "Install it from https://nodejs.org (LTS recommended)"
fi

if command -v npm &> /dev/null; then
    info "Installing Node.js dependencies..."
    npm install --silent
    success "Node.js dependencies installed"
else
    warn "npm not found — skipping JS dependency install"
fi

# ── Runtime data files (gitignored) ───────────────────────────────────────────
info "Initialising runtime data files..."
$PYTHON scripts/init_default_data.py
success "Runtime data files ready"

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
success "Setup complete!"
echo ""
echo "  Start the app:    bash scripts/run.sh"
echo "  Run Python tests: python -m pytest tests/"
echo "  Run JS tests:     npm test"
echo "  Open browser:     http://localhost:5000"
echo ""
