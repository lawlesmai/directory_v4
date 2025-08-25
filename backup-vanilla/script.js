// The Lawless Directory - Enhanced Interactive Features

class LawlessDirectory {
    constructor() {
        this.init();
        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.setupSearchFunctionality();
        this.setupFilterFunctionality();
    }

    init() {
        // Initialize page load animation
        this.setupPageLoadAnimation();
        
        // Initialize business card animations with delays
        this.initializeCardAnimations();
        
        // Initialize mobile-specific features
        this.initializeMobileFeatures();
    }

    setupPageLoadAnimation() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.6s ease-out';
        
        // Ensure fonts are loaded before showing content
        document.fonts.ready.then(() => {
            setTimeout(() => {
                document.body.style.opacity = '1';
                console.log('🏢 The Lawless Directory loaded successfully!');
            }, 100);
        });
    }

    initializeCardAnimations() {
        // Set animation delays for staggered reveals
        const cards = document.querySelectorAll('.business-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 150}ms`;
        });
    }

    setupEventListeners() {
        // Enhanced smooth scrolling for navigation links
        this.setupSmoothScrolling();
        
        // Search button functionality
        this.setupSearchButton();
        
        // Filter chip interactions
        this.setupFilterChips();
        
        // View toggle functionality
        this.setupViewToggle();
        
        // Business card interactions
        this.setupBusinessCardInteractions();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Haptic feedback for mobile
        this.setupHapticFeedback();
    }

    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    setupSearchButton() {
        const searchBtn = document.querySelector('.search-btn');
        const searchInput = document.querySelector('.search-input');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput.value.trim();
                if (query) {
                    this.performSearch(query);
                } else {
                    searchInput.focus();
                }
            });
        }
    }

    setupSearchFunctionality() {
        const searchInput = document.querySelector('.search-input');
        const searchSuggestions = document.querySelector('.search-suggestions');
        
        if (!searchInput || !searchSuggestions) return;

        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const value = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                if (value.length >= 2) {
                    this.showSearchSuggestions(value, searchSuggestions);
                } else {
                    this.hideSearchSuggestions(searchSuggestions);
                }
            }, 300);
        });

        // Handle Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch(e.target.value.trim());
                this.hideSearchSuggestions(searchSuggestions);
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSearchSuggestions(searchSuggestions);
            }
        });
    }

    showSearchSuggestions(query, container) {
        // Simulate search suggestions (would connect to real API)
        const suggestions = [
            `🔍 "${query}" in Restaurants`,
            `🔍 "${query}" in Professional Services`,
            `🔍 "${query}" in Health & Beauty`,
            `📍 "${query}" near me`,
            `⭐ Top rated "${query}" businesses`
        ];

        container.innerHTML = suggestions
            .map(suggestion => `<div class="suggestion" tabindex="0">${suggestion}</div>`)
            .join('');
        
        container.classList.add('active');

        // Add click handlers to suggestions
        container.querySelectorAll('.suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                document.querySelector('.search-input').value = query;
                this.performSearch(query);
                this.hideSearchSuggestions(container);
            });

            // Keyboard navigation for suggestions
            suggestion.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    suggestion.click();
                }
            });
        });
    }

    hideSearchSuggestions(container) {
        container.classList.remove('active');
        setTimeout(() => {
            container.innerHTML = '';
        }, 300);
    }

    performSearch(query) {
        console.log(`🔍 Searching for: "${query}"`);
        
        // Simulate search loading
        this.showSearchLoading();
        
        // In a real implementation, this would make an API call
        setTimeout(() => {
            this.hideSearchLoading();
            this.displaySearchResults(query);
        }, 1000);
    }

    showSearchLoading() {
        const businessGrid = document.querySelector('.business-grid');
        const listingsHeader = document.querySelector('.listings-header h2');
        
        if (listingsHeader) {
            listingsHeader.textContent = 'Searching...';
        }
        
        // Add skeleton loading cards
        if (businessGrid) {
            const existingCards = businessGrid.querySelectorAll('.business-card:not(.skeleton-card)');
            existingCards.forEach(card => card.style.opacity = '0.3');
        }
    }

    hideSearchLoading() {
        const listingsHeader = document.querySelector('.listings-header h2');
        const businessGrid = document.querySelector('.business-grid');
        
        if (listingsHeader) {
            listingsHeader.textContent = '127 Businesses Near You';
        }
        
        if (businessGrid) {
            const existingCards = businessGrid.querySelectorAll('.business-card:not(.skeleton-card)');
            existingCards.forEach(card => card.style.opacity = '1');
        }
    }

    displaySearchResults(query) {
        // Simulate search results update
        console.log(`📊 Displaying results for: "${query}"`);
        
        // Add a subtle success animation
        const businessGrid = document.querySelector('.business-grid');
        if (businessGrid) {
            businessGrid.style.animation = 'none';
            setTimeout(() => {
                businessGrid.style.animation = '';
            }, 10);
        }
    }

    setupFilterChips() {
        const filterChips = document.querySelectorAll('.filter-chip');
        
        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                // Remove active class from all chips
                filterChips.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked chip
                chip.classList.add('active');
                
                const category = chip.textContent.trim();
                this.filterBusinesses(category);
            });
        });
    }

    filterBusinesses(category) {
        console.log(`🏷️ Filtering by category: ${category}`);
        
        // Simulate filtering animation
        const cards = document.querySelectorAll('.business-card:not(.skeleton-card)');
        
        cards.forEach((card, index) => {
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0.7';
            
            setTimeout(() => {
                card.style.transform = 'scale(1)';
                card.style.opacity = '1';
            }, index * 50 + 200);
        });
        
        // Update results count
        const listingsHeader = document.querySelector('.listings-header h2');
        if (listingsHeader && category !== 'All') {
            listingsHeader.textContent = `${Math.floor(Math.random() * 50) + 10} ${category} Near You`;
        } else {
            listingsHeader.textContent = '127 Businesses Near You';
        }
    }

    setupViewToggle() {
        const viewBtns = document.querySelectorAll('.view-btn');
        const listingsPanel = document.querySelector('.listings-panel');
        const mapPanel = document.querySelector('.map-panel');
        
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const isMapView = btn.textContent.includes('🗺️');
                
                if (window.innerWidth <= 1200) {
                    // Mobile/tablet behavior
                    if (isMapView) {
                        listingsPanel.style.display = 'none';
                        mapPanel.style.display = 'block';
                        mapPanel.style.height = '70vh';
                    } else {
                        listingsPanel.style.display = 'block';
                        mapPanel.style.display = 'none';
                    }
                }
            });
        });
    }

    setupBusinessCardInteractions() {
        const businessCards = document.querySelectorAll('.business-card:not(.skeleton-card)');
        
        businessCards.forEach(card => {
            // Enhanced hover effects
            card.addEventListener('mouseenter', () => {
                this.playCardHoverSound();
                card.style.zIndex = '10';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.zIndex = '1';
            });
            
            // Click to view details
            card.addEventListener('click', () => {
                const businessName = card.querySelector('h3').textContent;
                this.showBusinessDetails(businessName, card);
            });
            
            // Action button handlers
            this.setupActionButtons(card);
        });
    }

    setupActionButtons(card) {
        const actionBtns = card.querySelectorAll('.action-btn');
        
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                
                const action = btn.textContent.trim();
                const businessName = card.querySelector('h3').textContent;
                
                this.handleActionClick(action, businessName);
            });
        });
    }

    handleActionClick(action, businessName) {
        console.log(`🎯 Action: ${action} for ${businessName}`);
        
        // Simulate different actions
        switch(true) {
            case action.includes('Call'):
                this.simulateCall(businessName);
                break;
            case action.includes('Website') || action.includes('Menu'):
                this.simulateWebsiteVisit(businessName);
                break;
            case action.includes('Directions'):
                this.simulateDirections(businessName);
                break;
        }
    }

    simulateCall(businessName) {
        this.showNotification(`📞 Calling ${businessName}...`);
    }

    simulateWebsiteVisit(businessName) {
        this.showNotification(`🌐 Opening ${businessName} website...`);
    }

    simulateDirections(businessName) {
        this.showNotification(`🗺️ Getting directions to ${businessName}...`);
    }

    showBusinessDetails(businessName, cardElement) {
        console.log(`📋 Showing details for: ${businessName}`);
        
        // Create and show modal (simplified version)
        const modal = this.createBusinessModal(businessName, cardElement);
        document.body.appendChild(modal);
        
        // Animate modal appearance
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    }

    createBusinessModal(businessName, cardElement) {
        const modal = document.createElement('div');
        modal.className = 'business-modal';
        
        const rating = cardElement.querySelector('.rating-text').textContent;
        const category = cardElement.querySelector('.category').textContent;
        const description = cardElement.querySelector('.description').textContent;
        const imgSrc = cardElement.querySelector('img').src;
        
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <button class="modal-close">✕</button>
                <div class="modal-header">
                    <img src="${imgSrc}" alt="${businessName}" class="modal-image">
                    <div class="modal-info">
                        <h2>${businessName}</h2>
                        <p class="modal-rating">${rating}</p>
                        <p class="modal-category">${category}</p>
                    </div>
                </div>
                <div class="modal-body">
                    <p>${description}</p>
                    <div class="modal-actions">
                        <button class="action-btn primary">📞 Call Now</button>
                        <button class="action-btn">🌐 Visit Website</button>
                        <button class="action-btn">📍 Get Directions</button>
                        <button class="action-btn">⭐ Write Review</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal styles dynamically
        this.addModalStyles();
        
        // Close modal functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal(modal);
        });
        
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.closeModal(modal);
        });
        
        return modal;
    }

    addModalStyles() {
        if (document.querySelector('#modal-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .business-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .business-modal.active {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 18, 25, 0.9);
                backdrop-filter: blur(10px);
            }
            
            .modal-content {
                position: relative;
                max-width: 600px;
                margin: 5% auto;
                background: var(--gradient-dark);
                border-radius: var(--radius-xl);
                border: 1px solid var(--color-border);
                overflow: hidden;
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s ease;
            }
            
            .business-modal.active .modal-content {
                transform: scale(1) translateY(0);
            }
            
            .modal-close {
                position: absolute;
                top: var(--space-lg);
                right: var(--space-lg);
                background: transparent;
                border: none;
                color: var(--color-text-secondary);
                font-size: var(--text-xl);
                cursor: pointer;
                z-index: 10;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                transition: var(--transition-base);
            }
            
            .modal-close:hover {
                background: var(--color-teal-20);
                color: var(--color-cream);
            }
            
            .modal-header {
                padding: var(--space-xl);
                border-bottom: 1px solid var(--color-border);
            }
            
            .modal-image {
                width: 100%;
                height: 200px;
                object-fit: cover;
                border-radius: var(--radius-lg);
                margin-bottom: var(--space-lg);
            }
            
            .modal-info h2 {
                font-family: var(--font-family-heading);
                color: var(--color-cream);
                margin-bottom: var(--space-sm);
            }
            
            .modal-rating, .modal-category {
                color: var(--color-text-secondary);
                margin-bottom: var(--space-xs);
            }
            
            .modal-body {
                padding: var(--space-xl);
            }
            
            .modal-actions {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-md);
                margin-top: var(--space-xl);
            }
        `;
        
        document.head.appendChild(styles);
    }

    closeModal(modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('.search-input');
                if (searchInput) {
                    searchInput.focus();
                }
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.business-modal.active');
                if (activeModal) {
                    this.closeModal(activeModal);
                }
            }
        });
    }

    setupHapticFeedback() {
        // Add haptic feedback for mobile devices
        if ('vibrate' in navigator) {
            const interactiveElements = document.querySelectorAll('button, .business-card, .filter-chip');
            
            interactiveElements.forEach(element => {
                element.addEventListener('click', () => {
                    navigator.vibrate(10);
                });
            });
        }
    }

    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    
                    // Staggered animation for multiple elements
                    const delay = entry.target.dataset.delay || 0;
                    entry.target.style.animationDelay = `${delay}ms`;
                }
            });
        }, observerOptions);

        // Observe all business cards and other animated elements
        document.querySelectorAll('.business-card, .trust-stat, .footer-section').forEach((element, index) => {
            element.dataset.delay = index * 50;
            observer.observe(element);
        });
    }

    initializeMobileFeatures() {
        // Touch gesture support for business cards
        const cards = document.querySelectorAll('.business-card');
        
        cards.forEach(card => {
            let touchStartX = 0;
            let touchEndX = 0;
            
            card.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });
            
            card.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe(card, touchStartX, touchEndX);
            });
        });
        
        // Responsive navigation adjustments
        this.setupResponsiveNavigation();
    }

    handleSwipe(card, startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - show quick actions
                this.showQuickActions(card);
            } else {
                // Swipe right - bookmark/favorite
                this.toggleFavorite(card);
            }
        }
    }

    showQuickActions(card) {
        console.log('📱 Showing quick actions for mobile');
        // Add quick action overlay
        const businessName = card.querySelector('h3').textContent;
        this.showNotification(`Quick actions for ${businessName}`);
    }

    toggleFavorite(card) {
        const businessName = card.querySelector('h3').textContent;
        console.log(`❤️ Toggling favorite for ${businessName}`);
        this.showNotification(`Added ${businessName} to favorites!`);
    }

    setupResponsiveNavigation() {
        // Handle responsive navigation behavior
        const handleResize = () => {
            const navContainer = document.querySelector('.nav-container');
            const splitView = document.querySelector('.split-view');
            
            if (window.innerWidth <= 768) {
                navContainer.classList.add('mobile');
                splitView.classList.add('mobile');
            } else {
                navContainer.classList.remove('mobile');
                splitView.classList.remove('mobile');
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
    }

    playCardHoverSound() {
        // Subtle audio feedback (would use actual audio in production)
        // For now, just a console log to indicate the interaction
        if (Math.random() > 0.9) { // Only occasionally log to avoid spam
            console.log('🔊 Card hover sound effect');
        }
    }

    showNotification(message) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--gradient-premium);
            color: var(--color-navy-dark);
            padding: var(--space-md) var(--space-lg);
            border-radius: var(--radius-full);
            font-weight: var(--font-semibold);
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: var(--shadow-lg);
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Enhanced parallax effect with performance optimization
class ParallaxManager {
    constructor() {
        this.elements = [];
        this.ticking = false;
        this.init();
    }

    init() {
        // Find parallax elements
        this.elements = [
            {
                element: document.querySelector('.gradient-bg'),
                speed: 0.5
            }
        ];

        if (this.elements[0].element) {
            window.addEventListener('scroll', () => this.requestTick());
        }
    }

    updateParallax() {
        const scrolled = window.pageYOffset;
        
        this.elements.forEach(({ element, speed }) => {
            if (element) {
                const yPos = -(scrolled * speed);
                element.style.transform = `translate3d(0, ${yPos}px, 0)`;
            }
        });
        
        this.ticking = false;
    }

    requestTick() {
        if (!this.ticking) {
            requestAnimationFrame(() => this.updateParallax());
            this.ticking = true;
        }
    }
}

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTime: 0,
            domReady: 0,
            firstPaint: 0
        };
        this.init();
    }

    init() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            this.metrics.loadTime = performance.now();
            this.reportMetrics();
        });

        // Monitor DOM ready
        document.addEventListener('DOMContentLoaded', () => {
            this.metrics.domReady = performance.now();
        });

        // Monitor first paint (if supported)
        if ('getEntriesByType' in performance) {
            const paintEntries = performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            if (firstPaint) {
                this.metrics.firstPaint = firstPaint.startTime;
            }
        }
    }

    reportMetrics() {
        console.log('📊 Performance Metrics:', {
            'Load Time': `${this.metrics.loadTime.toFixed(2)}ms`,
            'DOM Ready': `${this.metrics.domReady.toFixed(2)}ms`,
            'First Paint': `${this.metrics.firstPaint.toFixed(2)}ms`
        });
    }
}

// Form validation utility (for future forms)
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;
    const errors = [];

    inputs.forEach(input => {
        const value = input.value.trim();
        
        if (!value) {
            isValid = false;
            input.style.borderColor = 'var(--color-red-error)';
            errors.push(`${input.name || input.placeholder} is required`);
        } else {
            input.style.borderColor = 'var(--color-sage)';
        }
        
        // Email validation
        if (input.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                input.style.borderColor = 'var(--color-red-error)';
                errors.push('Please enter a valid email address');
            }
        }
    });

    return { isValid, errors };
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main application
    const app = new LawlessDirectory();
    
    // Initialize parallax manager
    const parallax = new ParallaxManager();
    
    // Initialize performance monitoring
    const monitor = new PerformanceMonitor();
    
    // Store references globally for debugging
    window.LawlessApp = {
        directory: app,
        parallax: parallax,
        performance: monitor
    };
});

// Service worker registration for offline functionality (future enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Will register service worker in future iterations
        console.log('🔧 Service Worker support detected');
    });
}