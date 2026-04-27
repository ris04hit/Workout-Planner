#!/usr/bin/env bash
# ──────────────────────────────────────────────
# Run all tests: Python (pytest) + JS (Jest)
# Usage: bash scripts/run_tests.sh
# ──────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON_PASS=0
JS_PASS=0

echo ""
echo "══════════════════════════════════════"
echo "  Python tests (pytest)"
echo "══════════════════════════════════════"
if python -m pytest tests/src/ -v --tb=short; then
    PYTHON_PASS=1
fi

echo ""
echo "══════════════════════════════════════"
echo "  JavaScript tests (Jest)"
echo "══════════════════════════════════════"
if node node_modules/jest/bin/jest.js tests/static/js/ --no-coverage; then
    JS_PASS=1
fi

echo ""
echo "══════════════════════════════════════"
if [ $PYTHON_PASS -eq 1 ] && [ $JS_PASS -eq 1 ]; then
    echo "  ✅  ALL TESTS PASSED"
else
    echo "  ❌  SOME TESTS FAILED"
    exit 1
fi
echo "══════════════════════════════════════"
echo ""
