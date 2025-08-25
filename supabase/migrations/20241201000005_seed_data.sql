-- Insert categories first
INSERT INTO categories (id, slug, name, description, icon, color, level, sort_order, featured, active) VALUES
-- Level 0: Main categories
('550e8400-e29b-41d4-a716-446655440001', 'food-dining', 'Food & Dining', 'Restaurants, cafes, and food establishments', '🍽️', '#FF6B35', 0, 1, true, true),
('550e8400-e29b-41d4-a716-446655440002', 'automotive', 'Automotive', 'Auto repair, dealerships, and car services', '🚗', '#2E8B57', 0, 2, true, true),
('550e8400-e29b-41d4-a716-446655440003', 'health-wellness', 'Health & Wellness', 'Medical, fitness, and wellness services', '💚', '#32CD32', 0, 3, true, true),
('550e8400-e29b-41d4-a716-446655440004', 'shopping-retail', 'Shopping & Retail', 'Stores, boutiques, and retail establishments', '🛒', '#FF1493', 0, 4, true, true),
('550e8400-e29b-41d4-a716-446655440005', 'services', 'Professional Services', 'Business and professional services', '💼', '#4169E1', 0, 5, true, true),
('550e8400-e29b-41d4-a716-446655440006', 'entertainment', 'Entertainment & Recreation', 'Fun, leisure, and entertainment venues', '🎭', '#FFD700', 0, 6, true, true),
('550e8400-e29b-41d4-a716-446655440007', 'home-garden', 'Home & Garden', 'Home improvement and garden services', '🏠', '#228B22', 0, 7, false, true),
('550e8400-e29b-41d4-a716-446655440008', 'beauty-personal', 'Beauty & Personal Care', 'Salons, spas, and personal care services', '💅', '#FF69B4', 0, 8, false, true),

-- Level 1: Subcategories
('550e8400-e29b-41d4-a716-446655440101', 'coffee-shops', 'Coffee Shops', 'Cafes and coffee houses', '☕', '#8B4513', 1, 1, true, true),
('550e8400-e29b-41d4-a716-446655440102', 'restaurants', 'Restaurants', 'Full-service dining establishments', '🍴', '#DC143C', 1, 2, true, true),
('550e8400-e29b-41d4-a716-446655440103', 'fast-food', 'Fast Food', 'Quick service restaurants', '🍔', '#FF4500', 1, 3, false, true),
('550e8400-e29b-41d4-a716-446655440104', 'bakeries', 'Bakeries', 'Bread, pastries, and baked goods', '🥖', '#DEB887', 1, 4, false, true),

('550e8400-e29b-41d4-a716-446655440201', 'auto-repair', 'Auto Repair', 'Automotive repair and maintenance', '🔧', '#696969', 1, 1, true, true),
('550e8400-e29b-41d4-a716-446655440202', 'car-dealers', 'Car Dealerships', 'New and used car sales', '🚙', '#2F4F4F', 1, 2, false, true),
('550e8400-e29b-41d4-a716-446655440203', 'gas-stations', 'Gas Stations', 'Fuel and convenience stores', '⛽', '#4682B4', 1, 3, false, true),

('550e8400-e29b-41d4-a716-446655440301', 'fitness-gyms', 'Fitness & Gyms', 'Gyms, fitness centers, and training', '💪', '#FF6347', 1, 1, true, true),
('550e8400-e29b-41d4-a716-446655440302', 'medical', 'Medical Services', 'Doctors, clinics, and healthcare', '⚕️', '#00CED1', 1, 2, false, true),
('550e8400-e29b-41d4-a716-446655440303', 'spas-wellness', 'Spas & Wellness', 'Massage, spas, and wellness centers', '🧘', '#DDA0DD', 1, 3, true, true);

-- Update parent_id and path for subcategories
UPDATE categories SET parent_id = '550e8400-e29b-41d4-a716-446655440001' WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440101',
    '550e8400-e29b-41d4-a716-446655440102', 
    '550e8400-e29b-41d4-a716-446655440103',
    '550e8400-e29b-41d4-a716-446655440104'
);

UPDATE categories SET parent_id = '550e8400-e29b-41d4-a716-446655440002' WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440201',
    '550e8400-e29b-41d4-a716-446655440202',
    '550e8400-e29b-41d4-a716-446655440203'
);

UPDATE categories SET parent_id = '550e8400-e29b-41d4-a716-446655440003' WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440301',
    '550e8400-e29b-41d4-a716-446655440302',
    '550e8400-e29b-41d4-a716-446655440303'
);

-- Insert businesses based on the prototype data
INSERT INTO businesses (
    id, slug, name, description, short_description,
    primary_category_id, secondary_categories, tags,
    phone, email, website,
    address_line_1, city, state, zip_code, country,
    location,
    business_hours,
    logo_url, cover_image_url, gallery,
    social_media,
    verification_status, quality_score,
    subscription_tier, premium_features,
    view_count, click_count, save_count,
    status, published_at,
    created_at, updated_at
) VALUES
-- Cozy Downtown Café
(
    '650e8400-e29b-41d4-a716-446655440001',
    'cozy-downtown-cafe',
    'Cozy Downtown Café',
    'Artisan coffee and fresh pastries in a warm, welcoming atmosphere perfect for work or relaxation. Our skilled baristas craft exceptional drinks using locally roasted beans, while our in-house bakery provides fresh pastries, sandwiches, and light meals daily.',
    'Artisan coffee and fresh pastries in a warm, welcoming atmosphere perfect for work or relaxation.',
    '550e8400-e29b-41d4-a716-446655440101', -- coffee-shops
    ARRAY['550e8400-e29b-41d4-a716-446655440104'], -- bakeries
    ARRAY['coffee', 'pastries', 'wifi', 'cozy', 'artisan', 'local', 'breakfast', 'lunch'],
    '(555) 123-4567',
    'info@cozydowntowncafe.com',
    'https://cozydowntowncafe.com',
    '123 Main Street',
    'Los Angeles',
    'California',
    '90210',
    'United States',
    ST_SetSRID(ST_Point(-118.2437, 34.0522), 4326)::geography,
    '{
        "monday": {"open": "07:00", "close": "19:00"},
        "tuesday": {"open": "07:00", "close": "19:00"},
        "wednesday": {"open": "07:00", "close": "19:00"},
        "thursday": {"open": "07:00", "close": "19:00"},
        "friday": {"open": "07:00", "close": "20:00"},
        "saturday": {"open": "08:00", "close": "20:00"},
        "sunday": {"open": "08:00", "close": "18:00"}
    }',
    '/logos/cozy-cafe-logo.png',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
    '[
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop",
        "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=250&fit=crop"
    ]',
    '{
        "facebook": "https://facebook.com/cozydowntowncafe",
        "instagram": "@cozydowntowncafe",
        "twitter": "@cozydowntown"
    }',
    'verified',
    4.9,
    'premium',
    '{"featured_listing": true, "priority_support": true, "advanced_analytics": true}',
    1250,
    340,
    89,
    'active',
    '2024-01-15T10:00:00Z',
    '2024-01-01T00:00:00Z',
    NOW()
),

-- Elite Auto Repair
(
    '650e8400-e29b-41d4-a716-446655440002',
    'elite-auto-repair',
    'Elite Auto Repair',
    'Professional automotive repair and maintenance services with certified technicians and state-of-the-art equipment. We specialize in both domestic and foreign vehicles, offering everything from routine maintenance to complex engine repairs.',
    'Professional automotive repair and maintenance with certified technicians.',
    '550e8400-e29b-41d4-a716-446655440201', -- auto-repair
    ARRAY[]::UUID[],
    ARRAY['auto repair', 'maintenance', 'certified', 'professional', 'engine', 'brake', 'oil change'],
    '(555) 234-5678',
    'service@eliteautorepair.com',
    'https://eliteautorepair.com',
    '456 Auto Drive',
    'Los Angeles', 
    'California',
    '90211',
    'United States',
    ST_SetSRID(ST_Point(-118.2537, 34.0622), 4326)::geography,
    '{
        "monday": {"open": "08:00", "close": "17:00"},
        "tuesday": {"open": "08:00", "close": "17:00"},
        "wednesday": {"open": "08:00", "close": "17:00"},
        "thursday": {"open": "08:00", "close": "17:00"},
        "friday": {"open": "08:00", "close": "17:00"},
        "saturday": {"open": "08:00", "close": "14:00"},
        "sunday": {"isClosed": true}
    }',
    '/logos/elite-auto-logo.png',
    'https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=800&h=400&fit=crop',
    '[
        "https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=400&h=250&fit=crop"
    ]',
    '{
        "facebook": "https://facebook.com/eliteautorepair",
        "website": "https://eliteautorepair.com"
    }',
    'verified',
    4.6,
    'free',
    '{}',
    890,
    145,
    32,
    'active',
    '2024-02-01T09:00:00Z',
    '2024-01-15T00:00:00Z',
    NOW()
),

-- Bella's Italian Kitchen
(
    '650e8400-e29b-41d4-a716-446655440003',
    'bellas-italian-kitchen',
    'Bella''s Italian Kitchen',
    'Authentic Italian cuisine prepared with traditional recipes passed down through generations. Family-owned and operated, we use only the finest imported ingredients and fresh local produce to create memorable dining experiences.',
    'Authentic Italian cuisine with traditional recipes and finest ingredients.',
    '550e8400-e29b-41d4-a716-446655440102', -- restaurants  
    ARRAY[]::UUID[],
    ARRAY['italian', 'authentic', 'family owned', 'pasta', 'pizza', 'wine', 'traditional', 'imported'],
    '(555) 345-6789',
    'info@bellasitaliankitchen.com',
    'https://bellasitaliankitchen.com',
    '789 Little Italy Street',
    'Los Angeles',
    'California', 
    '90212',
    'United States',
    ST_SetSRID(ST_Point(-118.2337, 34.0422), 4326)::geography,
    '{
        "monday": {"open": "11:30", "close": "22:00"},
        "tuesday": {"open": "11:30", "close": "22:00"},
        "wednesday": {"open": "11:30", "close": "22:00"},
        "thursday": {"open": "11:30", "close": "22:00"},
        "friday": {"open": "11:30", "close": "23:00"},
        "saturday": {"open": "11:30", "close": "23:00"},
        "sunday": {"open": "12:00", "close": "21:00"}
    }',
    '/logos/bellas-italian-logo.png',
    'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=400&fit=crop',
    '[
        "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=250&fit=crop"
    ]',
    '{
        "facebook": "https://facebook.com/bellasitaliankitchen",
        "instagram": "@bellasitalian",
        "yelp": "https://yelp.com/biz/bellas-italian-kitchen"
    }',
    'verified',
    4.8,
    'basic',
    '{"priority_listing": true}',
    1560,
    298,
    76,
    'active',
    '2024-01-20T11:00:00Z',
    '2024-01-10T00:00:00Z',
    NOW()
),

-- Peak Performance Gym
(
    '650e8400-e29b-41d4-a716-446655440004',
    'peak-performance-gym',
    'Peak Performance Gym',
    'State-of-the-art fitness facility with modern equipment, personal trainers, and group fitness classes. We offer 24/7 access, comprehensive strength and cardio equipment, and specialized training programs for all fitness levels.',
    'State-of-the-art fitness facility with modern equipment and personal trainers.',
    '550e8400-e29b-41d4-a716-446655440301', -- fitness-gyms
    ARRAY[]::UUID[],
    ARRAY['gym', 'fitness', 'personal training', '24/7', 'strength', 'cardio', 'group classes'],
    '(555) 456-7890',
    'info@peakperformancegym.com',
    'https://peakperformancegym.com',
    '321 Fitness Boulevard',
    'Los Angeles',
    'California',
    '90213',
    'United States',
    ST_SetSRID(ST_Point(-118.2437, 34.0722), 4326)::geography,
    '{
        "monday": {"open": "05:00", "close": "23:00"},
        "tuesday": {"open": "05:00", "close": "23:00"},
        "wednesday": {"open": "05:00", "close": "23:00"},
        "thursday": {"open": "05:00", "close": "23:00"},
        "friday": {"open": "05:00", "close": "23:00"},
        "saturday": {"open": "06:00", "close": "22:00"},
        "sunday": {"open": "06:00", "close": "22:00"}
    }',
    '/logos/peak-performance-logo.png',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop',
    '[
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop"
    ]',
    '{
        "facebook": "https://facebook.com/peakperformancegym",
        "instagram": "@peakperformance",
        "youtube": "https://youtube.com/@peakperformance"
    }',
    'verified',
    4.7,
    'premium',
    '{"featured_listing": true, "priority_support": true, "video_gallery": true}',
    2100,
    456,
    123,
    'active',
    '2024-02-05T06:00:00Z',
    '2024-01-25T00:00:00Z',
    NOW()
),

-- Tranquil Spa & Wellness
(
    '650e8400-e29b-41d4-a716-446655440005',
    'tranquil-spa-wellness',
    'Tranquil Spa & Wellness',
    'Luxury spa and wellness center offering rejuvenating treatments, massage therapy, and holistic wellness services. Our serene environment and experienced therapists provide the perfect escape from daily stress.',
    'Luxury spa offering rejuvenating treatments and holistic wellness services.',
    '550e8400-e29b-41d4-a716-446655440303', -- spas-wellness
    ARRAY[]::UUID[],
    ARRAY['spa', 'massage', 'wellness', 'luxury', 'relaxation', 'holistic', 'therapy'],
    '(555) 567-8901',
    'booking@tranquilspa.com',
    'https://tranquilspa.com',
    '654 Serenity Lane',
    'Los Angeles',
    'California',
    '90214',
    'United States',
    ST_SetSRID(ST_Point(-118.2237, 34.0322), 4326)::geography,
    '{
        "monday": {"open": "09:00", "close": "20:00"},
        "tuesday": {"open": "09:00", "close": "20:00"},
        "wednesday": {"open": "09:00", "close": "20:00"},
        "thursday": {"open": "09:00", "close": "21:00"},
        "friday": {"open": "09:00", "close": "21:00"},
        "saturday": {"open": "08:00", "close": "21:00"},
        "sunday": {"open": "08:00", "close": "19:00"}
    }',
    '/logos/tranquil-spa-logo.png',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=400&fit=crop',
    '[
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=250&fit=crop"
    ]',
    '{
        "facebook": "https://facebook.com/tranquilspa",
        "instagram": "@tranquilspa",
        "website": "https://tranquilspa.com"
    }',
    'verified',
    4.9,
    'basic',
    '{"priority_listing": true, "customer_reviews": true}',
    980,
    178,
    67,
    'active',
    '2024-02-10T09:00:00Z',
    '2024-01-30T00:00:00Z',
    NOW()
);

-- Insert some sample reviews
INSERT INTO business_reviews (
    id, business_id, rating, title, content, 
    visit_date, status, created_at, published_at
) VALUES
-- Reviews for Cozy Downtown Café
(
    '750e8400-e29b-41d4-a716-446655440001',
    '650e8400-e29b-41d4-a716-446655440001',
    5,
    'Perfect morning coffee spot!',
    'Absolutely love this place! The coffee is exceptional and the atmosphere is so cozy and welcoming. Perfect spot to start the day or get some work done. The pastries are fresh and delicious too.',
    '2024-08-20',
    'approved',
    '2024-08-21T10:30:00Z',
    '2024-08-21T12:00:00Z'
),
(
    '750e8400-e29b-41d4-a716-446655440002',
    '650e8400-e29b-41d4-a716-446655440001',
    5,
    'Great service and amazing coffee',
    'The baristas here really know their craft. Every drink is perfectly made and the service is always friendly. The wifi is reliable too, making it a great place to work.',
    '2024-08-18',
    'approved',
    '2024-08-19T14:15:00Z',
    '2024-08-19T15:00:00Z'
),

-- Reviews for Elite Auto Repair
(
    '750e8400-e29b-41d4-a716-446655440003',
    '650e8400-e29b-41d4-a716-446655440002',
    5,
    'Honest and reliable service',
    'Finally found an auto repair shop I can trust! They diagnosed the issue accurately, explained everything clearly, and completed the work on time and within budget. Highly recommend.',
    '2024-08-15',
    'approved',
    '2024-08-16T16:45:00Z',
    '2024-08-16T17:00:00Z'
),
(
    '750e8400-e29b-41d4-a716-446655440004',
    '650e8400-e29b-41d4-a716-446655440002',
    4,
    'Professional team',
    'Great service from the team. They were professional, knowledgeable, and fair with pricing. My car runs like new after their maintenance work.',
    '2024-08-10',
    'approved',
    '2024-08-11T09:20:00Z',
    '2024-08-11T10:00:00Z'
),

-- Reviews for Bella's Italian Kitchen
(
    '750e8400-e29b-41d4-a716-446655440005',
    '650e8400-e29b-41d4-a716-446655440003',
    5,
    'Authentic Italian experience',
    'This place transports you straight to Italy! The pasta is handmade, the sauces are incredible, and the family atmosphere makes you feel right at home. The tiramisu is to die for!',
    '2024-08-12',
    'approved',
    '2024-08-13T20:30:00Z',
    '2024-08-13T21:00:00Z'
),
(
    '750e8400-e29b-41d4-a716-446655440006',
    '650e8400-e29b-41d4-a716-446655440003',
    5,
    'Best Italian in the city',
    'Outstanding food and service. You can taste the love and tradition in every dish. The wine selection is excellent and the staff are so knowledgeable about the menu.',
    '2024-08-08',
    'approved',
    '2024-08-09T19:15:00Z',
    '2024-08-09T20:00:00Z'
);

-- Update business counts in categories
UPDATE categories SET business_count = (
    SELECT COUNT(*) FROM businesses 
    WHERE primary_category_id = categories.id 
    AND status = 'active' 
    AND deleted_at IS NULL
);