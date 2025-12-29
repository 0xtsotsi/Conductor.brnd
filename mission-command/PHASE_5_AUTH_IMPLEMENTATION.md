# Phase 5: Authentication & User Management - Implementation Plan

## Overview

Phase 5 implements OAuth2 authentication and Role-Based Access Control (RBAC) for Mission Command Centre.

## Status: Foundation Complete (~30%)

### ✅ Completed

1. **OAuth Handlers** - GitHub and Google OAuth2 flows
2. **JWT Token Management** - Token generation and verification
3. **Role Assignment** - Email/domain-based admin roles
4. **Environment Configuration** - OAuth provider setup

### 🔄 Remaining

1. **Database Schema** - Users, sessions, and audit tables
2. **User Management API** - CRUD endpoints for users
3. **User Management UI** - Browser-based user administration
4. **Token Refresh** - Refresh token mechanism
5. **Session Invalidation** - Logout and session management
6. **Audit Logging** - Track all auth events

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Authentication Flow                     │
│                                                              │
│  1. User clicks "Login with GitHub/Google"                  │
│  2. Redirect to OAuth provider                               │
│  3. User authorizes                                          │
│  4. Provider redirects back with code                        │
│  5. Server exchanges code for access token                  │
│  6. Fetch user info from provider                            │
│  7. Create/update user in database                           │
│  8. Generate JWT token                                      │
│  9. Set HTTP-only cookie                                    │
│ 10. Redirect to authenticated UI                            │
└─────────────────────────────────────────────────────────────┘
```

## Files

### Created

```
mission-command/src/
├── auth/
│   ├── oauth-handler.ts          # OAuth flows (GitHub + Google)
│   ├── jwt.ts                    # JWT utilities
│   ├── rbac.ts                   # Role-based access control
│   └── types.ts                  # Auth types and interfaces
└── server/
    └── auth-routes.ts            # Auth API endpoints
```

## Implementation

### 1. OAuth Handler

```typescript
// src/auth/oauth-handler.ts
import { Hono } from 'hono';

export class OAuthHandler {
  // GitHub OAuth2 flow
  async githubAuth(c: Context) {
    // Redirect to GitHub OAuth
  }

  async githubCallback(c: Context) {
    // Handle GitHub callback
    // Exchange code for token
    // Fetch user info
    // Create/update user
    // Generate JWT
    // Set cookie
  }

  // Google OAuth2 flow
  async googleAuth(c: Context) {
    // Redirect to Google OAuth
  }

  async googleCallback(c: Context) {
    // Handle Google callback
  }
}
```

### 2. JWT Utilities

```typescript
// src/auth/jwt.ts
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  iat?: number;
  exp?: number;
}

export function generateToken(payload: JWTPayload): string {
  // Generate JWT with 7-day expiration
}

export function verifyToken(token: string): JWTPayload {
  // Verify and decode JWT
}
```

### 3. RBAC Middleware

```typescript
// src/auth/rbac.ts
export enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export function requireRole(role: Role) {
  return async (c: Context, next: Next) => {
    // Check JWT token
    // Verify role
    // Allow or deny access
  };
}
```

### 4. Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL, -- 'github' or 'google'
  provider_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/github` | Initiate GitHub OAuth | ❌ |
| GET | `/auth/github/callback` | GitHub OAuth callback | ❌ |
| GET | `/auth/google` | Initiate Google OAuth | ❌ |
| GET | `/auth/google/callback` | Google OAuth callback | ❌ |
| POST | `/auth/logout` | Logout user | ✅ |
| GET | `/auth/me` | Get current user | ✅ |

### User Management (Admin Only)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List all users | Admin |
| GET | `/api/users/:id` | Get user details | Admin |
| PUT | `/api/users/:id` | Update user | Admin |
| DELETE | `/api/users/:id` | Delete user | Admin |
| PUT | `/api/users/:id/role` | Change user role | Admin |

## Environment Variables

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=ghp_xxx
GITHUB_CLIENT_SECRET=ghp_xxx
GITHUB_CALLBACK_URL=http://localhost:4111/auth/github/callback

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX_xxx
GOOGLE_CALLBACK_URL=http://localhost:4111/auth/google/callback

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_random_secret_here

# Admin Configuration
ADMIN_EMAILS=admin@example.com,admin2@example.com
ADMIN_DOMAINS=example.com,mycompany.com

# Session Configuration
SESSION_EXPIRATION_DAYS=7
```

## Role-Based Access Control (RBAC)

### Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, user management, system settings |
| **Operator** | Start/stop workflows, approve tasks, view runs |
| **Viewer** | Read-only access to workflows and runs |

### Role Determination

1. **Admin by Email**: If user email is in `ADMIN_EMAILS`
2. **Admin by Domain**: If user email domain is in `ADMIN_DOMAINS`
3. **Default Role**: Viewer (for all other users)

### Usage

```typescript
// Protect a route
import { requireRole, Role } from './auth/rbac';

app.get('/api/admin/users',
  requireRole(Role.ADMIN),
  async (c) => {
    // Only admins can access
  }
);

app.post('/api/workflows/:id/run',
  requireRole(Role.OPERATOR),
  async (c) => {
    // Admins and Operators can access
  }
);

app.get('/api/workflows',
  requireRole(Role.VIEWER), // Or no requirement for public
  async (c) => {
    // All authenticated users can access
  }
);
```

## UI Components

### Login Page

```tsx
// ui/src/pages/LoginPage.tsx
export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold">
            Mission Command Centre
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to manage your workflows
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <a href="/auth/github" className="btn-github">
            Sign in with GitHub
          </a>
          <a href="/auth/google" className="btn-google">
            Sign in with Google
          </a>
        </div>
      </div>
    </div>
  );
}
```

### User Management Page (Admin Only)

```tsx
// ui/src/pages/UsersPage.tsx
export function UsersPage() {
  // Fetch users from /api/users
  // Display table with user list
  // Add role change buttons
  // Add delete user buttons
}
```

## Security Considerations

1. **State Parameter**: Use random state to prevent CSRF attacks
2. **HTTP-Only Cookies**: Store JWT in httpOnly cookies (not localStorage)
3. **Secure Flag**: Set `secure` flag on cookies in production
4. **Token Expiration**: 7-day expiration with refresh mechanism
5. **Input Validation**: Validate all user inputs
6. **SQL Injection**: Use parameterized queries
7. **Rate Limiting**: Apply to auth endpoints (10 req/min per IP)

## Testing

### Unit Tests

```typescript
describe('OAuth Handler', () => {
  it('should redirect to GitHub OAuth', async () => {
    // Test GitHub redirect
  });

  it('should handle GitHub callback', async () => {
    // Test callback handling
  });
});

describe('JWT Utilities', () => {
  it('should generate valid token', () => {
    const token = generateToken({
      userId: '123',
      email: 'test@example.com',
      role: Role.ADMIN,
    });

    expect(token).toBeDefined();
  });

  it('should verify valid token', () => {
    const payload = verifyToken(token);
    expect(payload.email).toBe('test@example.com');
  });

  it('should reject invalid token', () => {
    expect(() => verifyToken('invalid')).toThrow();
  });
});
```

### Integration Tests

```typescript
describe('Auth Flow', () => {
  it('should complete full OAuth flow', async () => {
    // 1. Start OAuth
    // 2. Mock provider callback
    // 3. Verify JWT creation
    // 4. Verify user creation in DB
  });
});
```

## Deployment

1. **Create OAuth Apps**:
   - GitHub: https://github.com/settings/developers
   - Google: https://console.cloud.google.com/apis/credentials

2. **Configure Environment**:
   ```bash
   # Set all required environment variables
   # Generate JWT secret
   # Configure admin emails/domains
   ```

3. **Run Migrations**:
   ```bash
   # Create database tables
   psql DATABASE_URL < schema.sql
   ```

4. **Start Server**:
   ```bash
   bun run src/server/index.ts
   ```

## Troubleshooting

### OAuth Callback Fails

**Error**: `Error exchanging code for token`

**Solution**:
- Verify `CLIENT_ID` and `CLIENT_SECRET`
- Check `CALLBACK_URL` matches OAuth app configuration
- Ensure network connectivity to OAuth provider

### JWT Verification Fails

**Error**: `Invalid token`

**Solution**:
- Verify `JWT_SECRET` matches between generation and verification
- Check token hasn't expired
- Ensure cookie is being sent

### Role Not Assigned

**Error**: User has wrong role

**Solution**:
- Check `ADMIN_EMAILS` and `ADMIN_DOMAINS` configuration
- Verify email format matches exactly
- Check for typos in environment variables

## Future Enhancements

1. **Token Refresh**: Implement refresh token mechanism
2. **Multi-Factor Auth**: Add 2FA support
3. **SSO Integration**: Support SAML for enterprise
4. **Session Management**: Add active sessions view
5. **Audit UI**: Build audit log viewer
6. **Password Reset**: For email/password auth (if needed)

---

**Status**: Foundation Complete (~30%)
**Estimated Remaining**: 4-6 hours
**Next**: Database schema + API endpoints
