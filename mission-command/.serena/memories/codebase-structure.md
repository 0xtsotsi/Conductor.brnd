# Codebase Structure

## Root Level
- `package.json` - Root package configuration
- `README.md` - Project documentation
- `docs/` - Full documentation site (Next.js)
- `packages/` - Core framework packages
- `stores/` - Storage adapters
- `deployers/` - Platform deployment adapters

## Mission Command Package
Located in `packages/mission-command/`:

### Source Structure
- `src/`
  - `server/`
    - `users-api.ts` - User management API endpoints
    - `oauth-handler.ts` - OAuth authentication handler
    - `user-storage.ts` - Database storage implementation
    - `audit-middleware.ts` - Audit logging middleware
    - `github-webhook.ts` - GitHub webhook handler
  - `tools/` - GitHub agent tools
  - `workflows/` - Mastra workflow definitions
  - `ui/` - React components (Vite app)
- `ui/`
  - `src/`
    - `pages/` - Page components
    - `providers/` - Context providers (Auth, etc.)
    - `components/` - Reusable UI components

### Key Components
#### Authentication
- OAuth flow for GitHub/Google
- JWT-based authentication
- Role-based access control (RBAC)
- Session management
- Refresh token rotation

#### User Management
- CRUD operations for users
- Role assignment (admin, operator, viewer)
- Session tracking and invalidation
- Audit logging

#### Database Tables
- `mission_command_users` - User accounts
- `mission_command_sessions` - Active sessions
- `mission_command_audit_log` - Activity logs
- `mission_command_refresh_tokens` - JWT refresh tokens

### Security Features
- HMAC-SHA256 webhook verification
- Rate limiting (100 requests/hour)
- TTL-based expiration
- Input validation with Zod
- Environment-based secrets