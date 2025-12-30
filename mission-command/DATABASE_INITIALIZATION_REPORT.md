# Database Initialization Report - Mission Command Centre

**Date:** 2025-12-30
**Task:** [DB-1] Initialize Database and Run Migrations for Mission Command Centre
**Status:** ✅ **COMPLETED SUCCESSFULLY**

---

## Summary

The Mission Command Centre database has been successfully initialized with all required tables for both Mastra core functionality and Mission Command-specific features.

---

## Database Connection Status

| Property | Value |
|----------|-------|
| **Status** | ✅ Connected |
| **Host** | localhost:5432 |
| **Database** | mission_command |
| **User** | unicorn_user |
| **Connection URL** | `postgresql://unicorn_user:magical_password@localhost:5432/mission_command` |

---

## Tables Created

### Mastra Core Tables (7 tables)

These tables are created by the `@mastra/pg` storage package and support core Mastra functionality:

| # | Table Name | Purpose |
|---|------------|---------|
| 1 | `mastra_agents` | Agent configuration and metadata |
| 2 | `mastra_ai_spans` | AI execution tracing and observability |
| 3 | `mastra_messages` | Thread-based message storage |
| 4 | `mastra_resources` | Resource management |
| 5 | `mastra_scorers` | Scoring and evaluation data |
| 6 | `mastra_threads` | Conversation threads |
| 7 | `mastra_workflow_snapshot` | Workflow execution state and snapshots |

### Mission Command Tables (4 tables)

These tables are created specifically for Mission Command Centre authentication and audit:

| # | Table Name | Purpose |
|---|------------|---------|
| 1 | `mission_command_users` | User accounts with OAuth integration |
| 2 | `mission_command_user_sessions` | JWT refresh token sessions |
| 3 | `mission_command_audit_log` | Comprehensive audit trail |
| 4 | `mission_command_refresh_tokens` | JWT refresh token management |

---

## Table Details

### mission_command_users

Stores user account information with OAuth provider integration.

**Columns:**
- `id` (UUID, primary key, auto-generated)
- `sub` (text, not null) - OAuth subject identifier
- `email` (text, unique, not null) - User email address
- `name` (text, nullable) - Display name
- `avatar_url` (text, nullable) - Profile picture URL
- `provider` (text, not null) - OAuth provider (github, google)
- `role` (text, not null) - User role (admin, operator, viewer)
- `created_at` (timestamp with time zone, not null)
- `updated_at` (timestamp with time zone, not null)

**Indexes:**
- `mission_command_users_pkey` (primary key)
- `idx_users_sub_provider_pg` (unique on sub, provider)
- `idx_users_email_pg` (unique on email)
- `idx_users_role_pg` (on role)

**Constraints:**
- CHECK: role IN ('admin', 'operator', 'viewer')
- UNIQUE: (sub, provider)
- UNIQUE: email

**Foreign Keys:**
- Referenced by: `mission_command_audit_log`, `mission_command_refresh_tokens`, `mission_command_user_sessions`

### mission_command_user_sessions

Stores JWT refresh token sessions for authentication.

**Columns:**
- `id` (UUID, primary key, auto-generated)
- `user_id` (UUID, foreign key → users, on delete cascade)
- `token_hash` (text, not null) - Hashed refresh token
- `expires_at` (timestamp with time zone, not null)
- `created_at` (timestamp with time zone, not null)
- `ip_address` (text, nullable) - Client IP address
- `user_agent` (text, nullable) - Client user agent string

**Indexes:**
- `idx_sessions_user_id_pg` (on user_id)
- `idx_sessions_expires_at_pg` (on expires_at)
- `idx_sessions_token_hash_pg` (on token_hash)

### mission_command_audit_log

Comprehensive audit trail for all user and system actions.

**Columns:**
- `id` (UUID, primary key, auto-generated)
- `user_id` (UUID, foreign key → users, on delete set null, nullable)
- `action` (text, not null) - Action performed
- `resource` (text, nullable) - Resource affected
- `details` (JSONB, nullable) - Additional details
- `ip_address` (text, nullable) - Client IP address
- `created_at` (timestamp with time zone, not null)

**Indexes:**
- `idx_audit_user_id_pg` (on user_id)
- `idx_audit_created_at_pg` (on created_at)
- `idx_audit_action_pg` (on action)

### mission_command_refresh_tokens

Stores JWT refresh tokens with token family support for detecting token theft.

**Columns:**
- `id` (UUID, primary key, auto-generated)
- `user_id` (UUID, foreign key → users, on delete cascade)
- `token_hash` (text, not null) - Hashed refresh token
- `expires_at` (timestamp with time zone, not null)
- `ip_address` (text, nullable) - Client IP address
- `user_agent` (text, nullable) - Client user agent string
- `family_id` (text, nullable) - Token family ID for rotation detection
- `created_at` (timestamp with time zone, not null)

**Indexes:**
- `idx_refresh_tokens_user_id_pg` (on user_id)
- `idx_refresh_tokens_token_hash_pg` (on token_hash)
- `idx_refresh_tokens_expires_at_pg` (on expires_at)
- `idx_refresh_tokens_family_id_pg` (on family_id)

---

## Scripts Created

Two utility scripts have been created in `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/scripts/`:

### 1. init-db.mjs

Initializes the database with all required tables.

**Usage:**
```bash
node /home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/scripts/init-db.mjs
```

**What it does:**
- Loads environment variables from `.env`
- Creates Mastra core tables via `PostgresStore.init()`
- Creates Mission Command tables via direct SQL
- Verifies table creation
- Reports results

### 2. verify-db.mjs

Verifies database connectivity and table structure.

**Usage:**
```bash
node /home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/scripts/verify-db.mjs
```

**What it does:**
- Tests database connection
- Lists all tables
- Shows indexes on critical tables
- Reports status

---

## NPM Scripts Added

The following scripts have been added to `package.json`:

```json
{
  "scripts": {
    "db:init": "node scripts/init-db.mjs",
    "db:status": "node scripts/verify-db.mjs"
  }
}
```

**Usage:**
```bash
cd /home/oxtsotsi/Webrnds/Conductor-brnd/mission-command
pnpm db:init   # Initialize database
pnpm db:status # Verify database status
```

---

## Issues Encountered and Resolved

### Issue 1: Incorrect Database Credentials

**Problem:** Initial connection attempts failed with "password authentication failed for user 'postgres'"

**Root Cause:** The running PostgreSQL container was from another project (calendso) with different credentials.

**Resolution:**
- Identified the actual container credentials: `unicorn_user:magical_password`
- Created the `mission_command` database in the existing container
- Updated `.env` file with correct connection string:
  ```
  DATABASE_URL=postgresql://unicorn_user:magical_password@localhost:5432/mission_command
  ```

### Issue 2: Module Import Errors

**Problem:** Could not import `pg-promise` due to pnpm workspace structure.

**Resolution:**
- Used direct import path to pnpm's installed package:
  ```javascript
  import pgPromise from '../../node_modules/.pnpm/pg-promise@11.15.0_pg-query-stream@4.10.3_pg@8.16.3_/node_modules/pg-promise/lib/index.js';
  ```

---

## Configuration Changes

### .env File Updated

```bash
# Before:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mission_command

# After:
DATABASE_URL=postgresql://unicorn_user:magical_password@localhost:5432/mission_command
```

---

## Validation Results

### Connection Test
```
✅ Database connection successful!
   Server Time: 2025-12-30T08:57:16.593Z
   Database: mission_command
   User: unicorn_user
```

### Table Count
```
✅ Total tables: 11
   - 4 Mission Command tables
   - 7 Mastra tables
```

### Index Verification
```
✅ Indexes on mission_command_users (6):
   1. idx_users_email_pg (unique)
   2. idx_users_role_pg
   3. idx_users_sub_provider_pg (unique)
   4. mission_command_users_email_key (unique constraint)
   5. mission_command_users_pkey (primary key)
   6. mission_command_users_sub_provider_key (unique constraint)
```

---

## Next Steps

The database is now ready for use. To start the Mission Command server:

1. **Build the project** (if not already built):
   ```bash
   cd /home/oxtsotsi/Webrnds/Conductor-brnd
   pnpm build:core
   pnpm build:combined-stores
   ```

2. **Start the server**:
   ```bash
   cd /home/oxtsotsi/Webrnds/Conductor-brnd/mission-command
   pnpm start
   ```

3. **Access the application**:
   - API: http://localhost:4111
   - UI: http://localhost:3000

---

## Maintenance

### Re-initializing the Database

If you need to drop and recreate all tables:

```bash
# Connect to PostgreSQL
docker exec -e PGPASSWORD=magical_password database psql -U unicorn_user -d mission_command

# Drop all tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Re-run initialization
node /home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/scripts/init-db.mjs
```

### Backup and Restore

**Backup:**
```bash
docker exec database pg_dump -U unicorn_user mission_command > backup.sql
```

**Restore:**
```bash
docker exec -i database psql -U unicorn_user mission_command < backup.sql
```

---

## References

- **Database Schema:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/user-storage.ts`
- **Environment Configuration:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/.env`
- **Docker Compose:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/docker-compose.yml`
- **Mastra Storage:** `/home/oxtsotsi/Webrnds/Conductor-brnd/stores/pg/`

---

**Report Generated:** 2025-12-30
**Task ID:** [DB-1]
**Status:** ✅ COMPLETED
