// =========================
// KEYBOARD SHORTCUTS & ACCESSIBILITY
// =========================

/**
 * Keyboard shortcuts and accessibility enhancements
 */
export class AccessibilityManager {
  constructor() {
    this.shortcuts = new Map();
    this.focusTrapElements = [];
    this.currentFocusTrap = null;
    this.announcer = null;
    this.init();
  }

  /**
   * Initialize accessibility features
   */
  init() {
        this.setupKeyboardShortcuts();
    this.setupFocusManagement();
    this.setupScreenReaderSupport();
    this.setupAriaLabels();
    this.setupSkipLinks();
    this.createAnnouncer();
    this.setupHighContrastMode();
    this.setupReducedMotion();
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    // Navigation shortcuts
    this.addShortcut('h', () => this.focusSection('history'), 'Go to History');
    this.addShortcut('a', () => this.focusSection('analytics-dashboard'), 'Go to Analytics');
    this.addShortcut('c', () => this.focusSection('config'), 'Go to Configuration');
    
    // Action shortcuts
    this.addShortcut('n', () => this.createNewWorkout(), 'New Workout');
    this.addShortcut('s', () => this.saveWorkout(), 'Save Workout');
    this.addShortcut('e', () => this.showExportImport(), 'Export/Import');
    this.addShortcut('r', () => this.refreshData(), 'Refresh Data');
    
    // Modal shortcuts
    this.addShortcut('Escape', () => this.closeModal(), 'Close Modal');
    this.addShortcut('Enter', () => this.activateFocused(), 'Activate Focused Element');
    
    // Accessibility shortcuts
    this.addShortcut('/', () => this.showShortcutsHelp(), 'Show Shortcuts Help');
    this.addShortcut('?', () => this.showShortcutsHelp(), 'Show Shortcuts Help');
    this.addShortcut('alt+H', () => this.toggleHighContrast(), 'Toggle High Contrast');
    this.addShortcut('alt+R', () => this.toggleReducedMotion(), 'Toggle Reduced Motion');
    
    // Form navigation
    this.addShortcut('Tab', () => this.handleTabNavigation(), 'Navigate Form');
    this.addShortcut('Shift+Tab', () => this.handleShiftTabNavigation(), 'Navigate Backwards');
  }

  /**
   * Add a keyboard shortcut
   */
  addShortcut(key, handler, description) {
    const normalizedKey = key.toLowerCase();
    this.shortcuts.set(normalizedKey, { handler, description });
  }

  /**
   * Handle keyboard events
   */
  handleKeyboardEvent(event) {
    const key = this.getShortcutKey(event);
    
    // Skip if key is null or undefined
    if (!key) {
      return;
    }
    
    const shortcut = this.shortcuts.get(key);
    
    
    if (shortcut) {
      // Only block shortcuts for single letters when actually typing in input fields
      // Allow modifier shortcuts (Alt+, Ctrl+, etc.) and special keys (? / Esc) to work always
      const isTypingKey = key.length === 1 && !this.isModifierKey(key);
      const targetElement = event.target || document.activeElement;
      const isActuallyTyping = this.isInputElement(targetElement) && document.activeElement === targetElement;
      
      if (isTypingKey && isActuallyTyping) {
        return;
      }
      
      event.preventDefault();
      event.stopPropagation();
      
      try {
        shortcut.handler();
        this.announce(shortcut.description);
      } catch (error) {
        this.announce('Action failed');
      }
    }
  }

  /**
   * Get normalized shortcut key
   */
  getShortcutKey(event) {
    // Handle cases where event.key might be undefined
    if (!event || !event.key) {
      return null;
    }
    
    let key = event.key.toLowerCase();
    
    if (event.altKey) key = 'alt+' + key;
    if (event.ctrlKey) key = 'ctrl+' + key;
    if (event.shiftKey) key = 'shift+' + key;
    if (event.metaKey) key = 'meta+' + key;
    
    return key;
  }

  /**
   * Check if element is an input
   */
  isInputElement(element) {
    const inputTypes = ['input', 'textarea', 'select'];
    return inputTypes.includes(element.tagName.toLowerCase()) || 
           element.contentEditable === 'true' || 
           element.isContentEditable;
  }

  /**
   * Check if key is a modifier
   */
  isModifierKey(key) {
    return key.includes('alt+') || key.includes('ctrl+') || 
           key.includes('shift+') || key.includes('meta+');
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    
    // Add keyboard event listener with capture to ensure it works globally
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardEvent(e);
    }, true); // Use capture phase
    
    // Manage focus in modals
    document.addEventListener('focusin', (e) => this.handleFocusIn(e));
    
    // Add visible focus indicators
    this.addFocusStyles();
    
  }

  /**
   * Handle focus events for focus trapping
   */
  handleFocusIn(event) {
    if (this.currentFocusTrap && !this.currentFocusTrap.contains(event.target)) {
      const focusableElements = this.getFocusableElements(this.currentFocusTrap);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        event.preventDefault();
      }
    }
  }

  /**
   * Get focusable elements within a container
   */
  getFocusableElements(container) {
    const selectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];
    
    return Array.from(container.querySelectorAll(selectors.join(', ')))
      .filter(element => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    // Add ARIA live regions
    this.setupLiveRegions();
    
    // Add role attributes
    this.addRoleAttributes();
    
    // Add descriptive labels
    this.addDescriptiveLabels();
  }

  /**
   * Setup ARIA live regions
   */
  setupLiveRegions() {
    // Status updates
    const statusRegion = document.createElement('div');
    statusRegion.setAttribute('aria-live', 'polite');
    statusRegion.setAttribute('aria-atomic', 'true');
    statusRegion.className = 'sr-only';
    statusRegion.id = 'status-region';
    document.body.appendChild(statusRegion);
    
    // Error messages
    const errorRegion = document.createElement('div');
    errorRegion.setAttribute('aria-live', 'assertive');
    errorRegion.setAttribute('aria-atomic', 'true');
    errorRegion.className = 'sr-only';
    errorRegion.id = 'error-region';
    document.body.appendChild(errorRegion);
  }

  /**
   * Add role attributes to elements
   */
  addRoleAttributes() {
    // Main navigation
    const mainNav = document.querySelector('nav, .navigation');
    if (mainNav) {
      mainNav.setAttribute('role', 'navigation');
      mainNav.setAttribute('aria-label', 'Main navigation');
    }
    
    // Main content
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('role', 'main');
    }
    
    // Forms
    document.querySelectorAll('form').forEach(form => {
      if (!form.getAttribute('aria-label')) {
        form.setAttribute('aria-label', 'Form');
      }
    });
    
    // Buttons without text
    document.querySelectorAll('button:empty, button[title]').forEach(button => {
      const title = button.getAttribute('title') || button.textContent;
      if (title) {
        button.setAttribute('aria-label', title);
      }
    });
  }

  /**
   * Add descriptive labels
   */
  addDescriptiveLabels() {
    // Workout entries
    document.querySelectorAll('.workout-entry').forEach(entry => {
      const date = entry.querySelector('.workout-date')?.textContent;
      const exercises = entry.querySelectorAll('.exercise-item').length;
      entry.setAttribute('aria-label', `Workout from ${date} with ${exercises} exercises`);
    });
    
  }

  /**
   * Setup ARIA labels for dynamic content
   */
  setupAriaLabels() {
    // Add labels to interactive elements
    this.addDynamicLabels();
    
    // Monitor for new elements
    this.observeContentChanges();
  }

  /**
   * Add labels to dynamic content
   */
  addDynamicLabels() {
    // Exercise sets
    document.querySelectorAll('.set-row').forEach((set, index) => {
      const exerciseName = set.closest('.exercise-item')?.querySelector('.exercise-name')?.textContent;
      set.setAttribute('aria-label', `Set ${index + 1} for ${exerciseName}`);
    });
    
    // Charts and graphs
    document.querySelectorAll('.chart-container').forEach(chart => {
      const title = chart.querySelector('h4, .chart-title')?.textContent;
      chart.setAttribute('role', 'img');
      chart.setAttribute('aria-label', title || 'Chart');
    });
  }

  /**
   * Monitor content changes for accessibility
   */
  observeContentChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.addAccessibilityToNode(node);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Add accessibility to new nodes
   */
  addAccessibilityToNode(node) {
    // Add labels to new workout entries
    if (node.classList?.contains('workout-entry')) {
      this.addDescriptiveLabels();
    }
    
    // Process child nodes
    if (node.querySelectorAll) {
      node.querySelectorAll('.workout-entry, .set-row').forEach(element => {
        this.addAccessibilityToNode(element);
      });
    }
  }

  /**
   * Setup skip links
   */
  setupSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#history" class="skip-link">Skip to history</a>
    `;
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * Create screen reader announcer
   */
  createAnnouncer() {
    this.announcer = document.getElementById('status-region');
  }

  /**
   * Announce message to screen readers
   */
  announce(message, priority = 'polite') {
    const region = priority === 'assertive' ? 
      document.getElementById('error-region') : 
      this.announcer;
    
    if (region) {
      region.textContent = message;
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }
  }

  /**
   * Setup high contrast mode
   */
  setupHighContrastMode() {
    // Check for saved preference
    const savedPreference = localStorage.getItem('high-contrast');
    if (savedPreference === 'true') {
      document.body.classList.add('high-contrast');
    }
    
    // Check system preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      document.body.classList.add('high-contrast');
    }
  }

  /**
   * Setup reduced motion
   */
  setupReducedMotion() {
    // Check for saved preference
    const savedPreference = localStorage.getItem('reduced-motion');
    if (savedPreference === 'true') {
      document.body.classList.add('reduced-motion');
    }
    
    // Check system preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.add('reduced-motion');
    }
  }

  /**
   * Add focus styles
   */
  addFocusStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Enhanced focus indicators */
      button:focus,
      input:focus,
      select:focus,
      textarea:focus,
      a:focus,
      [tabindex]:focus {
        outline: 3px solid #4a90e2 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 5px rgba(74, 144, 226, 0.2) !important;
      }
      
      /* Skip links */
      .skip-links {
        position: absolute;
        top: -40px;
        left: 0;
        z-index: 1000;
      }
      
      .skip-link {
        position: absolute;
        top: 0;
        left: 0;
        background: #4a90e2;
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 0 0 4px 0;
        font-weight: bold;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
      }
      
      .skip-link:focus {
        transform: translateY(0);
      }
      
      /* Screen reader only content */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      
      /* High contrast mode */
      .high-contrast {
        filter: contrast(1.5);
      }
      
      .high-contrast button,
      .high-contrast .card {
        border: 2px solid #000 !important;
      }
      
      /* Reduced motion */
      .reduced-motion *,
      .reduced-motion *::before,
      .reduced-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Shortcut action methods
  focusSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      
      // Make section focusable temporarily
      section.setAttribute('tabindex', '-1');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Focus after a small delay to ensure scrolling is complete
      setTimeout(() => {
        section.focus();
        
        // Remove tabindex after focusing
        setTimeout(() => {
          section.removeAttribute('tabindex');
        }, 100);
      }, 300);
      
      // Also try to open the parent collapsible card if it exists
      const parentCard = section.closest('.collapsible-card');
      if (parentCard && !parentCard.hasAttribute('open')) {
        parentCard.setAttribute('open', '');
      }
    } else {
    }
  }

  createNewWorkout() {
    if (window.loadSuggestion) {
      window.loadSuggestion();
      this.announce('New workout created');
    }
  }

  saveWorkout() {
    if (window.saveWorkout) {
      window.saveWorkout();
      this.announce('Saving workout');
    }
  }

  showExportImport() {
    if (window.showExportImportModal) {
      window.showExportImportModal();
      this.announce('Export import modal opened');
    }
  }

  refreshData() {
    if (window.loadHistory) {
      window.loadHistory();
      this.announce('Data refreshed');
    }
  }

  closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
      modal.remove();
      this.announce('Modal closed');
    }
  }

  activateFocused() {
    const focused = document.activeElement;
    if (focused && focused.tagName === 'BUTTON') {
      focused.click();
    }
  }

  showShortcutsHelp() {
    this.showShortcutsModal();
  }

  toggleHighContrast() {
    document.body.classList.toggle('high-contrast');
    const isEnabled = document.body.classList.contains('high-contrast');
    localStorage.setItem('high-contrast', isEnabled.toString());
    this.announce(`High contrast ${isEnabled ? 'enabled' : 'disabled'}`);
  }

  toggleReducedMotion() {
    document.body.classList.toggle('reduced-motion');
    const isEnabled = document.body.classList.contains('reduced-motion');
    localStorage.setItem('reduced-motion', isEnabled.toString());
    this.announce(`Reduced motion ${isEnabled ? 'enabled' : 'disabled'}`);
  }

  handleTabNavigation() {
    // Let default tab behavior work
  }

  handleShiftTabNavigation() {
    // Let default shift+tab behavior work
  }

  /**
   * Show shortcuts help modal
   */
  showShortcutsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="shortcuts-grid">
            <h4>Navigation</h4>
            <div class="shortcut-item">
              <kbd>H</kbd> <span>Go to History</span>
            </div>
            <div class="shortcut-item">
              <kbd>A</kbd> <span>Go to Analytics</span>
            </div>
            <div class="shortcut-item">
              <kbd>C</kbd> <span>Go to Configuration</span>
            </div>
            
            <h4>Actions</h4>
            <div class="shortcut-item">
              <kbd>N</kbd> <span>New Workout</span>
            </div>
            <div class="shortcut-item">
              <kbd>S</kbd> <span>Save Workout</span>
            </div>
            <div class="shortcut-item">
              <kbd>E</kbd> <span>Export/Import</span>
            </div>
            <div class="shortcut-item">
              <kbd>R</kbd> <span>Refresh Data</span>
            </div>
            
            <h4>Accessibility</h4>
            <div class="shortcut-item">
              <kbd>?</kbd> <span>Show Help</span>
            </div>
            <div class="shortcut-item">
              <kbd>Alt</kbd> + <kbd>H</kbd> <span>Toggle High Contrast</span>
            </div>
            <div class="shortcut-item">
              <kbd>Alt</kbd> + <kbd>R</kbd> <span>Toggle Reduced Motion</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd> <span>Close Modal</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus management for modal
    const modalContent = modal.querySelector('.modal-content');
    this.trapFocus(modalContent);
    
    // Auto-focus close button
    modal.querySelector('.modal-close').focus();
    
    this.announce('Keyboard shortcuts help opened');
  }

  /**
   * Trap focus within a container
   */
  trapFocus(container) {
    this.currentFocusTrap = container;
    
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
    
    // Remove focus trap when modal is closed
    const observer = new MutationObserver((mutations) => {
      if (!document.body.contains(container)) {
        this.currentFocusTrap = null;
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize accessibility manager
let accessibilityManager = null;

document.addEventListener('DOMContentLoaded', () => {
  accessibilityManager = new AccessibilityManager();
});

// Export for global access
window.AccessibilityManager = AccessibilityManager;
window.announce = (message, priority) => {
  if (accessibilityManager) {
    accessibilityManager.announce(message, priority);
  }
};
