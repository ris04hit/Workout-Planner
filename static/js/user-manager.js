// =========================
// MULTI-USER SUPPORT SYSTEM
// =========================

/**
 * Multi-user management system for workout planner
 */
export class UserManager {
  constructor() {
    this.currentUser = null;
    this.usersPath = '/api/users';
    this.init();
  }

  /**
   * Initialize user manager
   */
  async init() {
    const users = await this.getUsers();
    
    // If no users exist, force user creation
    if (users.length === 0) {
      this.showForceUserCreationModal();
      return;
    }
    
    // Get current user from localStorage or URL parameter
    let currentUser = localStorage.getItem('workout_current_user');
    
    // Try to get from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('user')) {
      currentUser = urlParams.get('user');
    }
    
    // If no current user, get first available user
    if (!currentUser) {
      currentUser = users[0]; // Get first available user
    }
    
    if (currentUser) {
      // Set current user directly without validation for initialization
      this.currentUser = currentUser;
      localStorage.setItem('workout_current_user', currentUser);
      
      // Update URL without page reload
      const url = new URL(window.location);
      url.searchParams.set('user', currentUser);
      window.history.replaceState({}, '', url);
      
      // Reload data for current user
      await this.reloadUserData();
    }
    
    // Add user switcher to UI
    this.addUserSwitcher();
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Switch to a different user
   */
  async switchUser(username) {
    
    try {
      // Validate user exists
      const users = await this.getUsers();
      
      if (!users.includes(username)) {
        throw new Error(`User '${username}' does not exist`);
      }

      // Set user context via API
      const response = await fetch('/api/current-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });


      if (!response.ok) {
        const error = await response.json();
        throw new Error('Failed to switch user on server');
      }

      this.currentUser = username;
      localStorage.setItem('workout_current_user', username);
      
      // Update URL without page reload
      const url = new URL(window.location);
      url.searchParams.set('user', username);
      window.history.replaceState({}, '', url);
      
      // Reload data for new user
      await this.reloadUserData();
      
      // Close modal
      document.querySelector('.modal-overlay')?.remove();
      
      this.showNotification(`Switched to user: ${username}`, 'success');
      return true;
    } catch (error) {
      this.showNotification('Failed to switch user', 'error');
      return false;
    }
  }

  /**
   * Create a new user
   */
  async createUser(username, copyFromDefault = true) {
    try {
      
      // Validate username
      if (!username || username.trim().length === 0) {
        throw new Error('Username cannot be empty');
      }
      
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }

      const users = await this.getUsers();
      
      if (users.includes(username)) {
        throw new Error(`User '${username}' already exists`);
      }

      // Create user via API
      const payload = {
        username,
        copy_from_default: copyFromDefault
      };
      
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const result = await response.json();

      // Switch to new user
      await this.switchUser(username);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get list of all users (excluding default)
   */
  async getUsers() {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const users = await response.json();
      // Filter out default user from UI
      return users.filter(user => user !== 'default');
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(username) {
    try {
      if (username === this.currentUser) {
        throw new Error('Cannot delete currently logged in user');
      }

      const response = await fetch(`/api/users/${username}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Show user selection modal
   */
  async showUserSelection() {
    const users = await this.getUsers();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Select User</h3>
        </div>
        <div class="modal-body">
          <div class="user-selection">
            <div class="existing-users">
              <h4>Existing Users</h4>
              <div class="user-list">
                ${users.length > 0 ? users.map(user => `
                  <button class="user-button" onclick="userManager.switchUser('${user}')">
                    <span class="user-icon">👤</span>
                    <span class="user-name">${user}</span>
                  </button>
                `).join('') : '<p>No existing users found</p>'}
              </div>
            </div>
            
            <div class="create-user">
              <h4>Create New User</h4>
              <div id="create-user-form">
                <div class="form-group">
                  <label for="new-username">Username:</label>
                  <input type="text" id="new-username" required 
                         title="Letters, numbers, underscores, and hyphens only"
                         placeholder="Enter username"
                         style="max-width: 250px;">
                </div>
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="copy-muscle-groups" checked>
                    Copy exercise library from default user
                  </label>
                </div>
                <button type="button" class="btn btn-primary" onclick="userManager.handleCreateUser(event)">Create User</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on username input
    setTimeout(() => {
      document.getElementById('new-username')?.focus();
    }, 100);
  }

  /**
   * Show force user creation modal when no users exist
   */
  showForceUserCreationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
  
    modal.innerHTML = `
      <div class="modal-content" style="
        background: white;
        padding: 2rem;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        text-align: center;
      ">
        <h2 style="margin-bottom: 1rem; color: #333;">Welcome to Workout Planner</h2>
        <p style="margin-bottom: 1.5rem; color: #666;">No users exist yet. Please create your first user to get started.</p>
        <div class="create-user">
          <div id="force-create-user-form">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label for="force-new-username" style="display: block; margin-bottom: 0.5rem; text-align: left;">Username:</label>
              <input type="text" id="force-new-username" required 
                     title="Letters, numbers, underscores, and hyphens only"
                     placeholder="Enter username"
                     style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div class="form-group" style="margin-bottom: 1.5rem; text-align: left;">
              <label>
                <input type="checkbox" id="force-copy-muscle-groups" checked>
                Copy exercise library from default user
              </label>
            </div>
            <button type="button" class="btn btn-primary" onclick="userManager.handleForceCreateUser(event)" 
                    style="background: #007bff; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer;">
              Create User & Start
            </button>
          </div>
        </div>
      </div>
    `;
  
    document.body.appendChild(modal);
  
    // Focus on username input
    setTimeout(() => {
      document.getElementById('force-new-username').focus();
    }, 100);
  }

  /**
   * Handle forced user creation from welcome modal
   */
  async handleForceCreateUser(event) {
  
    const username = document.getElementById('force-new-username').value.trim();
    const copyFromDefault = document.getElementById('force-copy-muscle-groups').checked;
  
  
    if (!username) {
            this.showNotification('Username cannot be empty', 'error');
      return;
    }
  
    try {
      await this.createUser(username, copyFromDefault);
  
      // Close modal
      const modalOverlay = document.querySelector('.modal-overlay');
      if (modalOverlay) {
        modalOverlay.remove();
      }
  
      // Show success message
      this.showNotification(`Welcome! User '${username}' created successfully!`, 'success');
  
      // Re-initialize the user manager with the new user
      await this.init();
      
      // Reload muscles data for the new user
      if (window.loadMuscles) {
        await window.loadMuscles();
      }
      
      // Reload suggestion data 
      if (window.loadSuggestion) {
        await window.loadSuggestion();
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  /**
   * Handle create user button click
   */
  async handleCreateUser(event) {
    
    const username = document.getElementById('new-username').value.trim();
    const copyFromDefault = document.getElementById('copy-muscle-groups').checked;
    
    
    if (!username) {
            this.showNotification('Username cannot be empty', 'error');
      return;
    }
    
    try {
      await this.createUser(username, copyFromDefault);
      
      // Close modal
      document.querySelector('.modal-overlay')?.remove();
      
      // Show success message
      this.showNotification(`User '${username}' created successfully!`, 'success');
      
      // Reload muscles data for the new user
      if (window.loadMuscles) {
        await window.loadMuscles();
      }
      
      // Reload suggestion data 
      if (window.loadSuggestion) {
        await window.loadSuggestion();
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  /**
   * Get default exercise library
   */
  async getDefaultMuscleGroups() {
    try {
      const response = await fetch('/api/exercises');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
    }
    
    // Fallback to standard patterns
    return ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  }

  /**
   * Reload user data
   */
  async reloadUserData() {
    // Trigger data reload in main application
    if (window.loadHistory) {
      await window.loadHistory();
    }
    if (window.loadSuggestion) {
      await window.loadSuggestion();
    }
    if (window.loadConfig) {
      await window.loadConfig();
    }
    if (window.loadMuscles) {
      await window.loadMuscles();
    }
    
    // Update UI to show current user
    this.updateCurrentUserDisplay();
  }

  /**
   * Update current user display in UI
   */
  updateCurrentUserDisplay() {
    let userDisplay = document.getElementById('current-user-display');
    
    if (!userDisplay) {
      // Create user display if it doesn't exist
      userDisplay = document.createElement('div');
      userDisplay.id = 'current-user-display';
      userDisplay.className = 'current-user-display';
      
      // Add to header or top of page
      const header = document.querySelector('h1') || document.body;
      header.parentNode.insertBefore(userDisplay, header.nextSibling);
    }
    
    if (this.currentUser) {
      userDisplay.innerHTML = `
        <div class="user-info">
          <span class="user-label">Current User:</span>
          <span class="user-name">${this.currentUser}</span>
          <button class="btn btn-small" onclick="userManager.showUserSelection()">Switch</button>
        </div>
      `;
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  /**
   * Add user switcher to navigation
   */
  addUserSwitcher() {
    const nav = document.querySelector('nav') || document.querySelector('.container');
    if (!nav) return;
    
    const switcher = document.createElement('div');
    switcher.className = 'user-switcher';
    switcher.innerHTML = `
      <button class="btn btn-small" onclick="userManager.showUserSelection()">
        👤 ${this.currentUser || 'Select User'}
      </button>
    `;
    
    nav.appendChild(switcher);
  }
}

// Initialize user manager
let userManager = null;

document.addEventListener('DOMContentLoaded', () => {
  userManager = new UserManager();
  // Make sure it's available globally after initialization
  window.userManager = userManager;
});

// Export for global access
window.UserManager = UserManager;
