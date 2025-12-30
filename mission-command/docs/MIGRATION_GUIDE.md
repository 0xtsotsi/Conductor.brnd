# Mission Command Migration Guide

Guidance for migrating between versions of Mission Command Centre.

---

## Version Migration Paths

| From Version | To Version | Complexity | Downtime Required |
|--------------|-------------|------------|-------------------|
| 0.x | 1.x | High | Yes |
| 1.x | 1.y | Medium | No |
| 1.x | 2.x | High | Yes |

---

## Pre-Migration Checklist

Before starting any migration:

- [ ] **Backup Database**
  ```bash
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```

- [ ] **Export Configuration**
  ```bash
  cp .env .env.backup
  ```

- [ ] **Document Current State**
  - Note custom workflow configurations
  - Document any custom integrations
  - Record active webhook URLs

- [ ] **Schedule Maintenance Window**
  - Notify users of planned downtime
  - Schedule during low-traffic period

- [ ] **Test Migration in Staging**
  - Run full migration on staging environment first
  - Verify all functionality works

---

## Migrating from 0.x to 1.0

### Breaking Changes

1. **Database Schema Changes**
   - Users table: Added `provider` and `provider_id` columns
   - Sessions table: Added `ip_address` and `user_agent`
   - Audit log: Added `resource_type` and `resource_id`

2. **Authentication Flow Changes**
   - OAuth callback URL path changed
   - JWT token structure includes new fields

3. **API Endpoint Changes**
   - `/api/missions` → `/api/missions/active`
   - `/api/approvals` query parameters changed

### Migration Steps

#### Step 1: Update Dependencies

```bash
cd /path/to/Conductor-brnd
git pull origin main
pnpm install
```

#### Step 2: Run Database Migrations

```sql
-- Add provider columns to users table
ALTER TABLE mission_command_users
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'github',
  ADD COLUMN IF NOT EXISTS provider_id TEXT NOT NULL DEFAULT '';

-- Create index on provider_id
CREATE INDEX IF NOT EXISTS idx_users_provider_id
  ON mission_command_users(provider, provider_id);

-- Add session tracking columns
ALTER TABLE mission_command_sessions
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Update audit log structure
ALTER TABLE mission_command_audit_log
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT;
```

#### Step 3: Update Environment Variables

```bash
# Add new OAuth variables
GITHUB_CLIENT_ID=ghp_xxx
GITHUB_CLIENT_SECRET=ghp_xxx
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX_xxx

# Update callback URLs
# Old: /auth/callback
# New: /api/auth/callback
```

#### Step 4: Update Webhook URLs

```bash
# Update GitHub webhook URLs in repositories
# Old: https://your-domain.com/webhooks/github
# New: https://your-domain.com/api/webhooks/github
```

#### Step 5: Rebuild and Restart

```bash
pnpm build
pnpm run dev:server

# Or for production
pnpm run start:prod
```

#### Step 6: Verify Migration

```bash
# Test authentication
curl -X GET http://localhost:4111/api/auth/me

# List workflows
curl -X GET http://localhost:4111/api/workflows

# Check database integrity
psql $DATABASE_URL -c "\dt"
```

---

## Migrating from 1.x to 2.0

### Breaking Changes

1. **RBAC System**
   - Role management moved to database
   - Default role changed from `operator` to `viewer`

2. **Workflow Storage**
   - Workflow definitions now stored in database
   - In-memory storage removed

3. **UI Changes**
   - React Router v7 required
   - AuthProvider API changed

### Migration Steps

#### Step 1: Backup Existing Data

```bash
# Export workflow definitions
curl -H "Authorization: Bearer $JWT" \
  http://localhost:4111/api/workflows/definitions > workflows-backup.json

# Backup database
pg_dump $DATABASE_URL > backup-pre-2.0.sql
```

#### Step 2: Run Database Migrations

```sql
-- Create workflow definitions table
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on workflow name
CREATE INDEX idx_workflow_definitions_name
  ON workflow_definitions(name);

-- Migrate existing workflows from code to database
-- (Run migration script provided)
```

#### Step 3: Update UI Dependencies

```bash
cd ui
pnpm install

# Update React Router
pnpm add react-router@7
```

#### Step 4: Update AuthProvider Usage

```typescript
// Old
import { AuthProvider } from '@mission-command/ui';

<AuthProvider>
  <App />
</AuthProvider>

// New
import { AuthProvider } from '@mission-command/ui';
import type { MissionCommandUser } from '@mastra/auth';

const authConfig = {
  onLogin: (user: MissionCommandUser) => {
    console.log('User logged in:', user.email);
  },
  onLogout: () => {
    console.log('User logged out');
  }
};

<AuthProvider config={authConfig}>
  <App />
</AuthProvider>
```

#### Step 5: Update Admin Configuration

```bash
# Add to .env
ADMIN_EMAILS=admin@company.com
ADMIN_DOMAINS=company.com

# This replaces hardcoded admin checks
```

---

## Database Migration Best Practices

### Using Migration Tools

```bash
# Install migration tool
pnpm add -D dbmate

# Create migration
dbmate new add_provider_columns

# Run migrations
dbmate up

# Rollback if needed
dbmate rollback
```

### Zero-Downtime Migration

For production environments:

```sql
-- 1. Add new columns (nullable)
ALTER TABLE mission_command_users
  ADD COLUMN provider TEXT;

-- 2. Backfill data
UPDATE mission_command_users
SET provider = 'github'
WHERE provider IS NULL;

-- 3. Add NOT NULL constraint
ALTER TABLE mission_command_users
  ALTER COLUMN provider SET NOT NULL;

-- 4. Drop old columns
ALTER TABLE mission_command_users
  DROP COLUMN old_field;
```

---

## Configuration Migration

### Environment Variables

Create a mapping file for deprecated variables:

```bash
# Deprecated (0.x)
AUTH_SECRET=xxx
OAUTH_GITHUB_CLIENT_ID=xxx

# New (1.x)
JWT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
```

### Update Scripts

```bash
# Create migration script
cat > migrate-env.sh << 'EOF'
#!/bin/bash
sed -i 's/AUTH_SECRET/JWT_SECRET/g' .env
sed -i 's/OAUTH_GITHUB_CLIENT_ID/GITHUB_CLIENT_ID/g' .env
echo "Environment variables migrated"
EOF

chmod +x migrate-env.sh
./migrate-env.sh
```

---

## Rollback Procedure

If migration fails:

### Database Rollback

```bash
# Restore from backup
psql $DATABASE_URL < backup-pre-migration.sql

# Or use migration tool
dbmate rollback
```

### Code Rollback

```bash
# Revert to previous version
git checkout tags/v1.0.0

# Rebuild
pnpm build

# Restart
pnpm run start:prod
```

### Data Reconciliation

If migration completed but issues found:

```sql
-- Identify lost data
SELECT * FROM mission_command_users
WHERE provider IS NULL;

-- Manually reconcile data
UPDATE mission_command_users
SET provider = 'github',
    provider_id = sub
WHERE provider IS NULL;
```

---

## Testing Migration

### Pre-Migration Testing

```bash
# Clone production database to staging
pg_dump $PRODUCTION_DATABASE_URL | psql $STAGING_DATABASE_URL

# Run migration on staging
cd /path/to/mission-command
git checkout new-version
pnpm build
DATABASE_URL=$STAGING_DATABASE_URL pnpm run db:migrate

# Run tests against staging
DATABASE_URL=$STAGING_DATABASE_URL pnpm test
```

### Post-Migration Verification

```bash
# Verify critical endpoints
for endpoint in "/api/auth/me" "/api/workflows" "/api/approvals"; do
  echo "Testing: $endpoint"
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $JWT" \
    http://localhost:4111$endpoint
done

# Expected output: 200 for all endpoints
```

---

## Common Migration Issues

### Issue: Foreign Key Constraint Errors

**Error:**
```
ERROR: insert or update on table violates foreign key constraint
```

**Solution:**

```sql
-- Disable constraints during migration
SET CONSTRAINTS ALL DEFERRED;

-- Run migration

-- Re-enable constraints
SET CONSTRAINTS ALL IMMEDIATE;
```

### Issue: Duplicate Data After Migration

**Solution:**

```sql
-- Identify duplicates
SELECT email, COUNT(*)
FROM mission_command_users
GROUP BY email
HAVING COUNT(*) > 1;

-- Remove duplicates (keep newest)
DELETE FROM mission_command_users
WHERE id NOT IN (
  SELECT MAX(id)
  FROM mission_command_users
  GROUP BY email
);
```

### Issue: Missing Environment Variables

**Solution:**

```bash
# Compare .env.example with current .env
diff .env.example .env

# Add missing variables
grep -v '^#' .env.example | while read -r line; do
  key=$(echo "$line" | cut -d= -f1)
  if ! grep -q "^$key" .env; then
    echo "$key not found in .env, adding..."
    echo "$line" >> .env
  fi
done
```

---

## Migration Timeline

### Small Deployment (< 100 users)

| Phase | Duration | Tasks |
|-------|----------|-------|
| Preparation | 1 day | Backup, staging test |
| Migration | 1 hour | Database migration, code deployment |
| Verification | 2 hours | Testing, monitoring |
| Total | ~1 day | Complete migration |

### Medium Deployment (100-1000 users)

| Phase | Duration | Tasks |
|-------|----------|-------|
| Preparation | 2-3 days | Backup, staging test, documentation |
| Migration | 2-4 hours | Database migration, rolling deployment |
| Verification | 4-6 hours | Testing, user acceptance |
| Total | ~1 week | Complete migration |

### Large Deployment (1000+ users)

| Phase | Duration | Tasks |
|-------|----------|-------|
| Preparation | 1-2 weeks | Full backup, staging tests, training |
| Migration | 4-8 hours | Blue-green deployment, data migration |
| Verification | 1-2 days | Extensive testing, gradual rollout |
| Total | ~1 month | Complete migration |

---

## Post-Migration Tasks

- [ ] Update documentation with new features
- [ ] Train users on new features/UI changes
- [ ] Monitor error logs for 48 hours
- [ ] Review performance metrics
- [ ] Update runbooks and troubleshooting guides
- [ ] Clean up old database tables (after 30 days)
- [ ] Update CI/CD pipelines

---

## Support

For migration assistance:

1. Review this guide thoroughly
2. Test in staging environment first
3. Create database backup before migrating
4. Monitor logs during migration
5. Report issues with full error messages and context

For additional help:
- GitHub Issues: https://github.com/mastra-ai/mastra/issues
- Documentation: https://docs.mastra.ai
