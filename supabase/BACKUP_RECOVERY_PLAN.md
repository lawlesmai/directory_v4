# Backup and Disaster Recovery Plan
## The Lawless Directory - Database Protection Strategy

## Table of Contents
1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Recovery Procedures](#recovery-procedures)
4. [Disaster Recovery Plan](#disaster-recovery-plan)
5. [Testing Procedures](#testing-procedures)
6. [Monitoring and Alerts](#monitoring-and-alerts)

## Overview

### Recovery Objectives
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 15 minutes
- **Data Retention Period**: 30 days
- **Backup Frequency**: Continuous (Point-in-Time Recovery)

### Backup Architecture

```mermaid
graph TB
    subgraph "Primary Database"
        PG[PostgreSQL Primary]
        WAL[WAL Archives]
    end
    
    subgraph "Backup Systems"
        PB[Point-in-Time Backups]
        DB[Daily Backups]
        WB[Weekly Backups]
    end
    
    subgraph "Storage Locations"
        S3[AWS S3 Bucket]
        GCS[Google Cloud Storage]
        LOCAL[Local Backup Server]
    end
    
    subgraph "Recovery Options"
        PITR[Point-in-Time Recovery]
        FULL[Full Restore]
        PARTIAL[Partial Restore]
    end
    
    PG --> WAL
    WAL --> PB
    PG --> DB
    DB --> WB
    
    PB --> S3
    DB --> S3
    WB --> GCS
    DB --> LOCAL
    
    S3 --> PITR
    S3 --> FULL
    LOCAL --> PARTIAL
```

## Backup Strategy

### 1. Automated Backup Configuration

#### Supabase Built-in Backups
```yaml
# Supabase automatically provides:
- Daily backups: Retained for 7 days (Free tier)
- Daily backups: Retained for 30 days (Pro tier)
- Point-in-time recovery: Up to 7 days (Pro tier)
- Point-in-time recovery: Up to 28 days (Enterprise tier)
```

#### Custom Backup Script
```bash
#!/bin/bash
# backup.sh - Custom backup script for additional protection

# Configuration
SUPABASE_DB_URL="${DATABASE_URL}"
BACKUP_DIR="/backups/supabase"
S3_BUCKET="lawless-directory-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DATE}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Perform backup
echo "Starting backup at $(date)"
pg_dump "${SUPABASE_DB_URL}" \
    --no-owner \
    --no-privileges \
    --verbose \
    --format=plain \
    --no-tablespaces \
    --no-unlogged-table-data \
    | gzip > "${BACKUP_FILE}"

# Check backup success
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"
    
    # Upload to S3
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/daily/" \
        --storage-class STANDARD_IA
    
    # Verify upload
    if [ $? -eq 0 ]; then
        echo "Backup uploaded to S3 successfully"
    else
        echo "ERROR: Failed to upload backup to S3"
        exit 1
    fi
else
    echo "ERROR: Backup failed"
    exit 1
fi

# Clean up old local backups (keep 7 days)
find ${BACKUP_DIR} -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup process completed at $(date)"
```

### 2. Backup Schedule

```yaml
Backup Schedule:
  Continuous:
    - WAL archiving: Every transaction
    - Archive timeout: 60 seconds
  
  Hourly:
    - Incremental backup: Top of every hour
    - Retention: 24 hours
  
  Daily:
    - Full backup: 2:00 AM UTC
    - Retention: 30 days
    - Storage: S3 Standard-IA
  
  Weekly:
    - Full backup: Sunday 3:00 AM UTC
    - Retention: 90 days
    - Storage: S3 Glacier
  
  Monthly:
    - Full backup: First Sunday of month
    - Retention: 1 year
    - Storage: S3 Glacier Deep Archive
```

## Recovery Procedures

### 1. Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# pitr_recovery.sh - Point-in-time recovery script

# Configuration
TARGET_TIME="2025-01-24 14:30:00"
RECOVERY_DB="postgresql://user:pass@recovery-host:5432/postgres"
WAL_BUCKET="s3://lawless-directory-backups/wal/"

# Step 1: Stop the database
pg_ctl stop -D /var/lib/postgresql/data

# Step 2: Clear the data directory (backup first!)
mv /var/lib/postgresql/data /var/lib/postgresql/data.old
mkdir /var/lib/postgresql/data

# Step 3: Restore base backup
pg_basebackup \
    --pgdata=/var/lib/postgresql/data \
    --source-server="${DATABASE_URL}" \
    --checkpoint=fast \
    --write-recovery-conf

# Step 4: Configure recovery
cat > /var/lib/postgresql/data/postgresql.auto.conf << EOF
restore_command = 'aws s3 cp ${WAL_BUCKET}%f %p'
recovery_target_time = '${TARGET_TIME}'
recovery_target_action = 'promote'
EOF

# Step 5: Start recovery
pg_ctl start -D /var/lib/postgresql/data

# Step 6: Monitor recovery
tail -f /var/lib/postgresql/data/log/postgresql-*.log
```

### 2. Full Database Restore

```bash
#!/bin/bash
# full_restore.sh - Complete database restoration

# Configuration
BACKUP_FILE=$1
TARGET_DB="${DATABASE_URL}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./full_restore.sh <backup_file>"
    exit 1
fi

echo "WARNING: This will replace the entire database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Step 1: Download backup from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
    LOCAL_FILE="/tmp/restore_$(date +%Y%m%d_%H%M%S).sql.gz"
    aws s3 cp "$BACKUP_FILE" "$LOCAL_FILE"
    BACKUP_FILE=$LOCAL_FILE
fi

# Step 2: Drop existing connections
psql "${TARGET_DB}" << EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
AND pid <> pg_backend_pid();
EOF

# Step 3: Restore database
gunzip -c "$BACKUP_FILE" | psql "${TARGET_DB}" \
    --single-transaction \
    --set ON_ERROR_STOP=on

if [ $? -eq 0 ]; then
    echo "Restore completed successfully"
    
    # Step 4: Verify restoration
    psql "${TARGET_DB}" << EOF
    SELECT 
        'Tables' as object_type,
        COUNT(*) as count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    UNION ALL
    SELECT 
        'Businesses' as object_type,
        COUNT(*) as count
    FROM businesses
    UNION ALL
    SELECT 
        'Reviews' as object_type,
        COUNT(*) as count
    FROM business_reviews;
EOF
else
    echo "ERROR: Restore failed"
    exit 1
fi

# Clean up temporary file
if [ -n "$LOCAL_FILE" ]; then
    rm -f "$LOCAL_FILE"
fi
```

## Disaster Recovery Plan

### 1. Disaster Scenarios and Response

| Scenario | RTO | RPO | Recovery Method |
|----------|-----|-----|-----------------|
| Accidental data deletion | 30 min | 0 min | PITR to moment before deletion |
| Database corruption | 1 hour | 15 min | Restore from latest backup + WAL |
| Complete region failure | 2 hours | 1 hour | Failover to standby region |
| Ransomware attack | 4 hours | 1 day | Restore from isolated backup |
| Hardware failure | 30 min | 0 min | Automatic failover (Supabase managed) |

### 2. Emergency Response Procedures

```markdown
## EMERGENCY RESPONSE CHECKLIST

### Phase 1: Assessment (0-15 minutes)
- [ ] Identify the nature and scope of the incident
- [ ] Assess data loss potential
- [ ] Notify incident response team
- [ ] Document incident start time

### Phase 2: Containment (15-30 minutes)
- [ ] Isolate affected systems if necessary
- [ ] Stop write operations if data corruption detected
- [ ] Capture current system state for analysis
- [ ] Initiate communication protocol

### Phase 3: Recovery (30-60 minutes)
- [ ] Select appropriate recovery method
- [ ] Execute recovery procedure
- [ ] Monitor recovery progress
- [ ] Verify data integrity

### Phase 4: Validation (60-90 minutes)
- [ ] Run integrity checks
- [ ] Test critical functionality
- [ ] Compare record counts with expected values
- [ ] Verify user access

### Phase 5: Communication
- [ ] Update status page
- [ ] Notify affected users
- [ ] Document lessons learned
- [ ] Schedule post-mortem meeting
```

## Testing Procedures

### 1. Backup Verification

```bash
#!/bin/bash
# verify_backup.sh - Automated backup verification

BACKUP_FILE=$1
TEST_DB="postgresql://postgres:password@localhost:5432/test_restore"

# Create test database
createdb test_restore

# Attempt restore
gunzip -c "$BACKUP_FILE" | psql "${TEST_DB}" 2>&1

if [ $? -eq 0 ]; then
    # Run verification queries
    RESULT=$(psql "${TEST_DB}" -t -c "
        SELECT 
            CASE 
                WHEN COUNT(*) > 0 THEN 'PASS'
                ELSE 'FAIL'
            END
        FROM businesses;
    ")
    
    if [ "$RESULT" = "PASS" ]; then
        echo "✓ Backup verification passed"
    else
        echo "✗ Backup verification failed: No data found"
    fi
else
    echo "✗ Backup verification failed: Restore error"
fi

# Clean up
dropdb test_restore
```

### 2. Recovery Drill Schedule

```yaml
Recovery Testing Schedule:
  Weekly:
    - Test: Restore single table
    - Duration: 30 minutes
    - Environment: Development
  
  Monthly:
    - Test: Point-in-time recovery
    - Duration: 1 hour
    - Environment: Staging
  
  Quarterly:
    - Test: Full disaster recovery
    - Duration: 4 hours
    - Environment: DR site
  
  Annually:
    - Test: Complete region failover
    - Duration: 8 hours
    - Environment: Production (scheduled maintenance)
```

## Monitoring and Alerts

### 1. Alert Configuration

```yaml
Alerting Rules:
  Critical:
    - Backup failure (immediate)
    - No backup for 24+ hours
    - Replication lag > 5 minutes
    - Storage space < 10%
  
  Warning:
    - Backup duration > 2x average
    - Backup size anomaly (>3 std dev)
    - Replication lag > 1 minute
    - Storage space < 20%
  
  Info:
    - Successful backup completion
    - Recovery drill results
    - Monthly backup statistics
```

### 2. Monitoring Queries

```sql
-- Check backup health
CREATE OR REPLACE FUNCTION check_backup_health()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    last_backup TEXT,
    alert_required BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'last_backup_time'::TEXT,
        CASE 
            WHEN MAX(created_at) < NOW() - INTERVAL '25 hours' THEN 'CRITICAL'
            WHEN MAX(created_at) < NOW() - INTERVAL '13 hours' THEN 'WARNING'
            ELSE 'OK'
        END,
        MAX(created_at)::TEXT,
        MAX(created_at) < NOW() - INTERVAL '25 hours'
    FROM backup_monitoring
    WHERE status = 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
```

## Recovery Time Estimates

| Recovery Scenario | Data Size | Method | Estimated Time |
|------------------|-----------|--------|----------------|
| Last 5 minutes | Any | WAL replay | < 1 minute |
| Last hour | < 10GB | PITR | < 10 minutes |
| Last 24 hours | < 50GB | Daily backup + WAL | < 30 minutes |
| Last week | < 100GB | Weekly backup + WAL | < 1 hour |
| Complete restore | < 500GB | Full backup | < 2 hours |
| Region failover | Any | Standby promotion | < 5 minutes |

## Contact Information

### Escalation Path

1. **Level 1 - On-call Engineer**
   - Response time: 5 minutes
   - Phone: +1-555-0911
   - Email: oncall@lawlessdirectory.com

2. **Level 2 - Database Administrator**
   - Response time: 15 minutes
   - Phone: +1-555-0912
   - Email: dba@lawlessdirectory.com

3. **Level 3 - Infrastructure Lead**
   - Response time: 30 minutes
   - Phone: +1-555-0913
   - Email: infrastructure@lawlessdirectory.com

### External Support

- **Supabase Support**: support@supabase.io
- **AWS Support**: Via AWS Console (Enterprise Support)
- **Security Team**: security@lawlessdirectory.com

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-24 | Backend Architect | Initial disaster recovery plan |

---

**Note**: This document should be reviewed quarterly and updated based on recovery drill results and infrastructure changes.
