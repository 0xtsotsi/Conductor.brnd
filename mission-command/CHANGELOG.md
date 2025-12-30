# Changelog

All notable changes to Mission Command Centre will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive project README with architecture diagrams
- Development guide for contributors
- Phase 4 implementation documentation
- Production hardening features

## [0.4.0] - 2024-12-29

### Added - Phase 4: GitHub Integration Hardening

#### Persistent Storage
- **PostgreSQL-backed storage** for suspended workflow runs
  - Table `mastra_suspended_runs` with proper indexes
  - TTL-based expiration (default: 7 days)
  - Automatic cleanup of expired runs
  - File: `src/server/suspended-runs-storage.ts`

#### Rate Limiting
- **Rate limiting middleware** for webhook endpoints
  - 100 requests/hour per IP (configurable)
  - In-memory storage with automatic cleanup
  - Rate limit headers in responses
  - Custom key generation support
  - File: `src/server/rate-limit.ts`

#### Automatic Cleanup
- **Background cleanup job** for stale suspended runs
  - Runs every hour (configurable)
  - Manual cleanup endpoint (`POST /webhooks/github/cleanup`)
  - Graceful shutdown support
  - Logging and callbacks
  - File: `src/server/cleanup.ts`

#### Documentation
- Example server initialization (`src/server/example.ts`)
- Complete Phase 4 implementation guide (`PHASE_4_IMPLEMENTATION.md`)
- Updated environment variables in `.env.example`

### Changed
- **Webhook handler** to use persistent storage instead of in-memory Map
- **`registerSuspendedRun()`** to async function
- **`findSuspendedRun()`** to async function
- **`removeSuspendedRun()`** to async function
- Health check to query storage for suspended runs count
- Updated exports in `src/server/index.ts`

### Removed
- **Duplicate file** `src/server/github-webhook-handler.ts` (functionality merged into `github-webhook.ts`)

### Security
- HMAC-SHA256 webhook signature verification
- Rate limiting (100 req/hour per IP)
- TTL-based expiration (7 days)
- Input validation with Zod schemas
- Environment-based secrets

## [0.3.0] - 2024-12-28

### Added - Phase 3: Mastra Server API Endpoints
- Mastra Server integration (port 4111)
- Auto-generated REST API for workflows
- Auto-generated REST API for agents
- Storage layer integration
- WebSocket support for real-time updates

### Changed
- Updated UI to use Mastra Server APIs
- Refactored workflow execution logic

## [0.2.0] - 2024-12-27

### Added - Phase 2: UI Integration with Mastra Auth & API
- React UI components with Vite
- Tailwind CSS styling
- Mission Catalog view
- Mission Runs view
- Approval Queue view
- Navigation component
- Integration with Mastra Server APIs

### Changed
- Moved from monolithic UI to component-based architecture
- Improved type safety across the codebase

## [0.1.0] - 2024-12-26

### Added - Phase 1: Vite React App Scaffolding
- Initial project structure
- Vite + React + TypeScript setup
- Base configuration files
- Package structure
- Initial GitHub tools (5 tools)
- Code Review workflow implementation
- Basic GitHub webhook handler

### Features
- GitHub agent tools:
  - `githubCreateBranch`
  - `githubCreatePR`
  - `githubGetDiff`
  - `githubMergePR`
  - `githubPostComment`
- Code Review workflow with human-in-the-loop approval
- Webhook handler for PR events

### Documentation
- GitHub Tools README
- Code Review Workflow documentation
- UI README
- Quick Start guide

## [0.0.1] - 2024-12-25

### Added
- Project initialization
- Mastra fork setup
- Base package structure
- Development environment configuration

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Versioning Strategy

- **Major version (X.0.0)**: Breaking changes, major features
- **Minor version (0.X.0)**: New features, backwards compatible
- **Patch version (0.0.X)**: Bug fixes, minor changes

## Release Notes

### v0.4.0 Highlights
This release focuses on **production hardening** of the GitHub integration. Key improvements include:

1. **Persistent Storage**: Suspended workflow runs now survive server restarts
2. **Rate Limiting**: Webhook endpoints are protected from abuse
3. **Automatic Cleanup**: Expired runs are automatically removed
4. **Complete Documentation**: Comprehensive guides for all features

### Migration Guide

#### From v0.3.x to v0.4.0

1. **Update environment variables**:
   ```bash
   # Add to .env
   DATABASE_URL=postgresql://...
   GITHUB_WEBHOOK_SECRET=...
   ```

2. **Initialize storage**:
   ```typescript
   import { createSuspendedRunsStorage, setSuspendedRunsStorage } from '@mission-command/server';

   const storage = createSuspendedRunsStorage({
     connectionString: process.env.DATABASE_URL,
   });

   await storage.init();
   setSuspendedRunsStorage(storage);
   ```

3. **Make async calls**:
   ```typescript
   // Before
   registerSuspendedRun({ ... });

   // After
   await registerSuspendedRun({ ... });
   ```

### Breaking Changes

- `registerSuspendedRun()` is now async
- `findSuspendedRun()` is now async
- `removeSuspendedRun()` is now async
- Removed `github-webhook-handler.ts` (use `github-webhook.ts`)

### Deprecation Notes

None at this time.

---

## Future Releases

### Upcoming in v0.5.0 - Phase 5: Authentication & User Management
- OAuth2/OIDC integration
- Role-based access control (RBAC)
- User management UI
- Session management

### Planned for v0.6.0 - Phase 6: Production Deployment Setup
- Docker containers
- Kubernetes manifests
- CI/CD pipelines
- Monitoring and alerting

### Planned for v0.7.0 - Phase 7: E2E Testing & Documentation
- E2E test suite
- Performance testing
- Security testing
- Complete documentation set

---

## Contributors

- @oxtsotsi - Project lead

## License

MIT License - see LICENSE file for details

---

**Note**: This project is in active development. Expect frequent updates and changes.
