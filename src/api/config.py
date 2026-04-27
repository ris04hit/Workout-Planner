"""
Configuration API Endpoints

Handles configuration management, history, reset, and revert.
Picker state endpoints have been removed (no group picker in new algorithm).
"""

from flask import jsonify, request
from storage import (
    get_config, set_config, get_config_history, reset_config,
    revert_config as storage_revert_config,
    get_current_user, set_current_user,
    get_effective_config
)


def register_config_routes(app):
    """Register all configuration-related routes with the Flask app."""

    def _set_user(req):
        username = req.args.get('user') or get_current_user()
        if username:
            set_current_user(username)

    @app.route("/api/config", methods=["GET"])
    def get_config_endpoint():
        """Get the full effective configuration (defaults + user overrides)."""
        _set_user(request)
        return jsonify(get_effective_config(get_config()))

    @app.route("/api/config", methods=["POST"])
    def save_config():
        """Save user configuration overrides."""
        _set_user(request)
        config = request.json or {}
        try:
            set_config(config)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        return jsonify({"config": get_effective_config(get_config())})

    @app.route("/api/config/reset", methods=["POST"])
    def reset_config_endpoint():
        """Reset configuration to defaults."""
        _set_user(request)
        config = reset_config()
        return jsonify({"config": config})

    @app.route("/api/config/history", methods=["GET"])
    def get_config_history_endpoint():
        """Get configuration change history."""
        _set_user(request)
        return jsonify(get_config_history())

    @app.route("/api/config/revert", methods=["POST"])
    def revert_config_endpoint():
        """Revert configuration to a specific history entry."""
        _set_user(request)
        data = request.json or {}
        index = data.get("index", 0)
        try:
            config = storage_revert_config(index)
            return jsonify({"config": config})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Failed to revert config"}), 500

