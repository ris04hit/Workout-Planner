// =========================
// MOBILE & TOUCH INTERACTIONS
// =========================

/**
 * Mobile and touch interaction enhancements
 */
export class MobileEnhancements {
  constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isMobile = window.innerWidth <= 768;
    this.swipeThreshold = 50;
    this.longPressThreshold = 500;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.longPressTimer = null;
    
    this.init();
  }

  /**
   * Initialize mobile enhancements
   */
  init() {
    if (this.isTouchDevice) {
      this.addTouchSupport();
      this.addSwipeGestures();
      this.addLongPressSupport();
      this.optimizeForMobile();
    }
    
    // Handle resize events
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768;
      this.handleResize();
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.handleOrientationChange(), 100);
    });
  }

  /**
   * Add basic touch support
   */
  addTouchSupport() {
    // Remove hover effects on touch devices
    document.body.classList.add('touch-device');
    
    // Add touch feedback to interactive elements
    const interactiveElements = document.querySelectorAll('button, .card, .template-card, .summary-card');
    
    interactiveElements.forEach(element => {
      element.addEventListener('touchstart', (e) => {
        element.classList.add('touch-active');
      }, { passive: true });
      
      element.addEventListener('touchend', (e) => {
        setTimeout(() => {
          element.classList.remove('touch-active');
        }, 150);
      }, { passive: true });
      
      element.addEventListener('touchcancel', (e) => {
        element.classList.remove('touch-active');
      }, { passive: true });
    });
  }

  /**
   * Add swipe gestures for navigation
   */
  addSwipeGestures() {
    const cards = document.querySelectorAll('.collapsible-card');
    
    cards.forEach(card => {
      card.addEventListener('touchstart', (e) => {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
      }, { passive: true });
      
      card.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchEndTime = Date.now();
        
        const deltaX = touchEndX - this.touchStartX;
        const deltaY = touchEndY - this.touchStartY;
        const deltaTime = touchEndTime - this.touchStartTime;
        
        // Check if it's a horizontal swipe
        if (Math.abs(deltaX) > this.swipeThreshold && 
            Math.abs(deltaY) < this.swipeThreshold && 
            deltaTime < 300) {
          
          if (deltaX > 0) {
            this.handleSwipeRight(card);
          } else {
            this.handleSwipeLeft(card);
          }
        }
      }, { passive: true });
    });
  }

  /**
   * Add long press support for context menus
   */
  addLongPressSupport() {
    const workoutEntries = document.querySelectorAll('.workout-entry');
    
    workoutEntries.forEach(entry => {
      entry.addEventListener('touchstart', (e) => {
        this.longPressTimer = setTimeout(() => {
          this.handleLongPress(entry, e);
        }, this.longPressThreshold);
      }, { passive: true });
      
      entry.addEventListener('touchend', (e) => {
        clearTimeout(this.longPressTimer);
      }, { passive: true });
      
      entry.addEventListener('touchmove', (e) => {
        clearTimeout(this.longPressTimer);
      }, { passive: true });
    });
  }

  /**
   * Optimize interface for mobile
   */
  optimizeForMobile() {
    if (this.isMobile) {
      // Add mobile-specific classes
      document.body.classList.add('mobile-view');
      
      // Optimize scrolling
      this.optimizeScrolling();
      
      // Handle virtual keyboard
      this.handleVirtualKeyboard();
      
      // Add pull-to-refresh
      this.addPullToRefresh();
    }
  }

  /**
   * Optimize scrolling performance
   */
  optimizeScrolling() {
    // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Optimize scroll containers
    const scrollContainers = document.querySelectorAll('.modal-content, .tab-content');
    
    scrollContainers.forEach(container => {
      container.style.webkitOverflowScrolling = 'touch';
      container.style.overflowY = 'auto';
    });
  }

  /**
   * Handle virtual keyboard appearance
   */
  handleVirtualKeyboard() {
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      input.addEventListener('focus', (e) => {
        // Scroll input into view
        setTimeout(() => {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
        
        // Add focused class
        document.body.classList.add('keyboard-open');
      });
      
      input.addEventListener('blur', (e) => {
        // Remove focused class
        document.body.classList.remove('keyboard-open');
      });
    });
  }

  /**
   * Add pull-to-refresh functionality
   */
  addPullToRefresh() {
    let startY = 0;
    let isPulling = false;
    const pullThreshold = 80;
    
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      if (deltaY > pullThreshold) {
        document.body.classList.add('pull-to-refresh');
      }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      if (document.body.classList.contains('pull-to-refresh')) {
        document.body.classList.remove('pull-to-refresh');
        this.handlePullToRefresh();
      }
      isPulling = false;
    }, { passive: true });
  }

  /**
   * Handle swipe right gesture
   */
  handleSwipeRight(card) {
    // Could be used for navigation or expanding cards
  }

  /**
   * Handle swipe left gesture
   */
  handleSwipeLeft(card) {
    // Could be used for navigation or collapsing cards
  }

  /**
   * Handle long press gesture
   */
  handleLongPress(element, event) {
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Show context menu or quick actions
    this.showContextMenu(element, event);
  }

  /**
   * Show context menu for long press
   */
  showContextMenu(element, event) {
    // Remove existing context menus
    const existingMenu = document.querySelector('.touch-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'touch-context-menu';
    
    // Add menu items based on element type
    if (element.classList.contains('workout-entry')) {
      menu.innerHTML = `
        <button class="context-menu-item" onclick="editWorkout('${element.dataset.id}')">
          ✏️ Edit Workout
        </button>
        <button class="context-menu-item" onclick="deleteWorkout('${element.dataset.id}')">
          🗑️ Delete Workout
        </button>
        <button class="context-menu-item" onclick="exportWorkoutAsTemplate('${element.dataset.id}')">
          📤 Export as Template
        </button>
      `;
    }
    
    // Position menu
    const rect = element.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '1000';
    
    document.body.appendChild(menu);
    
    // Close menu when tapping outside
    setTimeout(() => {
      document.addEventListener('click', () => {
        menu.remove();
      }, { once: true });
    }, 100);
  }

  /**
   * Handle pull-to-refresh
   */
  handlePullToRefresh() {
    // Refresh current data
    if (window.loadHistory) {
      window.loadHistory();
    }
    if (window.loadSuggestion) {
      window.loadSuggestion();
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.isMobile) {
      document.body.classList.add('mobile-view');
    } else {
      document.body.classList.remove('mobile-view');
    }
  }

  /**
   * Handle orientation change
   */
  handleOrientationChange() {
    // Adjust layouts for landscape/portrait
    const modals = document.querySelectorAll('.modal-content');
    modals.forEach(modal => {
      if (window.innerHeight < window.innerWidth) {
        // Landscape mode
        modal.style.maxHeight = '85vh';
      } else {
        // Portrait mode
        modal.style.maxHeight = '90vh';
      }
    });
  }

  /**
   * Add haptic feedback
   */
  static vibrate(pattern = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  /**
   * Check if device is in standalone mode (PWA)
   */
  static isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  /**
   * Get safe area insets for notched devices
   */
  static getSafeAreaInsets() {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
    };
  }
}

/**
 * Initialize mobile enhancements when DOM is ready
 */
let mobileEnhancements = null;

document.addEventListener('DOMContentLoaded', () => {
  mobileEnhancements = new MobileEnhancements();
});

// Export for global access
window.MobileEnhancements = MobileEnhancements;
window.vibrate = MobileEnhancements.vibrate;
