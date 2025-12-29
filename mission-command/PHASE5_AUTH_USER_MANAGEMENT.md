# Phase 5: Authentication & User Management - Implementation Plan

## Overview
Phase 5 implements production-ready OAuth authentication and user management for Mission Command Centre.

## Current Implementation Status

### ✅ Completed (This Session)
1. **OAuth Auth Handler** (`src/server/auth-handler.ts`)
   - GitHub OAuth2 flow
   - Google OAuth2 flow
   - JWT token generation
   - User role determination based on email/domain
   - CSRF protection with state parameter

2. **Environment Configuration** (`.env.example`)
   - JWT secret configuration
   - GitHub OAuth credentials
   - Google OAuth credentials
   - Admin domain/email whitelists

### ⏳ Remaining Work (For Future Sessions)

#### 1. Database Schema
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  sub VARCHAR(255) UNIQUE NOT NULL,  -- Provider-specific user ID
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  provider VARCHAR(20) NOT NULL,  -- github, google
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- User sessions table
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log table
CREATE TABLE auth_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  event VARCHAR(50) NOT NULL,  -- login, logout, role_change
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. API Endpoints

**Auth Endpoints:**
```
GET  /api/auth/github         - Redirect to GitHub OAuth
GET  /api/auth/google         - Redirect to Google OAuth
GET  /api/auth/github/callback - GitHub OAuth callback
GET  /api/auth/google/callback - Google OAuth callback
POST /api/auth/refresh        - Refresh JWT token
POST /api/auth/logout         - Invalidate session
```

**User Management Endpoints (Admin Only):**
```
GET    /api/admin/users        - List all users
GET    /api/admin/users/:id    - Get user details
PUT    /api/admin/users/:id    - Update user role
DELETE /api/admin/users/:id    - Delete user
GET    /api/admin/users/:id/audit - Get user audit log
```

#### 3. User Management UI Component

**File:** `ui/src/pages/UsersPage.tsx`

Features:
- Table of all users with email, role, provider, last login
- Role dropdown (admin | operator | viewer)
- Create user button (for manual user creation)
- Delete user button (with confirmation)
- Filter/search users
- Audit log viewer per user
- Role change confirmation dialog

#### 4. Production Requirements

**Security:**
- [ ] Rate limiting on auth endpoints (10 req/min per IP)
- [ ] CSRF token validation
- [ ] HTTPS enforcement in production
- [ ] Secure cookie flags (httpOnly, secure, sameSite)
- [ ] Token rotation on refresh
- [ ] Password reset flow (for email/password users)

**Performance:**
- [ ] Redis for session storage
- [ ] Database connection pooling
- [ ] Cached role lookups
- [ ] Indexed database queries

**Compliance:**
- [ ] GDPR data export endpoint
- [ ] Data retention policies
- [ ] Privacy policy agreement
- [ ] Cookie consent banner

## Integration with Existing Code

### 1. Update LoginPage (Phase 2)
Replace mock login with real OAuth:

```typescript
// src/pages/LoginPage.tsx
const handleOAuthLogin = (provider: string) => {
  const oauthUrl = `/api/auth/${provider}?redirect=${encodeURIComponent(redirectTo)}`;
  window.location.href = oauthUrl;
};
```

### 2. Update AuthProvider (Phase 2)
Add token refresh logic:

```typescript
// src/providers/AuthProvider.tsx
useEffect(() => {
  const refreshInterval = setInterval(async () => {
    const token = localStorage.getItem('mastra_auth_token');
    if (token) {
      const decoded = jwtDecode(token);
      const exp = decoded.exp * 1000;
      const now = Date.now();

      // Refresh 5 minutes before expiry
      if (exp - now < 5 * 60 * 1000) {
        const newToken = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(d => d.token);
        login(newToken);
      }
    }
  }, 60000); // Check every minute

  return () => clearInterval(refreshInterval);
}, [login]);
```

### 3. Server Integration
Register auth routes with Mastra server:

```typescript
// mission-command/src/server/index.ts
import { Hono } from 'hono';
import {
  handleOAuthLogin,
  handleOAuthCallback,
} from './auth-handler';

const authRoutes = new Hono();

authRoutes.get('/github', async (c) => {
  const redirect = c.req.query('redirect');
  const result = await handleOAuthLogin('github', redirect);
  return c.redirect(result.redirectUrl);
});

authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const result = await handleOAuthCallback('github', code, state);

  // Redirect to frontend with token
  return c.redirect(`/?token=${result.token}`);
});

// Similar for Google...
```

## Testing Strategy

### Unit Tests
- [ ] OAuth handler functions
- [ ] JWT generation/verification
- [ ] Role determination logic
- [ ] User CRUD operations

### Integration Tests
- [ ] Complete OAuth flow (mock provider)
- [ ] Token refresh cycle
- [ ] Role-based access control
- [ ] Session management

### E2E Tests
- [ ] User login flow
- [ ] Admin manages users
- [ ] Role-based UI element visibility
- [ ] Logout and session cleanup

## Deployment Checklist

### Pre-Deployment
- [ ] Generate strong JWT secret
- [ ] Create GitHub OAuth app
- [ ] Create Google OAuth credentials
- [ ] Configure admin email/domain whitelist
- [ ] Run database migrations
- [ ] Test complete auth flow

### Post-Deployment
- [ ] Monitor auth error rates
- [ ] Check OAuth callback success rate
- [ ] Verify user role assignments
- [ ] Audit login events

## Migration from Development Mode

**Before (Phase 2):**
- Mock JWT tokens
- Hardcoded admin role
- No user persistence

**After (Phase 5 Complete):**
- Real OAuth tokens
- Role from database/email
- User sessions in database
- Audit logging

## Success Criteria

- [ ] User can login via GitHub
- [ ] User can login via Google
- [ ] User sees correct role based on email/domain
- [ ] Admin can view all users
- [ ] Admin can change user roles
- [ ] Sessions persist across browser restarts
- [ ] Logout invalidates session
- [ ] Audit log tracks auth events

## Estimated Completion Time

**Completed:** 2 hours (OAuth handler + env config)
**Remaining:** 4-6 hours (database, API, UI, testing)

---

**Status:** Phase 5 Partially Complete (OAuth foundation laid)
**Next:** Implement database schema and API endpoints
