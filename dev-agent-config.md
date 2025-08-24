# Development Agent Configuration

## Project: The Lawless Directory
**Version**: 1.0  
**Last Updated**: 2025-08-23

## Agent Operating Parameters

### Core Responsibilities
- **Primary Focus**: TDD-driven development following the 6-epic roadmap
- **Code Quality**: Maintain existing sophisticated UI/UX patterns and performance optimizations
- **Architecture**: Migrate vanilla JS prototype to Next.js + Supabase while preserving advanced features
- **Testing**: Playwright + Jest integration as specified in CLAUDE.md

### Development Approach
1. **Test-First Development**: Every story begins with comprehensive test planning
2. **Prototype Preservation**: Build upon existing 880-line CSS and 861-line JavaScript foundation
3. **Progressive Enhancement**: Migrate sophisticated features (glassmorphism, animations, mobile gestures) to production stack
4. **Iterative Testing Loop**: Maximum 10 testing iterations per story as specified

### Key Constraints
- **Technology Stack**: Next.js 14+, Supabase, TypeScript, Tailwind CSS, Vercel deployment
- **Design System**: Preserve existing color palette, typography (Poppins/Inter), and glassmorphism effects
- **Performance**: Maintain Lighthouse 90+ scores from existing prototype
- **Mobile-First**: Continue sophisticated mobile gesture support and responsive design

### Branch Strategy
- **Pattern**: `Epic-StoryName` (e.g., `Epic1-SearchMigration`)
- **Process**: New branch per story → Develop → Test → Merge → Sync
- **Integration**: Use GitHub MCP tools for branch management

### Quality Gates
- **Code**: ESLint, TypeScript strict mode, security best practices
- **Testing**: Unit (Jest) + E2E (Playwright) coverage
- **Performance**: Core Web Vitals compliance
- **Accessibility**: WCAG 2.1 Level AA compliance

### Epic Priority Order
1. **Epic 1**: Public Directory MVP (prototype migration)
2. **Epic 2**: Authentication & Authorization Layer  
3. **Epic 3**: Full-Featured Business Portal
4. **Epic 4**: Platform Admin Portal
5. **Epic 5**: Sales & Payment Funnel
6. **Epic 6**: Public API

## Current State Assessment
- ✅ **UI Prototype**: Advanced vanilla JS implementation with sophisticated features
- ✅ **Documentation**: Complete PRD, Architecture, and UI/UX specifications
- ✅ **Epic Planning**: 62 stories across 6 epics, 24 sprint timeline
- 🔄 **Next Phase**: Begin Epic 1 prototype migration to Next.js production stack