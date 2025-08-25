-- Seed Data for The Lawless Directory
-- Description: Sample data for development and testing
-- Date: 2025-01-24
-- Author: Backend Architect Agent

BEGIN;

-- =====================================================
-- SAMPLE BUSINESSES
-- =====================================================

-- Get category IDs
WITH cat_ids AS (
    SELECT 
        id as restaurants_id,
        (SELECT id FROM categories WHERE slug = 'health-medical') as health_id,
        (SELECT id FROM categories WHERE slug = 'home-services') as home_id,
        (SELECT id FROM categories WHERE slug = 'automotive') as auto_id,
        (SELECT id FROM categories WHERE slug = 'professional') as prof_id,
        (SELECT id FROM categories WHERE slug = 'retail') as retail_id,
        (SELECT id FROM categories WHERE slug = 'beauty-spa') as beauty_id,
        (SELECT id FROM categories WHERE slug = 'fitness') as fitness_id
    FROM categories WHERE slug = 'restaurants'
)
INSERT INTO businesses (
    slug, name, description, short_description,
    primary_category_id, tags,
    phone, email, website,
    address_line_1, city, state, zip_code,
    location,
    business_hours,
    year_established, employee_count,
    logo_url, cover_image_url,
    verification_status, quality_score,
    subscription_tier, status
) 
SELECT * FROM (VALUES
    -- Restaurants
    ('the-artisan-kitchen', 'The Artisan Kitchen', 
     'Award-winning farm-to-table restaurant featuring locally sourced ingredients and seasonal menus. Our chef-driven cuisine celebrates the bounty of local farms and producers.',
     'Farm-to-table dining with locally sourced ingredients',
     (SELECT restaurants_id FROM cat_ids), 
     ARRAY['farm-to-table', 'organic', 'local', 'fine-dining'],
     '+1-555-0101', 'info@artisankitchen.com', 'https://artisankitchen.com',
     '123 Main Street', 'San Francisco', 'California', '94102',
     ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
     '{"monday": {"open": "11:00", "close": "22:00", "closed": false}, "tuesday": {"open": "11:00", "close": "22:00", "closed": false}, "wednesday": {"open": "11:00", "close": "22:00", "closed": false}, "thursday": {"open": "11:00", "close": "23:00", "closed": false}, "friday": {"open": "11:00", "close": "23:00", "closed": false}, "saturday": {"open": "10:00", "close": "23:00", "closed": false}, "sunday": {"open": "10:00", "close": "21:00", "closed": false}}'::jsonb,
     2018, '11-50',
     '/images/artisan-kitchen-logo.png', '/images/artisan-kitchen-cover.jpg',
     'verified', 4.5,
     'premium', 'active'),
     
    ('bella-vista-pizzeria', 'Bella Vista Pizzeria',
     'Authentic Italian pizzeria serving traditional Neapolitan-style pizzas baked in our imported wood-fired oven. Family recipes passed down through generations.',
     'Authentic Italian pizzeria with wood-fired oven',
     (SELECT restaurants_id FROM cat_ids),
     ARRAY['pizza', 'italian', 'family-owned', 'casual-dining'],
     '+1-555-0102', 'hello@bellavista.com', 'https://bellavistapizza.com',
     '456 Oak Avenue', 'San Francisco', 'California', '94110',
     ST_SetSRID(ST_MakePoint(-122.4164, 37.7649), 4326)::geography,
     '{"monday": {"open": "11:30", "close": "22:00", "closed": false}, "tuesday": {"open": "11:30", "close": "22:00", "closed": false}, "wednesday": {"open": "11:30", "close": "22:00", "closed": false}, "thursday": {"open": "11:30", "close": "22:00", "closed": false}, "friday": {"open": "11:30", "close": "23:00", "closed": false}, "saturday": {"open": "11:30", "close": "23:00", "closed": false}, "sunday": {"open": "12:00", "close": "21:00", "closed": false}}'::jsonb,
     1995, '11-50',
     '/images/bella-vista-logo.png', '/images/bella-vista-cover.jpg',
     'verified', 4.7,
     'starter', 'active'),
     
    -- Health & Medical
    ('wellness-center-sf', 'San Francisco Wellness Center',
     'Comprehensive healthcare facility offering primary care, specialist consultations, and preventive health services. State-of-the-art medical equipment and experienced healthcare professionals.',
     'Comprehensive healthcare and wellness services',
     (SELECT health_id FROM cat_ids),
     ARRAY['medical', 'wellness', 'primary-care', 'specialists'],
     '+1-555-0201', 'contact@sfwellness.com', 'https://sfwellnesscenter.com',
     '789 Health Plaza', 'San Francisco', 'California', '94108',
     ST_SetSRID(ST_MakePoint(-122.4084, 37.7849), 4326)::geography,
     '{"monday": {"open": "08:00", "close": "18:00", "closed": false}, "tuesday": {"open": "08:00", "close": "18:00", "closed": false}, "wednesday": {"open": "08:00", "close": "18:00", "closed": false}, "thursday": {"open": "08:00", "close": "18:00", "closed": false}, "friday": {"open": "08:00", "close": "17:00", "closed": false}, "saturday": {"open": "09:00", "close": "14:00", "closed": false}, "sunday": {"open": null, "close": null, "closed": true}}'::jsonb,
     2010, '51-200',
     '/images/wellness-center-logo.png', '/images/wellness-center-cover.jpg',
     'verified', 4.3,
     'elite', 'active'),
     
    -- Home Services
    ('premium-home-solutions', 'Premium Home Solutions',
     'Full-service home improvement and maintenance company. Licensed contractors specializing in renovations, repairs, and custom projects. 24/7 emergency services available.',
     'Complete home improvement and maintenance services',
     (SELECT home_id FROM cat_ids),
     ARRAY['contractor', 'renovation', 'repairs', 'emergency-service'],
     '+1-555-0301', 'service@premiumhome.com', 'https://premiumhomesolutions.com',
     '321 Service Road', 'San Francisco', 'California', '94115',
     ST_SetSRID(ST_MakePoint(-122.4384, 37.7849), 4326)::geography,
     '{"monday": {"open": "07:00", "close": "19:00", "closed": false}, "tuesday": {"open": "07:00", "close": "19:00", "closed": false}, "wednesday": {"open": "07:00", "close": "19:00", "closed": false}, "thursday": {"open": "07:00", "close": "19:00", "closed": false}, "friday": {"open": "07:00", "close": "19:00", "closed": false}, "saturday": {"open": "08:00", "close": "17:00", "closed": false}, "sunday": {"open": "09:00", "close": "16:00", "closed": false}}'::jsonb,
     2005, '11-50',
     '/images/premium-home-logo.png', '/images/premium-home-cover.jpg',
     'verified', 4.6,
     'premium', 'active'),
     
    -- Automotive
    ('elite-auto-care', 'Elite Auto Care',
     'Premium automotive service center specializing in luxury and exotic vehicles. Factory-trained technicians, genuine parts, and state-of-the-art diagnostic equipment.',
     'Luxury automotive service and repair center',
     (SELECT auto_id FROM cat_ids),
     ARRAY['auto-repair', 'luxury-cars', 'maintenance', 'diagnostics'],
     '+1-555-0401', 'service@eliteautocare.com', 'https://eliteautocare.com',
     '555 Motor Way', 'San Francisco', 'California', '94103',
     ST_SetSRID(ST_MakePoint(-122.4114, 37.7749), 4326)::geography,
     '{"monday": {"open": "08:00", "close": "18:00", "closed": false}, "tuesday": {"open": "08:00", "close": "18:00", "closed": false}, "wednesday": {"open": "08:00", "close": "18:00", "closed": false}, "thursday": {"open": "08:00", "close": "18:00", "closed": false}, "friday": {"open": "08:00", "close": "18:00", "closed": false}, "saturday": {"open": "09:00", "close": "16:00", "closed": false}, "sunday": {"open": null, "close": null, "closed": true}}'::jsonb,
     2012, '11-50',
     '/images/elite-auto-logo.png', '/images/elite-auto-cover.jpg',
     'verified', 4.8,
     'premium', 'active'),
     
    -- Professional Services
    ('tech-solutions-group', 'Tech Solutions Group',
     'Full-stack technology consulting firm specializing in digital transformation, cloud migration, and custom software development. Serving Fortune 500 companies and startups.',
     'Technology consulting and software development',
     (SELECT prof_id FROM cat_ids),
     ARRAY['consulting', 'software', 'cloud', 'digital-transformation'],
     '+1-555-0501', 'info@techsolutionsgroup.com', 'https://techsolutionsgroup.com',
     '100 Tech Tower', 'San Francisco', 'California', '94105',
     ST_SetSRID(ST_MakePoint(-122.3984, 37.7949), 4326)::geography,
     '{"monday": {"open": "09:00", "close": "18:00", "closed": false}, "tuesday": {"open": "09:00", "close": "18:00", "closed": false}, "wednesday": {"open": "09:00", "close": "18:00", "closed": false}, "thursday": {"open": "09:00", "close": "18:00", "closed": false}, "friday": {"open": "09:00", "close": "17:00", "closed": false}, "saturday": {"open": null, "close": null, "closed": true}, "sunday": {"open": null, "close": null, "closed": true}}'::jsonb,
     2015, '51-200',
     '/images/tech-solutions-logo.png', '/images/tech-solutions-cover.jpg',
     'verified', 4.4,
     'elite', 'active'),
     
    -- Retail
    ('urban-style-boutique', 'Urban Style Boutique',
     'Curated fashion boutique featuring emerging designers and sustainable fashion brands. Personal styling services and exclusive collections.',
     'Curated fashion boutique with personal styling',
     (SELECT retail_id FROM cat_ids),
     ARRAY['fashion', 'boutique', 'sustainable', 'designer'],
     '+1-555-0601', 'style@urbanstyle.com', 'https://urbanstyleboutique.com',
     '234 Fashion Street', 'San Francisco', 'California', '94109',
     ST_SetSRID(ST_MakePoint(-122.4184, 37.7879), 4326)::geography,
     '{"monday": {"open": "10:00", "close": "19:00", "closed": false}, "tuesday": {"open": "10:00", "close": "19:00", "closed": false}, "wednesday": {"open": "10:00", "close": "19:00", "closed": false}, "thursday": {"open": "10:00", "close": "20:00", "closed": false}, "friday": {"open": "10:00", "close": "20:00", "closed": false}, "saturday": {"open": "10:00", "close": "20:00", "closed": false}, "sunday": {"open": "11:00", "close": "18:00", "closed": false}}'::jsonb,
     2019, '1-10',
     '/images/urban-style-logo.png', '/images/urban-style-cover.jpg',
     'verified', 4.2,
     'starter', 'active'),
     
    -- Beauty & Spa
    ('serenity-spa-wellness', 'Serenity Spa & Wellness',
     'Luxury day spa offering massage therapy, facials, body treatments, and holistic wellness services. Award-winning spa with certified therapists.',
     'Luxury spa and wellness sanctuary',
     (SELECT beauty_id FROM cat_ids),
     ARRAY['spa', 'massage', 'wellness', 'luxury'],
     '+1-555-0701', 'relax@serenityspa.com', 'https://serenityspawellness.com',
     '456 Zen Plaza', 'San Francisco', 'California', '94111',
     ST_SetSRID(ST_MakePoint(-122.4034, 37.7949), 4326)::geography,
     '{"monday": {"open": "09:00", "close": "21:00", "closed": false}, "tuesday": {"open": "09:00", "close": "21:00", "closed": false}, "wednesday": {"open": "09:00", "close": "21:00", "closed": false}, "thursday": {"open": "09:00", "close": "21:00", "closed": false}, "friday": {"open": "09:00", "close": "21:00", "closed": false}, "saturday": {"open": "09:00", "close": "21:00", "closed": false}, "sunday": {"open": "10:00", "close": "19:00", "closed": false}}'::jsonb,
     2016, '11-50',
     '/images/serenity-spa-logo.png', '/images/serenity-spa-cover.jpg',
     'verified', 4.9,
     'premium', 'active'),
     
    -- Fitness
    ('peak-performance-gym', 'Peak Performance Gym',
     'State-of-the-art fitness facility with personal training, group classes, and specialized athletic programs. Olympic-grade equipment and professional trainers.',
     'Premium fitness center with personal training',
     (SELECT fitness_id FROM cat_ids),
     ARRAY['gym', 'fitness', 'personal-training', 'classes'],
     '+1-555-0801', 'train@peakperformance.com', 'https://peakperformancegym.com',
     '789 Fitness Boulevard', 'San Francisco', 'California', '94107',
     ST_SetSRID(ST_MakePoint(-122.3884, 37.7749), 4326)::geography,
     '{"monday": {"open": "05:00", "close": "23:00", "closed": false}, "tuesday": {"open": "05:00", "close": "23:00", "closed": false}, "wednesday": {"open": "05:00", "close": "23:00", "closed": false}, "thursday": {"open": "05:00", "close": "23:00", "closed": false}, "friday": {"open": "05:00", "close": "22:00", "closed": false}, "saturday": {"open": "06:00", "close": "21:00", "closed": false}, "sunday": {"open": "07:00", "close": "20:00", "closed": false}}'::jsonb,
     2014, '11-50',
     '/images/peak-performance-logo.png', '/images/peak-performance-cover.jpg',
     'verified', 4.6,
     'premium', 'active'),
     
    -- Free tier businesses for testing
    ('quick-bites-cafe', 'Quick Bites Cafe',
     'Neighborhood cafe serving coffee, sandwiches, and pastries. Free WiFi and cozy atmosphere.',
     'Local cafe with fresh coffee and snacks',
     (SELECT restaurants_id FROM cat_ids),
     ARRAY['cafe', 'coffee', 'sandwiches', 'wifi'],
     '+1-555-0901', 'hello@quickbites.com', NULL,
     '999 Corner Street', 'San Francisco', 'California', '94114',
     ST_SetSRID(ST_MakePoint(-122.4284, 37.7649), 4326)::geography,
     '{"monday": {"open": "07:00", "close": "19:00", "closed": false}, "tuesday": {"open": "07:00", "close": "19:00", "closed": false}, "wednesday": {"open": "07:00", "close": "19:00", "closed": false}, "thursday": {"open": "07:00", "close": "19:00", "closed": false}, "friday": {"open": "07:00", "close": "20:00", "closed": false}, "saturday": {"open": "08:00", "close": "20:00", "closed": false}, "sunday": {"open": "08:00", "close": "18:00", "closed": false}}'::jsonb,
     2020, '1-10',
     NULL, NULL,
     'pending', 3.5,
     'free', 'active')
) AS t;

-- =====================================================
-- SAMPLE REVIEWS (after businesses are created)
-- =====================================================

-- Note: In a real scenario, you would have actual user IDs from auth.users
-- For seed data, we'll create reviews without reviewer_id (anonymous reviews)

INSERT INTO business_reviews (
    business_id, rating, title, content,
    visit_date, verification_type,
    helpful_count, status, sentiment_score,
    published_at
)
SELECT 
    b.id,
    r.rating,
    r.title,
    r.content,
    CURRENT_DATE - INTERVAL '1 day' * r.days_ago,
    r.verification_type,
    r.helpful_count,
    'published',
    r.sentiment_score,
    NOW() - INTERVAL '1 day' * r.days_ago
FROM businesses b
CROSS JOIN LATERAL (
    VALUES 
    -- Reviews for The Artisan Kitchen
    (5, 'Outstanding dining experience!', 'The farm-to-table concept really shines through in every dish. The seasonal menu was creative and delicious. Service was impeccable.', 5, 'photo', 12, 0.9),
    (4, 'Great food, slightly pricey', 'Food quality is excellent and you can taste the freshness of ingredients. A bit expensive but worth it for special occasions.', 15, 'receipt', 8, 0.7),
    (5, 'Best restaurant in SF', 'I''ve been coming here for years and it never disappoints. The chef really knows how to highlight local ingredients.', 30, 'photo', 15, 0.95),
    
    -- Reviews for Bella Vista Pizzeria
    (5, 'Authentic Italian pizza!', 'The wood-fired oven makes all the difference. Crust is perfect - crispy outside, chewy inside. Just like in Naples!', 7, 'photo', 20, 0.9),
    (4, 'Great pizza, busy on weekends', 'Pizza is fantastic but be prepared to wait on Friday/Saturday nights. The margherita is a must-try.', 10, NULL, 5, 0.6),
    (5, 'Family favorite', 'We come here every week with the kids. Consistent quality, friendly staff, and the best pizza in the neighborhood.', 3, 'receipt', 18, 0.85)
) AS r(rating, title, content, days_ago, verification_type, helpful_count, sentiment_score)
WHERE b.slug IN ('the-artisan-kitchen', 'bella-vista-pizzeria')
LIMIT 3;

-- Add more reviews for other businesses
INSERT INTO business_reviews (
    business_id, rating, title, content,
    visit_date, status, sentiment_score, published_at
)
SELECT 
    b.id,
    3 + random() * 2, -- Random rating between 3-5
    CASE 
        WHEN random() < 0.5 THEN 'Great service!'
        WHEN random() < 0.7 THEN 'Highly recommended'
        ELSE 'Good experience overall'
    END,
    CASE 
        WHEN random() < 0.3 THEN 'Professional service and great results. Would definitely come back.'
        WHEN random() < 0.6 THEN 'Very satisfied with the service. Staff was friendly and knowledgeable.'
        ELSE 'Good value for money. Met all my expectations.'
    END,
    CURRENT_DATE - (random() * 60)::INT,
    'published',
    0.5 + random() * 0.5,
    NOW() - INTERVAL '1 day' * (random() * 60)::INT
FROM businesses b
WHERE b.slug NOT IN ('the-artisan-kitchen', 'bella-vista-pizzeria')
CROSS JOIN generate_series(1, 3); -- 3 reviews per business

-- =====================================================
-- UPDATE BUSINESS QUALITY SCORES
-- =====================================================

-- Trigger will automatically update quality scores based on reviews
-- But we can also manually update for demonstration
UPDATE businesses b
SET quality_score = (
    SELECT LEAST(5.0, GREATEST(0.0,
        COALESCE(AVG(r.rating) * 0.4, 0) +
        (LEAST(COUNT(r.id), 50) / 50.0 * 5.0 * 0.3) +
        (CASE WHEN b.verification_status = 'verified' THEN 5.0 ELSE 0.0 END * 0.2) +
        (CASE WHEN b.subscription_tier != 'free' THEN 5.0 ELSE 0.0 END * 0.1)
    ))
    FROM business_reviews r
    WHERE r.business_id = b.id
    AND r.status = 'published'
);

-- =====================================================
-- SAMPLE ANALYTICS DATA
-- =====================================================

-- Generate some analytics data for the past 30 days
INSERT INTO business_analytics (
    business_id, date,
    page_views, unique_visitors, bounce_rate,
    phone_clicks, website_clicks, direction_clicks
)
SELECT 
    b.id,
    CURRENT_DATE - days.day,
    50 + (random() * 200)::INT, -- 50-250 views
    30 + (random() * 100)::INT, -- 30-130 unique visitors
    20 + (random() * 40), -- 20-60% bounce rate
    (random() * 10)::INT, -- 0-10 phone clicks
    (random() * 15)::INT, -- 0-15 website clicks
    (random() * 20)::INT  -- 0-20 direction clicks
FROM businesses b
CROSS JOIN generate_series(0, 29) AS days(day)
WHERE b.status = 'active';

-- =====================================================
-- REFRESH MATERIALIZED VIEWS
-- =====================================================

-- Refresh all materialized views with the new data
REFRESH MATERIALIZED VIEW business_stats;
REFRESH MATERIALIZED VIEW category_business_counts;
REFRESH MATERIALIZED VIEW top_businesses_by_category;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify data was inserted correctly
DO $$
DECLARE
    business_count INTEGER;
    review_count INTEGER;
    analytics_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO business_count FROM businesses;
    SELECT COUNT(*) INTO review_count FROM business_reviews;
    SELECT COUNT(*) INTO analytics_count FROM business_analytics;
    
    RAISE NOTICE 'Seed data inserted successfully:';
    RAISE NOTICE '  - Businesses: %', business_count;
    RAISE NOTICE '  - Reviews: %', review_count;
    RAISE NOTICE '  - Analytics records: %', analytics_count;
END $$;
