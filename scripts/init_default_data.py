"""
Initialise gitignored runtime data files required by the app.

Run once from the project root after cloning:
    python scripts/init_default_data.py

Tracked files (exercises.json, config.json) are already in git
and are NOT written here.  Only the gitignored files that the app writes at
runtime are created so the app can start cleanly on a fresh checkout.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DIR = os.path.join(ROOT, "data", "default")
USERS_DIR   = os.path.join(ROOT, "data", "users")
USERS_FILE  = os.path.join(ROOT, "data", "users.json")

os.makedirs(DEFAULT_DIR, exist_ok=True)
os.makedirs(USERS_DIR,   exist_ok=True)


def _init(path, value):
    """Write `value` as JSON to `path` only if the file does not yet exist."""
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(value, f, indent=2)
        print(f"  created {os.path.relpath(path, ROOT)}")
    else:
        print(f"  exists  {os.path.relpath(path, ROOT)} — skipped")


# ── Gitignored default-user runtime files ─────────────────────────────────────
_init(os.path.join(DEFAULT_DIR, "workouts.json"),      [])
_init(os.path.join(DEFAULT_DIR, "soreness.json"),      {})
_init(os.path.join(DEFAULT_DIR, "config_history.json"), [])

# ── Gitignored user registry ───────────────────────────────────────────────────
_init(USERS_FILE, {"users": []})

print("\nDone. Start the app: python -m src")
