"""
User Management API Endpoints

This module handles all user-related operations including:
- User creation and listing
- User deletion
- Current user management
"""

from flask import jsonify, request
from storage import get_users, create_user, delete_user as storage_delete_user, get_current_user, set_current_user


def register_user_routes(app):
    """Register all user-related routes with the Flask app."""
    
    @app.route("/api/users", methods=["GET", "POST"])
    def users():
        """Handle user management"""
        if request.method == "GET":
            # Get list of all users
            try:
                users = get_users()
                return jsonify(users)
            except Exception as e:
                return jsonify({"error": "Failed to get users"}), 500
        
        elif request.method == "POST":
            # Create a new user
            data = request.json
            username = data.get('username')
            copy_from_default = data.get('copy_from_default', True)
            
            if not username:
                return jsonify({"error": "Username is required"}), 400
            
            try:
                create_user(username, copy_from_default)
                return jsonify({"status": "ok", "username": username})
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception as e:
                return jsonify({"error": "Failed to create user"}), 500

    @app.route("/api/users/<username>", methods=["DELETE"])
    def delete_user_endpoint(username):
        """Delete a user and all their data - BACKEND ONLY API (not exposed to UI)"""
        try:
            storage_delete_user(username)
            return jsonify({"status": "ok"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": "Failed to delete user"}), 500

    @app.route("/api/current-user", methods=["GET", "POST"])
    def current_user():
        """Get or set the current user"""
        if request.method == "GET":
            # Get current user
            try:
                user = get_current_user()
                return jsonify({"current_user": user})
            except Exception as e:
                return jsonify({"error": "Failed to get current user"}), 500
        
        elif request.method == "POST":
            # Set current user
            data = request.json
            username = data.get('username')
            
            if not username:
                return jsonify({"error": "Username is required"}), 400
            
            try:
                set_current_user(username)
                return jsonify({"status": "ok", "current_user": username})
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception as e:
                return jsonify({"error": "Failed to set current user"}), 500
