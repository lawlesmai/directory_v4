# Supabase Database Setup Guide

This guide walks you through setting up the complete Supabase database for the Lawless Directory application.

## Overview

The database architecture includes:
- **3 core tables**: `businesses`, `categories`, `business_reviews`
- **2 supporting tables**: `user_roles`, `business_managers`
- **Performance indexes**: B-tree, GIN, and GIST indexes
- **Row Level Security**: Comprehensive RLS policies
- **Database functions**: Custom PostgreSQL functions for optimization
- **Seed data**: Sample businesses and categories for development

## Quick Setup

### Automated Setup (Recommended)
```bash
npm run db:setup
```

This script will:
1. Install Supabase CLI if needed
2. Initialize Supabase project
3. Start local Supabase services
4. Apply all migrations
5. Generate TypeScript types

### Manual Setup

1. **Install Supabase CLI**
   ```bash
   npm install supabase --save-dev
   ```

2. **Start Supabase**
   ```bash
   npx supabase start
   ```

3. **Apply Migrations**
   ```bash
   npx supabase db reset
   ```

4. **Generate Types**
   ```bash
   npm run supabase:types
   ```

## Database Schema

### Core Tables

#### `businesses`
Primary table storing all business information:
- **Identity**: `id`, `slug`, `name`, `legal_name`
- **Categorization**: `primary_category_id`, `secondary_categories`, `tags`
- **Contact**: `phone`, `email`, `website`
- **Location**: `address`, `city`, `state`, `location` (PostGIS geography)
- **Business Details**: `description`, `business_hours`, `year_established`
- **Media**: `logo_url`, `cover_image_url`, `gallery`
- **Verification**: `verification_status`, `quality_score`
- **Subscription**: `subscription_tier`, `premium_features`
- **Analytics**: `view_count`, `click_count`, `save_count`

#### `categories`
Hierarchical category system:
- **Identity**: `id`, `slug`, `name`, `description`
- **Hierarchy**: `parent_id`, `level`, `path`, `children_count`
- **Display**: `icon`, `color`, `sort_order`, `featured`
- **Metadata**: `business_count`, `meta_title`, `meta_description`

#### `business_reviews`
User reviews and ratings:
- **Core**: `business_id`, `reviewer_id`, `rating`, `content`
- **Metadata**: `visit_date`, `verification_type`
- **Media**: `photos`, `videos`
- **Engagement**: `helpful_count`, `not_helpful_count`
- **Moderation**: `status`, `flagged_count`, `flag_reasons`
- **AI Features**: `sentiment_score`, `topics`, `language`

### Performance Optimizations

#### Indexes
```sql
-- Geographic queries
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);

-- Full-text search
CREATE INDEX idx_businesses_search ON businesses USING GIN(
  to_tsvector('english', name || ' ' || description)
);

-- Common filters
CREATE INDEX idx_businesses_active_location ON businesses(status, city, state)
  WHERE status = 'active';
```

#### Custom Functions
- `businesses_near_location()`: Geographic search with distance
- `search_businesses()`: Full-text search with ranking
- `get_business_stats()`: Aggregated review statistics
- `update_business_quality_score()`: Automated quality scoring

## Row Level Security

### Public Access
- **Categories**: All active categories
- **Businesses**: Active, published businesses
- **Reviews**: Approved reviews for active businesses

### Authenticated Access
- **Users can**:
  - Create reviews for businesses
  - Update their own pending reviews
  - View their own business listings
  - Manage businesses they own

### Admin Access
- **Admins have** full access to all tables and operations

### Business Owner Access
- **Business owners can**:
  - Manage their own business listings
  - View all reviews (including pending)
  - Invite managers to help manage listings

## Environment Configuration

### Required Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Local Development URLs
After running `npm run db:setup`, you'll get:
- **API URL**: `http://localhost:54321`
- **Studio URL**: `http://localhost:54323`
- **Database URL**: `postgresql://postgres:postgres@localhost:54322/postgres`

## Seed Data

The database includes sample data:
- **5 businesses** across different categories
- **12 categories** with proper hierarchy
- **6 sample reviews** with realistic content
- **Proper geographic coordinates** for Los Angeles area

### Sample Businesses
1. **Cozy Downtown Café** (Premium) - Coffee shop with excellent reviews
2. **Elite Auto Repair** (Free) - Trusted automotive service
3. **Bella's Italian Kitchen** (Basic) - Family-owned restaurant
4. **Peak Performance Gym** (Premium) - Modern fitness facility  
5. **Tranquil Spa & Wellness** (Basic) - Luxury wellness center

## TypeScript Integration

### Generated Types
Run `npm run supabase:types` to generate:
- **Database interface**: Complete schema types
- **Table types**: `Tables<'businesses'>`, `Tables<'categories'>`
- **Insert/Update types**: `Inserts<'businesses'>`, `Updates<'businesses'>`

### Usage Example
```typescript
import { BusinessService } from '@/lib/supabase/database'
import type { Business } from '@/lib/supabase/types'

// Get businesses with full type safety
const { data: businesses } = await BusinessService.getActiveBusinesses({
  limit: 20,
  categoryId: 'some-uuid'
})
```

## Common Operations

### Development Workflow
```bash
# Reset database with fresh data
npm run supabase:reset

# Regenerate types after schema changes
npm run supabase:types

# Check service status
npm run supabase:status

# Stop services when done
npm run supabase:stop
```

### Adding New Migrations
1. Create new file: `supabase/migrations/YYYYMMDD_description.sql`
2. Apply: `npx supabase db reset`
3. Generate types: `npm run supabase:types`

### Backup and Recovery
```bash
# Dump current database
npx supabase db dump --local > backup.sql

# Restore from backup  
psql -d postgresql://postgres:postgres@localhost:54322/postgres < backup.sql
```

## Troubleshooting

### Common Issues

**Services won't start**
```bash
# Check for port conflicts
npx supabase status
# Stop and restart
npx supabase stop && npx supabase start
```

**Migration errors**
```bash
# Reset and reapply all migrations
npx supabase db reset
```

**Type generation fails**
```bash
# Ensure services are running first
npx supabase start
npm run supabase:types
```

### Performance Tips
- Use database functions for complex queries
- Leverage PostGIS for geographic operations
- Implement proper pagination for large datasets
- Monitor query performance in Supabase Studio

## Next Steps

After setup, you can:
1. **Connect to Next.js**: Use the configured client in `/lib/supabase/`
2. **Implement features**: Build on the service layer in `/lib/supabase/database.ts`
3. **Add authentication**: Extend with Supabase Auth
4. **Deploy**: Configure production Supabase project

## Support

- **Supabase Docs**: https://supabase.com/docs
- **PostGIS Docs**: https://postgis.net/documentation/
- **Local Studio**: http://localhost:54323