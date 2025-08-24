# Development Context & State

## Project Overview
**The Lawless Directory** - Modern business directory platform with "Find it here. Not everywhere." positioning.

## Current Development Context

### Existing Assets
**High-Value Prototype**: 
- **HTML**: Modern semantic structure with performance optimizations
- **CSS**: 880 lines of sophisticated styling with glassmorphism effects, custom scrollbars, responsive grid layouts
- **JavaScript**: 861 lines of advanced functionality including search suggestions, mobile gestures, intersection observers, performance monitoring

**Key Prototype Features**:
- Advanced search with real-time suggestions
- Category filtering with smooth animations
- Business card hover effects and modal system
- Mobile gesture support (swipe actions)
- Performance monitoring and lazy loading
- Accessibility features (keyboard shortcuts, focus management)

### Architecture Transition
**From**: Vanilla HTML/CSS/JavaScript prototype  
**To**: Next.js 14+ with Supabase backend

**Migration Strategy**:
- Preserve all sophisticated UI/UX patterns
- Convert CSS variables to Tailwind + CSS-in-JS hybrid approach
- Migrate JavaScript classes to React components with TypeScript
- Maintain performance optimizations (Intersection Observer, lazy loading)

### Database Schema (Supabase)
```sql
-- Core tables to be implemented:
- businesses (id, name, description, category, location, rating, premium_tier)
- users (id, email, role, subscription_tier, created_at)
- reviews (id, business_id, user_id, rating, content, verified)
- subscriptions (id, user_id, tier, status, stripe_subscription_id)
- api_keys (id, user_id, key_hash, permissions, usage_limit)
```

### Current Sprint Focus
**Epic 1: Public Directory MVP Migration**
- Priority: Migrate existing prototype to Next.js with database integration
- Preserve: All animations, glassmorphism effects, mobile gestures
- Enhance: Add real search functionality, database-driven content

### Testing Strategy
- **Unit Tests**: Jest for component logic and utility functions
- **E2E Tests**: Playwright for user workflows and prototype feature validation
- **Performance**: Maintain existing Lighthouse 90+ scores
- **Mobile**: Test all existing gesture interactions

### Key Technical Decisions
1. **Hybrid Styling**: Tailwind for utilities + CSS modules for complex animations
2. **State Management**: Zustand for client state, Supabase for server state
3. **Performance**: Maintain existing optimization patterns (lazy loading, intersection observers)
4. **Mobile**: Preserve all sophisticated touch interactions and responsive behavior

## Development Readiness
- 📋 **Planning**: Complete (62 stories, 6 epics)
- 🎨 **Design System**: Established (color palette, typography, components)  
- 💻 **Prototype**: Advanced (sophisticated features ready for migration)
- 🏗️ **Architecture**: Defined (Next.js + Supabase + Vercel)
- 🧪 **Testing Strategy**: Specified (TDD with Playwright + Jest)

**Status**: Ready to begin Epic 1 development with prototype migration as foundation.