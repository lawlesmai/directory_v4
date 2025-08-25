-- Migration: 004_performance_optimization
-- Description: Materialized views, performance monitoring, and optimization
-- Date: 2025-01-24
-- Author: Backend Architect Agent

BEGIN;

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Business statistics materialized view
CREATE MATERIALIZED VIEW business_stats AS
SELECT 
    b.id,
    b.slug,
    b.name,
    b.primary_category_id,
    b.city,
    b.state,
    b.subscription_tier,
    b.verification_status,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'published' AND r.deleted_at IS NULL) as review_count,
    AVG(r.rating) FILTER (WHERE r.status = 'published' AND r.deleted_at IS NULL) as avg_rating,
    COUNT(DISTINCT r.id) FILTER (WHERE r.created_at > NOW() - INTERVAL '30 days' AND r.status = 'published' AND r.deleted_at IS NULL) as recent_review_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.created_at > NOW() - INTERVAL '7 days' AND r.status = 'published' AND r.deleted_at IS NULL) as week_review_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.rating) FILTER (WHERE r.status = 'published' AND r.deleted_at IS NULL) as median_rating,
    MAX(r.created_at) FILTER (WHERE r.status = 'published' AND r.deleted_at IS NULL) as last_review_date,
    SUM(r.helpful_count) FILTER (WHERE r.status = 'published' AND r.deleted_at IS NULL) as total_helpful_votes,
    NOW() as last_refreshed
FROM businesses b
LEFT JOIN business_reviews r ON b.id = r.business_id
WHERE b.status = 'active' AND b.deleted_at IS NULL
GROUP BY b.id, b.slug, b.name, b.primary_category_id, b.city, b.state, b.subscription_tier, b.verification_status
WITH DATA;

-- Create indexes on materialized view
CREATE UNIQUE INDEX ON business_stats(id);
CREATE INDEX ON business_stats(slug);
CREATE INDEX ON business_stats(avg_rating DESC NULLS LAST);
CREATE INDEX ON business_stats(review_count DESC);
CREATE INDEX ON business_stats(city, state);

-- Category business counts materialized view
CREATE MATERIALIZED VIEW category_business_counts AS
WITH RECURSIVE category_tree AS (
    SELECT 
        id,
        parent_id,
        slug,
        name,
        ARRAY[id] as path_ids,
        0 as depth
    FROM categories
    WHERE parent_id IS NULL
    
    UNION ALL
    
    SELECT 
        c.id,
        c.parent_id,
        c.slug,
        c.name,
        ct.path_ids || c.id,
        ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT 
    ct.id,
    ct.slug,
    ct.name,
    ct.parent_id,
    ct.depth,
    COUNT(DISTINCT b.id) as direct_business_count,
    COUNT(DISTINCT CASE WHEN b.primary_category_id = ANY(ct.path_ids) THEN b.id END) as total_business_count,
    COUNT(DISTINCT b.id) FILTER (WHERE b.verification_status = 'verified') as verified_business_count,
    COUNT(DISTINCT b.id) FILTER (WHERE b.subscription_tier != 'free') as premium_business_count,
    AVG(bs.avg_rating) as category_avg_rating,
    NOW() as last_refreshed
FROM category_tree ct
LEFT JOIN businesses b ON b.primary_category_id = ct.id AND b.status = 'active' AND b.deleted_at IS NULL
LEFT JOIN business_stats bs ON b.id = bs.id
GROUP BY ct.id, ct.slug, ct.name, ct.parent_id, ct.depth
WITH DATA;

-- Create indexes on category counts
CREATE UNIQUE INDEX ON category_business_counts(id);
CREATE INDEX ON category_business_counts(slug);
CREATE INDEX ON category_business_counts(parent_id);

-- Popular searches materialized view
CREATE MATERIALIZED VIEW popular_searches AS
SELECT 
    lower(trim(query)) as normalized_query,
    COUNT(*) as search_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG(results_count) as avg_results,
    MAX(created_at) as last_searched,
    NOW() as last_refreshed
FROM search_analytics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY lower(trim(query))
HAVING COUNT(*) > 5
ORDER BY search_count DESC
LIMIT 100
WITH DATA;

CREATE UNIQUE INDEX ON popular_searches(normalized_query);

-- Top performing businesses by category
CREATE MATERIALIZED VIEW top_businesses_by_category AS
SELECT DISTINCT ON (primary_category_id)
    b.id,
    b.slug,
    b.name,
    b.primary_category_id,
    c.name as category_name,
    b.city,
    b.state,
    bs.avg_rating,
    bs.review_count,
    b.verification_status,
    b.subscription_tier,
    b.quality_score,
    NOW() as last_refreshed
FROM businesses b
JOIN business_stats bs ON b.id = bs.id
JOIN categories c ON b.primary_category_id = c.id
WHERE b.status = 'active' 
AND b.deleted_at IS NULL
AND bs.review_count >= 5
ORDER BY primary_category_id, b.quality_score DESC, bs.avg_rating DESC
WITH DATA;

CREATE INDEX ON top_businesses_by_category(primary_category_id);

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Query performance monitoring view
CREATE OR REPLACE VIEW query_performance_stats AS
SELECT 
    query,
    calls,
    round(mean_exec_time::numeric, 2) as mean_exec_time_ms,
    round(stddev_exec_time::numeric, 2) as stddev_exec_time_ms,
    round(total_exec_time::numeric, 2) as total_exec_time_ms,
    round(min_exec_time::numeric, 2) as min_exec_time_ms,
    round(max_exec_time::numeric, 2) as max_exec_time_ms,
    rows,
    CASE 
        WHEN calls > 0 THEN round((rows::numeric / calls), 2)
        ELSE 0
    END as avg_rows_per_call
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
AND query NOT LIKE '%pg_catalog%'
ORDER BY mean_exec_time DESC
LIMIT 100;

-- Table maintenance statistics
CREATE OR REPLACE VIEW table_maintenance_stats AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE 
        WHEN n_live_tup > 0 THEN round((n_dead_tup::numeric / n_live_tup) * 100, 2)
        ELSE 0
    END as dead_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'RARELY USED'
        WHEN idx_scan < 1000 THEN 'OCCASIONALLY USED'
        ELSE 'FREQUENTLY USED'
    END as usage_category,
    pg_get_indexdef(indexrelid) as index_definition
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Connection monitoring view
CREATE OR REPLACE VIEW connection_stats AS
SELECT 
    datname as database,
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_aborted,
    count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections,
    max(age(clock_timestamp(), query_start)) FILTER (WHERE state = 'active') as longest_query_time,
    max(age(clock_timestamp(), state_change)) FILTER (WHERE state = 'idle') as longest_idle_time
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY datname;

-- Cache hit ratio view
CREATE OR REPLACE VIEW cache_hit_ratio AS
SELECT 
    'heap' as cache_type,
    sum(heap_blks_read) as blocks_read,
    sum(heap_blks_hit) as blocks_hit,
    CASE 
        WHEN sum(heap_blks_read) + sum(heap_blks_hit) > 0 
        THEN round((sum(heap_blks_hit)::numeric / (sum(heap_blks_read) + sum(heap_blks_hit))) * 100, 2)
        ELSE 0
    END as hit_ratio_percent
FROM pg_statio_user_tables
UNION ALL
SELECT 
    'index' as cache_type,
    sum(idx_blks_read) as blocks_read,
    sum(idx_blks_hit) as blocks_hit,
    CASE 
        WHEN sum(idx_blks_read) + sum(idx_blks_hit) > 0 
        THEN round((sum(idx_blks_hit)::numeric / (sum(idx_blks_read) + sum(idx_blks_hit))) * 100, 2)
        ELSE 0
    END as hit_ratio_percent
FROM pg_statio_user_indexes;

-- =====================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- =====================================================

-- Get slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(threshold_ms INTEGER DEFAULT 1000)
RETURNS TABLE(
    pid INTEGER,
    duration INTERVAL,
    query TEXT,
    state TEXT,
    wait_event TEXT,
    username TEXT,
    application_name TEXT,
    client_addr INET
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_activity.pid,
        age(clock_timestamp(), query_start) as duration,
        pg_stat_activity.query,
        pg_stat_activity.state,
        pg_stat_activity.wait_event,
        usename as username,
        pg_stat_activity.application_name,
        pg_stat_activity.client_addr
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query NOT LIKE '%pg_stat_activity%'
    AND age(clock_timestamp(), query_start) > (threshold_ms || ' milliseconds')::INTERVAL
    ORDER BY duration DESC;
END;
$$ LANGUAGE plpgsql;

-- Database health check function
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT,
    severity TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Check table bloat
    RETURN QUERY
    SELECT 
        'table_bloat'::TEXT,
        CASE 
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.5 THEN 'CRITICAL'
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.2 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Max bloat ratio: ' || COALESCE(ROUND(MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) * 100, 2), 0) || '%',
        CASE 
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.5 THEN 'HIGH'
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        CASE 
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.2 
            THEN 'Run VACUUM ANALYZE on affected tables'
            ELSE 'No action needed'
        END
    FROM pg_stat_user_tables;
    
    -- Check connection usage
    RETURN QUERY
    SELECT 
        'connection_usage'::TEXT,
        CASE 
            WHEN COUNT(*) > 90 THEN 'CRITICAL'
            WHEN COUNT(*) > 80 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Active connections: ' || COUNT(*) || ' of 100',
        CASE 
            WHEN COUNT(*) > 90 THEN 'HIGH'
            WHEN COUNT(*) > 80 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        CASE 
            WHEN COUNT(*) > 80 
            THEN 'Consider connection pooling optimization'
            ELSE 'Connection usage is healthy'
        END
    FROM pg_stat_activity
    WHERE state = 'active';
    
    -- Check long-running queries
    RETURN QUERY
    SELECT 
        'long_running_queries'::TEXT,
        CASE 
            WHEN COUNT(*) > 5 THEN 'CRITICAL'
            WHEN COUNT(*) > 0 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Queries running > 5 minutes: ' || COUNT(*),
        CASE 
            WHEN COUNT(*) > 5 THEN 'HIGH'
            WHEN COUNT(*) > 0 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        CASE 
            WHEN COUNT(*) > 0 
            THEN 'Review and optimize slow queries'
            ELSE 'No long-running queries detected'
        END
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query NOT LIKE '%pg_stat_activity%'
    AND age(clock_timestamp(), query_start) > INTERVAL '5 minutes';
    
    -- Check cache hit ratio
    RETURN QUERY
    WITH cache_stats AS (
        SELECT 
            CASE 
                WHEN sum(heap_blks_read) + sum(heap_blks_hit) > 0 
                THEN round((sum(heap_blks_hit)::numeric / (sum(heap_blks_read) + sum(heap_blks_hit))) * 100, 2)
                ELSE 100
            END as hit_ratio
        FROM pg_statio_user_tables
    )
    SELECT 
        'cache_hit_ratio'::TEXT,
        CASE 
            WHEN hit_ratio < 90 THEN 'WARNING'
            WHEN hit_ratio < 95 THEN 'INFO'
            ELSE 'OK'
        END,
        'Cache hit ratio: ' || hit_ratio || '%',
        CASE 
            WHEN hit_ratio < 90 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        CASE 
            WHEN hit_ratio < 95 
            THEN 'Consider increasing shared_buffers'
            ELSE 'Cache performance is optimal'
        END
    FROM cache_stats;
    
    -- Check index usage
    RETURN QUERY
    SELECT 
        'unused_indexes'::TEXT,
        CASE 
            WHEN COUNT(*) > 10 THEN 'WARNING'
            WHEN COUNT(*) > 5 THEN 'INFO'
            ELSE 'OK'
        END,
        'Unused indexes: ' || COUNT(*),
        'LOW'::TEXT,
        CASE 
            WHEN COUNT(*) > 5 
            THEN 'Consider dropping unused indexes to save space'
            ELSE 'Index usage is efficient'
        END
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND indexrelid > 16384
    AND schemaname = 'public';
    
    -- Check materialized view freshness
    RETURN QUERY
    SELECT 
        'materialized_view_freshness'::TEXT,
        CASE 
            WHEN MAX(NOW() - last_refreshed) > INTERVAL '2 hours' THEN 'WARNING'
            WHEN MAX(NOW() - last_refreshed) > INTERVAL '1 hour' THEN 'INFO'
            ELSE 'OK'
        END,
        'Oldest refresh: ' || COALESCE(MAX(NOW() - last_refreshed)::TEXT, 'N/A'),
        CASE 
            WHEN MAX(NOW() - last_refreshed) > INTERVAL '2 hours' THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        CASE 
            WHEN MAX(NOW() - last_refreshed) > INTERVAL '1 hour' 
            THEN 'Refresh materialized views'
            ELSE 'Views are up to date'
        END
    FROM (
        SELECT last_refreshed FROM business_stats LIMIT 1
        UNION ALL
        SELECT last_refreshed FROM category_business_counts LIMIT 1
        UNION ALL
        SELECT last_refreshed FROM popular_searches LIMIT 1
    ) mv;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MAINTENANCE FUNCTIONS
-- =====================================================

-- Refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS TABLE(
    view_name TEXT,
    refresh_status TEXT,
    duration INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    -- Refresh business_stats
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY business_stats;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'business_stats'::TEXT, 'SUCCESS'::TEXT, end_time - start_time;
    
    -- Refresh category_business_counts
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY category_business_counts;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'category_business_counts'::TEXT, 'SUCCESS'::TEXT, end_time - start_time;
    
    -- Refresh popular_searches
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_searches;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'popular_searches'::TEXT, 'SUCCESS'::TEXT, end_time - start_time;
    
    -- Refresh top_businesses_by_category
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY top_businesses_by_category;
    end_time := clock_timestamp();
    RETURN QUERY SELECT 'top_businesses_by_category'::TEXT, 'SUCCESS'::TEXT, end_time - start_time;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'ERROR'::TEXT, SQLERRM::TEXT, NULL::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Vacuum and analyze tables
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS TABLE(
    table_name TEXT,
    action TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Vacuum and analyze tables with high dead tuple ratio
    FOR rec IN 
        SELECT 
            schemaname || '.' || tablename as full_table_name,
            n_dead_tup,
            n_live_tup
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        OR (n_live_tup > 0 AND n_dead_tup::numeric / n_live_tup > 0.1)
        OR last_vacuum < NOW() - INTERVAL '7 days'
        OR last_analyze < NOW() - INTERVAL '7 days'
    LOOP
        BEGIN
            EXECUTE 'VACUUM ANALYZE ' || rec.full_table_name;
            RETURN QUERY SELECT 
                rec.full_table_name::TEXT, 
                'VACUUM ANALYZE'::TEXT, 
                'SUCCESS'::TEXT,
                format('Dead tuples: %s, Live tuples: %s', rec.n_dead_tup, rec.n_live_tup)::TEXT;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                rec.full_table_name::TEXT, 
                'VACUUM ANALYZE'::TEXT, 
                'FAILED'::TEXT,
                SQLERRM::TEXT;
        END;
    END LOOP;
    
    -- Reindex tables if needed
    FOR rec IN 
        SELECT 
            schemaname || '.' || tablename as full_table_name
        FROM pg_stat_user_tables
        WHERE pg_total_relation_size(schemaname||'.'||tablename) > 100000000 -- 100MB
    LOOP
        BEGIN
            EXECUTE 'REINDEX TABLE CONCURRENTLY ' || rec.full_table_name;
            RETURN QUERY SELECT 
                rec.full_table_name::TEXT, 
                'REINDEX'::TEXT, 
                'SUCCESS'::TEXT,
                'Table reindexed successfully'::TEXT;
        EXCEPTION WHEN OTHERS THEN
            -- REINDEX CONCURRENTLY might not be available, try regular REINDEX
            BEGIN
                EXECUTE 'REINDEX TABLE ' || rec.full_table_name;
                RETURN QUERY SELECT 
                    rec.full_table_name::TEXT, 
                    'REINDEX'::TEXT, 
                    'SUCCESS'::TEXT,
                    'Table reindexed (non-concurrent)'::TEXT;
            EXCEPTION WHEN OTHERS THEN
                RETURN QUERY SELECT 
                    rec.full_table_name::TEXT, 
                    'REINDEX'::TEXT, 
                    'FAILED'::TEXT,
                    SQLERRM::TEXT;
            END;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- QUERY OPTIMIZATION HELPERS
-- =====================================================

-- Analyze query plan
CREATE OR REPLACE FUNCTION analyze_query_plan(query_text TEXT)
RETURNS TABLE(
    plan_line TEXT
) AS $$
BEGIN
    RETURN QUERY
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || query_text;
END;
$$ LANGUAGE plpgsql;

-- Get missing indexes suggestions
CREATE OR REPLACE FUNCTION suggest_missing_indexes()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    index_type TEXT,
    reason TEXT,
    estimated_benefit TEXT
) AS $$
BEGIN
    -- Find foreign keys without indexes
    RETURN QUERY
    SELECT 
        tc.table_name::TEXT,
        kcu.column_name::TEXT,
        'btree'::TEXT as index_type,
        'Foreign key without index'::TEXT as reason,
        'HIGH'::TEXT as estimated_benefit
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    LEFT JOIN pg_indexes pi
        ON pi.tablename = tc.table_name
        AND pi.indexdef LIKE '%' || kcu.column_name || '%'
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND pi.indexname IS NULL;
    
    -- Find columns frequently used in WHERE clauses without indexes
    RETURN QUERY
    WITH frequent_conditions AS (
        SELECT 
            tablename,
            attname,
            COUNT(*) as usage_count
        FROM pg_stat_statements pss
        CROSS JOIN LATERAL (
            SELECT 
                c.relname as tablename,
                a.attname
            FROM pg_class c
            JOIN pg_attribute a ON c.oid = a.attrelid
            WHERE c.relkind = 'r'
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND pss.query LIKE '%WHERE%' || a.attname || '%'
        ) t
        GROUP BY tablename, attname
        HAVING COUNT(*) > 10
    )
    SELECT 
        fc.tablename::TEXT,
        fc.attname::TEXT,
        'btree'::TEXT as index_type,
        format('Column used in WHERE clause %s times', fc.usage_count)::TEXT as reason,
        CASE 
            WHEN fc.usage_count > 100 THEN 'HIGH'
            WHEN fc.usage_count > 50 THEN 'MEDIUM'
            ELSE 'LOW'
        END::TEXT as estimated_benefit
    FROM frequent_conditions fc
    LEFT JOIN pg_indexes pi
        ON pi.tablename = fc.tablename
        AND pi.indexdef LIKE '%' || fc.attname || '%'
    WHERE pi.indexname IS NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
