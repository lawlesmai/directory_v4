# The Lawless Directory - Frontend Architecture Document

## Change Log

| Date       | Version | Description                           | Author              |
|------------|---------|---------------------------------------|-------------------- |
| 2024-08-23 | 1.0     | Initial UI architecture documentation | Winston (Architect) |

## Template and Framework Selection

### Current Implementation Choice

**Framework Decision:** Vanilla JavaScript (No Framework)  
**Rationale:** POC implementation prioritizing rapid prototyping, minimal dependencies, and maximum flexibility for future framework adoption.

**Key Architectural Benefits:**
- Zero framework lock-in - easy migration path to React, Vue, or Angular
- Minimal bundle size and fastest load times
- Direct DOM manipulation for maximum performance control
- Clean, transferable patterns that work across any future framework

**Implementation Constraints:**
- Manual state management (DOM-based)
- No built-in component system
- Direct event handling and DOM manipulation
- Static data structure (HTML-based)

## Frontend Tech Stack

### Technology Stack Table

| Category           | Technology        | Version | Purpose                           | Rationale                                    |
|-------------------|-------------------|---------|-----------------------------------|----------------------------------------------|
| Runtime           | Browser (Vanilla) | ES6+    | Core application execution        | Maximum compatibility, zero dependencies     |
| HTML              | HTML5             | -       | Semantic document structure       | Accessibility, SEO, clean markup            |
| CSS               | CSS3              | -       | Styling and responsive design     | Custom properties, modern layouts           |
| JavaScript        | Vanilla JS        | ES6+    | Application logic and interactions| Class-based OOP, modern browser APIs        |
| State Management  | DOM-based         | -       | Application state                 | Simple, transparent, no additional complexity|
| Routing           | None              | -       | Single page application           | Static implementation, no routing needed     |
| Build Tool        | None              | -       | Direct file serving               | Simplicity, fast development cycles         |
| Styling           | CSS Custom Props  | -       | Design system implementation      | Modern CSS, scalable design tokens          |
| Testing           | Jest              | ^29.0.0 | Unit testing framework            | Industry standard, Node.js compatibility    |
| Component Pattern | CSS Classes       | -       | Reusable UI patterns              | BEM-like methodology, maintainable styles   |
| Animation         | CSS3 + RAF        | -       | Performance-optimized animations  | Hardware acceleration, smooth 60fps         |
| Dev Tools         | ESLint            | ^9.0.0  | Code quality and consistency      | Modern JavaScript linting standards          |

## Project Structure

```plaintext
directory_v4/
├── index.html                    # Main application entry point
├── styles.css                    # Complete CSS design system
├── script.js                     # JavaScript application logic
├── package.json                  # Development dependencies only
├── package-lock.json            # Dependency lock file
├── eslint.config.js             # Code quality configuration
├── script.test.js               # Jest test suite
├── CLAUDE.md                    # AI agent instructions
├── README.md                    # Project documentation
└── docs/                        # Documentation directory
    ├── brownfield-architecture.md  # Main architecture document
    ├── ui-architecture.md          # This document
    ├── state-docs/                # Current state analysis
    │   ├── 2024-08-23-01-architecture-overview.md
    │   ├── 2024-08-23-02-css-design-system.md
    │   ├── 2024-08-23-03-ux-behavior-patterns.md
    │   ├── 2024-08-23-04-javascript-architecture.md
    │   ├── 2024-08-23-05-mobile-responsive-design.md
    │   ├── 2024-08-23-06-performance-optimizations.md
    │   └── 2024-08-23-07-visual-hierarchy-trust.md
    ├── design/                     # Design specifications
    │   ├── color-palette.md
    │   ├── color-code.md
    │   └── ui-inspiration.md
    └── rules/                      # Development standards
        ├── coding-standards.md
        ├── documentation.md
        └── [other rule files]
```

### File Organization Principles

1. **Single File Responsibility**: Each file has a clear, focused purpose
2. **Flat Structure**: Minimal nesting for easy navigation
3. **Documentation Co-location**: Docs alongside source code
4. **Future Framework Ready**: Structure easily adaptable to component-based frameworks

## Component Standards

### Component Implementation Pattern

The application uses CSS class-based "components" with JavaScript class methods for behavior:

```typescript
// Conceptual TypeScript representation of current vanilla implementation
interface BusinessCardComponent {
  element: HTMLDivElement;
  data: BusinessCardData;
  
  // Visual states
  hover(): void;
  click(): void;
  setLoading(): void;
  setPremium(): void;
  
  // Interactions  
  showActions(): void;
  toggleFavorite(): void;
  openModal(): void;
}

// Actual vanilla implementation pattern
class LawlessDirectory {
  setupBusinessCardInteractions() {
    const businessCards = document.querySelectorAll('.business-card:not(.skeleton-card)');
    
    businessCards.forEach(card => {
      // Hover effects
      card.addEventListener('mouseenter', () => this.handleCardHover(card));
      
      // Click handlers
      card.addEventListener('click', () => this.handleCardClick(card));
      
      // Action buttons
      this.setupActionButtons(card);
    });
  }
  
  handleCardHover(card: HTMLElement) {
    this.playCardHoverSound();
    card.style.zIndex = '10';
  }
}
```

### Naming Conventions

**CSS Class Naming (BEM-inspired):**
- **Block**: `.business-card`, `.search-container`, `.filter-bar`
- **Element**: `.business-card__image`, `.business-card__title`
- **Modifier**: `.business-card--premium`, `.search-container--active`

**JavaScript Naming:**
- **Classes**: PascalCase (`LawlessDirectory`, `ParallaxManager`)
- **Methods**: camelCase (`setupEventListeners`, `handleSwipe`)
- **Variables**: camelCase (`searchTimeout`, `touchStartX`)
- **Constants**: UPPER_CASE (`SWIPE_THRESHOLD`, `ANIMATION_DURATION`)

**HTML Attribute Naming:**
- **Data attributes**: `data-category`, `data-rating`, `data-business-id`
- **CSS classes**: lowercase with hyphens (`business-card`, `premium-badge`)

## State Management

### Current State Management Pattern

**State Storage:** DOM-based state management using:
- HTML data attributes for business data
- CSS classes for visual state
- JavaScript variables for temporary state

```typescript
// State management pattern
class LawlessDirectory {
  private state: {
    currentFilter: string;
    searchQuery: string;
    activeModal: HTMLElement | null;
    performanceMetrics: PerformanceMetrics;
  };
  
  // State updates through DOM manipulation
  updateFilter(category: string) {
    // Remove active class from all filters
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.remove('active');
    });
    
    // Add active class to selected filter  
    document.querySelector(`[data-filter="${category}"]`)?.classList.add('active');
    
    // Update internal state
    this.state.currentFilter = category;
  }
}
```

### Store Structure (Future Framework Migration)

```plaintext
Future State Structure (for framework migration):
src/
├── store/
│   ├── index.js              # Store configuration
│   ├── slices/
│   │   ├── businessSlice.js  # Business data and filtering
│   │   ├── searchSlice.js    # Search state and results
│   │   ├── uiSlice.js        # UI state (modals, loading)
│   │   └── userSlice.js      # User preferences and auth
│   └── middleware/
│       └── apiMiddleware.js  # API integration layer
```

### State Management Template (Future Implementation)

```typescript
// Template for future framework state management
interface AppState {
  businesses: {
    items: Business[];
    filteredItems: Business[];
    activeFilter: string;
    loading: boolean;
  };
  
  search: {
    query: string;
    suggestions: string[];
    results: Business[];
    loading: boolean;
  };
  
  ui: {
    activeModal: string | null;
    sidebarOpen: boolean;
    theme: 'light' | 'dark';
  };
  
  user: {
    preferences: UserPreferences;
    favorites: string[];
    authenticated: boolean;
  };
}

// Current vanilla implementation approximation
const AppStateManager = {
  getCurrentFilter(): string {
    return document.querySelector('.filter-chip.active')?.textContent || 'All';
  },
  
  setFilter(category: string): void {
    // DOM manipulation for state update
  },
  
  getSearchQuery(): string {
    return (document.querySelector('.search-input') as HTMLInputElement)?.value || '';
  }
};
```

## API Integration

### Current Implementation (Static Data)

The application currently uses static HTML data with placeholders for future API integration:

```typescript
// Current static data pattern
interface BusinessCardData {
  name: string;
  category: string; 
  rating: number;
  description: string;
  image: string;
  premium: boolean;
  verified: boolean;
  trustIndicators: string[];
}

// API integration points identified in code
class LawlessDirectory {
  async performSearch(query: string): Promise<void> {
    this.showSearchLoading();
    
    // TODO: Replace with actual API call
    // const results = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    // const businesses = await results.json();
    
    // Current: Simulate API delay and show static results
    setTimeout(() => {
      this.displaySearchResults(query);
      this.hideSearchLoading();
    }, 800);
  }
}
```

### Service Template (Future API Integration)

```typescript
// API service template for future implementation
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  reviewCount: number;
  image: string;
  location: {
    address: string;
    coordinates: [number, number];
  };
  contact: {
    phone?: string;
    website?: string;
    email?: string;
  };
  features: {
    premium: boolean;
    verified: boolean;
    topRated: boolean;
    localBusiness: boolean;
    familyOwned: boolean;
  };
}

class BusinessService {
  private apiUrl = '/api/v1';
  
  async searchBusinesses(query: string, filters?: SearchFilters): Promise<ApiResponse<Business[]>> {
    try {
      const params = new URLSearchParams({ q: query, ...filters });
      const response = await fetch(`${this.apiUrl}/businesses/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Search businesses error:', error);
      throw error;
    }
  }
  
  async getBusinessById(id: string): Promise<ApiResponse<Business>> {
    try {
      const response = await fetch(`${this.apiUrl}/businesses/${id}`);
      return await response.json();
    } catch (error) {
      console.error('Get business error:', error);
      throw error;
    }
  }
}
```

### API Client Configuration

```typescript
// HTTP client configuration for future implementation
class ApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options,
    };
    
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
  
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }
  
  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
```

## Routing

### Current Implementation (Single Page)

The application currently operates as a single-page application with no routing:

```typescript
// Current navigation pattern
class LawlessDirectory {
  // Modal-based navigation
  showBusinessDetails(businessName: string, cardElement: HTMLElement): void {
    const modal = this.createBusinessModal(businessName, cardElement);
    document.body.appendChild(modal);
    
    // Update URL without page reload (future enhancement)
    // history.pushState({ business: businessName }, '', `/business/${businessName}`);
  }
  
  // State-based view switching
  toggleView(view: 'list' | 'map'): void {
    const listPanel = document.querySelector('.listings-panel');
    const mapPanel = document.querySelector('.map-panel');
    
    if (view === 'map') {
      listPanel?.classList.add('hidden');
      mapPanel?.classList.remove('hidden');
    } else {
      listPanel?.classList.remove('hidden');  
      mapPanel?.classList.add('hidden');
    }
  }
}
```

### Route Configuration (Future Implementation)

```typescript
// Future routing configuration template
interface RouteConfig {
  path: string;
  component: string;
  title: string;
  meta?: {
    requiresAuth?: boolean;
    description?: string;
  };
}

const routes: RouteConfig[] = [
  {
    path: '/',
    component: 'HomePage',
    title: 'Lawless Directory - Find Local Businesses',
    meta: { description: 'Discover trusted local businesses in your area' }
  },
  {
    path: '/business/:id',
    component: 'BusinessDetailPage', 
    title: 'Business Details - Lawless Directory',
    meta: { description: 'View detailed business information and reviews' }
  },
  {
    path: '/search',
    component: 'SearchResultsPage',
    title: 'Search Results - Lawless Directory',
    meta: { description: 'Browse search results for local businesses' }
  },
  {
    path: '/category/:category',
    component: 'CategoryPage',
    title: 'Category Listings - Lawless Directory', 
    meta: { description: 'Browse businesses by category' }
  }
];

// Route handler for future implementation
class Router {
  private routes: Map<string, RouteConfig> = new Map();
  
  constructor(routes: RouteConfig[]) {
    routes.forEach(route => this.routes.set(route.path, route));
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }
  
  navigate(path: string): void {
    history.pushState(null, '', path);
    this.render(path);
  }
  
  private handlePopState(): void {
    this.render(window.location.pathname);
  }
  
  private render(path: string): void {
    // Route matching and component rendering logic
  }
}
```

## Styling Guidelines

### Styling Approach

The application uses a **CSS Custom Properties (CSS Variables) design system** with a **glass morphism** aesthetic:

**Core Methodology:**
1. **Design Tokens**: Centralized CSS custom properties for consistency
2. **Mobile-First**: Responsive design starting from 320px mobile
3. **Glass Morphism**: Backdrop blur, transparency, and layered effects
4. **Performance-First**: Hardware-accelerated animations and optimized selectors

**Architecture Principles:**
```css
/* Design Token Organization */
:root {
  /* Color System */
  --color-sage: #9CA986;           /* Primary brand */
  --color-forest: #6B8A3A;         /* Secondary */
  --color-cream: #F5F2E8;          /* Background */
  
  /* Glass Morphism System */
  --glass-background: rgba(255, 255, 255, 0.25);
  --glass-border: rgba(255, 255, 255, 0.18);
  --glass-backdrop: blur(20px);
  
  /* Spacing System */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
}
```

### Global Theme Variables

```css
/* Complete Design System */
:root {
  /* === COLOR PALETTE === */
  /* Primary Colors */
  --color-sage: #9CA986;
  --color-forest: #6B8A3A;
  --color-cream: #F5F2E8;
  --color-earth: #8B7355;
  --color-sunset: #E8A87C;
  --color-terracotta: #C65D7B;
  --color-dusty-blue: #7B9BB3;
  --color-lavender: #A8A2D3;
  --color-pale-yellow: #F7E7A1;
  --color-soft-pink: #E8C4C7;

  /* UI Colors */
  --color-white: #FFFFFF;
  --color-black: #000000;
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* State Colors */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Glass Morphism System */
  --glass-background: rgba(255, 255, 255, 0.25);
  --glass-background-dark: rgba(0, 0, 0, 0.25);
  --glass-border: rgba(255, 255, 255, 0.18);
  --glass-backdrop: blur(20px);
  --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);

  /* === TYPOGRAPHY === */
  --font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-secondary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  /* Font Sizes */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */

  /* Font Weights */
  --weight-light: 300;
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* === SPACING === */
  --spacing-0: 0;
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */
  --spacing-3xl: 4rem;     /* 64px */

  /* === BORDERS === */
  --border-radius-sm: 0.375rem;   /* 6px */
  --border-radius-md: 0.5rem;     /* 8px */
  --border-radius-lg: 0.75rem;    /* 12px */
  --border-radius-xl: 1rem;       /* 16px */
  --border-radius-2xl: 1.5rem;    /* 24px */
  --border-radius-full: 9999px;

  /* === SHADOWS === */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  /* === ANIMATIONS === */
  --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --transition-fast: all 0.15s ease-out;
  --transition-slow: all 0.6s ease-in-out;

  /* === RESPONSIVE BREAKPOINTS === */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  /* === Z-INDEX SCALE === */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
  --z-toast: 1080;
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  :root {
    --color-cream: #1a1a1a;
    --color-white: #ffffff;
    --glass-background: rgba(0, 0, 0, 0.25);
    --glass-border: rgba(255, 255, 255, 0.1);
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-smooth: none;
    --transition-bounce: none;
    --transition-fast: none;
    --transition-slow: none;
  }
  
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Testing Requirements

### Current Test Setup

**Testing Framework:** Jest with basic configuration
**Test Structure:** Single test file (`script.test.js`) with expansion capacity

```typescript
// Current test patterns
describe('LawlessDirectory', () => {
  let app: LawlessDirectory;
  
  beforeEach(() => {
    document.body.innerHTML = ''; // Clean DOM
    app = new LawlessDirectory();
  });
  
  test('should initialize without errors', () => {
    expect(app).toBeDefined();
  });
  
  test('should setup event listeners', () => {
    const spy = jest.spyOn(app, 'setupEventListeners');
    app.init();
    expect(spy).toHaveBeenCalled();
  });
});
```

### Component Test Template

```typescript
// Test template for business card interactions
describe('Business Card Interactions', () => {
  let mockBusinessCard: HTMLElement;
  
  beforeEach(() => {
    // Setup mock DOM structure
    document.body.innerHTML = `
      <div class="business-card" data-category="restaurant" data-rating="4.8">
        <h3>Test Restaurant</h3>
        <div class="rating-text">4.8 ⭐</div>
        <div class="category">Restaurant</div>
        <div class="description">Great food and service</div>
        <img src="test.jpg" alt="Test" />
      </div>
    `;
    
    mockBusinessCard = document.querySelector('.business-card') as HTMLElement;
  });
  
  test('should handle card hover events', () => {
    const app = new LawlessDirectory();
    const hoverSpy = jest.spyOn(app, 'playCardHoverSound');
    
    // Simulate hover
    mockBusinessCard.dispatchEvent(new Event('mouseenter'));
    
    expect(hoverSpy).toHaveBeenCalled();
    expect(mockBusinessCard.style.zIndex).toBe('10');
  });
  
  test('should open modal on card click', () => {
    const app = new LawlessDirectory();
    const modalSpy = jest.spyOn(app, 'showBusinessDetails');
    
    // Simulate click
    mockBusinessCard.click();
    
    expect(modalSpy).toHaveBeenCalledWith('Test Restaurant', mockBusinessCard);
  });
  
  test('should handle mobile swipe gestures', () => {
    const app = new LawlessDirectory();
    const swipeSpy = jest.spyOn(app, 'handleSwipe');
    
    // Simulate touch events
    const touchStart = new TouchEvent('touchstart', {
      changedTouches: [{ screenX: 100 } as Touch]
    });
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [{ screenX: 200 } as Touch]
    });
    
    mockBusinessCard.dispatchEvent(touchStart);
    mockBusinessCard.dispatchEvent(touchEnd);
    
    expect(swipeSpy).toHaveBeenCalledWith(mockBusinessCard, 100, 200);
  });
});

// Performance monitoring tests
describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  
  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });
  
  test('should track load metrics', () => {
    expect(monitor.metrics).toBeDefined();
    expect(monitor.metrics.loadTime).toBe(0);
  });
  
  test('should report metrics after page load', (done) => {
    const reportSpy = jest.spyOn(monitor, 'reportMetrics');
    
    // Simulate load event
    window.dispatchEvent(new Event('load'));
    
    setTimeout(() => {
      expect(reportSpy).toHaveBeenCalled();
      expect(monitor.metrics.loadTime).toBeGreaterThan(0);
      done();
    }, 100);
  });
});

// CSS animation tests
describe('Animation System', () => {
  test('should apply filter animation', (done) => {
    const app = new LawlessDirectory();
    const card = document.createElement('div');
    card.className = 'business-card';
    document.body.appendChild(card);
    
    app.filterBusinesses('restaurant');
    
    // Check initial animation state
    expect(card.style.transform).toBe('scale(0.95)');
    expect(card.style.opacity).toBe('0.7');
    
    // Check final state after animation
    setTimeout(() => {
      expect(card.style.transform).toBe('scale(1)');
      expect(card.style.opacity).toBe('1');
      done();
    }, 300);
  });
});
```

### Testing Best Practices

1. **Unit Tests**: Test individual class methods in isolation
2. **Integration Tests**: Test component interactions and event flows
3. **Performance Tests**: Validate animation timing and load performance
4. **Accessibility Tests**: Ensure keyboard navigation and screen reader support
5. **Mobile Tests**: Test touch gestures and responsive behavior
6. **Coverage Goals**: Aim for 80% code coverage across all JavaScript classes
7. **Test Structure**: Follow Arrange-Act-Assert (AAA) pattern
8. **Mock External Dependencies**: Browser APIs, performance metrics, audio feedback

## Environment Configuration

### Current Configuration

The application requires minimal configuration as a static frontend:

```bash
# No environment variables required for current implementation
# Development dependencies managed through package.json

# Future API integration will require:
VITE_API_URL=http://localhost:3001/api/v1
VITE_APP_NAME="Lawless Directory"
VITE_GA_TRACKING_ID=GA_TRACKING_ID_HERE
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_MAP_API_KEY=your_map_api_key_here

# Production environment
VITE_API_URL=https://api.lawlessdirectory.com/v1
VITE_APP_NAME="Lawless Directory"
VITE_GA_TRACKING_ID=GA_TRACKING_ID_HERE
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_MAP_API_KEY=your_production_map_api_key
```

### Development Scripts

```json
{
  "scripts": {
    "start": "npx http-server . -p 3000",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint script.js",
    "lint:fix": "eslint script.js --fix",
    "build": "echo 'No build required - static files'",
    "serve": "npx http-server . -p 8080"
  }
}
```

## Frontend Developer Standards

### Critical Coding Rules

1. **Class-Based Architecture**: All functionality organized in ES6 classes
2. **Event Delegation**: Use efficient event handling patterns
3. **Performance First**: Always use requestAnimationFrame for animations
4. **Mobile-First CSS**: Start with mobile styles, enhance for desktop
5. **Semantic HTML**: Use proper HTML5 semantic elements
6. **Accessibility**: Include ARIA labels and keyboard navigation
7. **CSS Custom Properties**: Use design tokens consistently
8. **Hardware Acceleration**: Use `translate3d()` for transform animations
9. **Lazy Loading**: Implement lazy loading for images and heavy content
10. **Progressive Enhancement**: Ensure basic functionality works without JavaScript

### Framework-Specific Rules (Vanilla JavaScript)

1. **DOM Ready**: Always wait for `DOMContentLoaded` before initialization
2. **Event Cleanup**: Remove event listeners when no longer needed
3. **Memory Management**: Avoid circular references and memory leaks
4. **Error Handling**: Wrap async operations in try-catch blocks
5. **Type Safety**: Use JSDoc comments for type documentation
6. **Modular Code**: Separate concerns into distinct class methods
7. **Browser Compatibility**: Use modern APIs with fallbacks
8. **Performance Monitoring**: Include timing measurements for critical paths

### Quick Reference

```bash
# Development Commands
npm start              # Start local dev server on port 3000
npm test               # Run Jest test suite
npm run lint           # Run ESLint checks
npm run test:watch     # Run tests in watch mode

# Key File Patterns
index.html             # Main entry point - HTML structure
styles.css             # Design system - all styling
script.js              # Application logic - all JavaScript
script.test.js         # Test suite - Jest tests

# Common Code Patterns
.addEventListener()    # Event handling
requestAnimationFrame()# Smooth animations  
document.querySelector()# DOM element selection
classList.add/remove() # CSS class manipulation
setTimeout()           # Delayed execution

# CSS Class Naming
.component-name        # Block (main component)
.component-name__element  # Element (child of component)
.component-name--modifier # Modifier (variation of component)

# JavaScript Method Naming
setupFeatureName()     # Initialization methods
handleEventName()      # Event handler methods
showComponentName()    # UI display methods
hideComponentName()    # UI hide methods
toggleFeatureName()    # State toggle methods
```

---

This UI Architecture document provides comprehensive guidance for working with the current vanilla JavaScript implementation while preparing for future framework migration. It captures the actual patterns and standards used in the codebase while providing templates for common enhancement patterns.