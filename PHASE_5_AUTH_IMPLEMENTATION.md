# Phase 5: Authentication & User Management - Implementation Guide

## Overview

This guide provides complete implementation details for adding OAuth authentication and user management to Mission Command Centre using GitHub and Google OAuth providers.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [OAuth Implementation](#oauth-implementation)
4. [JWT Token Management](#jwt-token-management)
5. [API Endpoints](#api-endpoints)
6. [UI Components](#ui-components)
7. [RBAC Integration](#rbac-integration)
8. [Security Considerations](#security-considerations)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Architecture Overview

### Authentication Flow

```
┌─────────┐         ┌─────────────┐         ┌──────────┐         ┌───────────┐
│  User   │────────>│  Login Page │────────>│  OAuth   │────────>│  Provider │
└─────────┘         └─────────────┘         └──────────┘         └───────────┘
                                                          │
                                                          v
┌─────────┐         ┌─────────────┐         ┌──────────┐         ┌───────────┐
│  User   │<────────│   JWT +     │<────────│  Callback │<────────│  Auth Code │
│ Logged  │         │   Session   │         │  Handler  │         └───────────┘
└─────────┘         └─────────────┘         └──────────┘
                           │
                           v
                   ┌──────────────┐
                   │  Mission CMD │
                   │      UI      │
                   └──────────────┘
```

### Components

1. **OAuth Handlers** - Handle GitHub and Google OAuth flows
2. **JWT Utilities** - Generate and verify JWT tokens
3. **Database Layer** - Store users, sessions, and audit logs
4. **API Endpoints** - Auth and user management routes
5. **UI Components** - Login page and user management interface

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  provider VARCHAR(50) NOT NULL, -- 'github' or 'google'
  provider_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer', -- 'admin', 'operator', 'viewer'
  permissions JSONB DEFAULT '[]', -- Additional permissions
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,

  UNIQUE(provider, provider_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);
CREATE INDEX idx_users_role ON users(role);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Audit Log Table

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'approve', 'decline', 'role_change'
  resource_type VARCHAR(100), -- 'workflow', 'user', 'approval'
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

---

## OAuth Implementation

### Environment Variables

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=ghp_xxx
GITHUB_CLIENT_SECRET=ghp_xxx
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mastra
```

### GitHub OAuth Handler

**File:** `packages/server/src/server/handlers/auth-github.ts`

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { generateState } from './oauth-utils';
import { githubUserService } from './oauth-providers';

export const githubAuthRouter = new Hono();

/**
 * GET /auth/github
 * Initiate GitHub OAuth flow
 */
githubAuthRouter.get('/auth/github', async (c) => {
  const state = generateState();

  // Store state in session/cookie for verification
  c.header('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`);

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_CALLBACK_URL!,
    scope: 'read:user user:email',
    state,
    response_type: 'code',
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/**
 * GET /auth/github/callback
 * Handle GitHub OAuth callback
 */
const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

githubAuthRouter.get(
  '/auth/github/callback',
  zValidator('query', callbackSchema),
  async (c) => {
    const { code, state } = c.req.valid('query');

    // Verify state parameter
    const cookieState = c.req.header('Cookie')?.match(/oauth_state=([^;]+)/)?.[1];
    if (cookieState !== state) {
      return c.html('<h1>Invalid state parameter</h1>', 400);
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description);
      }

      // Fetch user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const githubUser = await userResponse.json();

      // Fetch user email
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const emails = await emailResponse.json();
      const primaryEmail = emails.find((e: any) => e.primary)?.email;

      // Create or update user
      const user = await githubUserService.findOrCreate({
        email: primaryEmail || githubUser.email,
        name: githubUser.name || githubUser.login,
        avatar_url: githubUser.avatar_url,
        provider_id: githubUser.id.toString(),
      });

      // Generate JWT
      const token = await generateJWT(user);

      // Set HTTP-only cookie
      c.header('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

      // Log audit
      await auditLog(user.id, 'login', {
        provider: 'github',
        ip: c.req.header('x-forwarded-for') || 'unknown',
      });

      // Redirect to dashboard
      return c.redirect('/');

    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return c.html(`<h1>Authentication failed: ${error.message}</h1>`, 500);
    }
  }
);
```

### Google OAuth Handler

**File:** `packages/server/src/server/handlers/auth-google.ts`

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { googleUserService } from './oauth-providers';

export const googleAuthRouter = new Hono();

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
googleAuthRouter.get('/auth/google', async (c) => {
  const state = generateState();

  c.header('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
    scope: 'openid profile email',
    state,
    response_type: 'code',
    access_type: 'offline',
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
googleAuthRouter.get(
  '/auth/google/callback',
  zValidator('query', callbackSchema),
  async (c) => {
    const { code, state } = c.req.valid('query');

    const cookieState = c.req.header('Cookie')?.match(/oauth_state=([^;]+)/)?.[1];
    if (cookieState !== state) {
      return c.html('<h1>Invalid state parameter</h1>', 400);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.GOOGLE_CALLBACK_URL,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      // Fetch user info
      const userResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`
      );

      const googleUser = await userResponse.json();

      // Create or update user
      const user = await googleUserService.findOrCreate({
        email: googleUser.email,
        name: googleUser.name,
        avatar_url: googleUser.picture,
        provider_id: googleUser.id,
      });

      // Generate JWT
      const token = await generateJWT(user);

      c.header('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

      await auditLog(user.id, 'login', {
        provider: 'google',
        ip: c.req.header('x-forwarded-for') || 'unknown',
      });

      return c.redirect('/');

    } catch (error) {
      console.error('Google OAuth error:', error);
      return c.html(`<h1>Authentication failed: ${error.message}</h1>`, 500);
    }
  }
);
```

---

## JWT Token Management

### JWT Utilities

**File:** `packages/server/src/server/auth/jwt.ts`

```typescript
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// JWT payload schema
export const jwtPayloadSchema = z.object({
  sub: z.string(), // user ID
  email: z.string(),
  role: z.enum(['admin', 'operator', 'viewer']),
  permissions: z.array(z.string()).default([]),
  iat: z.number(),
  exp: z.number(),
});

export type JWTPayload = z.infer<typeof jwtPayloadSchema>;

/**
 * Generate JWT token for user
 */
export async function generateJWT(user: {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
}): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions || [],
  };

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const decoded = jwt.verify(token, secret);
    return jwtPayloadSchema.parse(decoded);
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}
```

---

## API Endpoints

### Logout Endpoint

**File:** `packages/server/src/server/handlers/auth.ts`

```typescript
import { Hono } from 'hono';

export const authRouter = new Hono();

/**
 * POST /auth/logout
 * Logout user and clear session
 */
authRouter.post('/auth/logout', async (c) => {
  const token = extractToken(c.req.raw);

  if (token) {
    const payload = await verifyJWT(token);

    if (payload) {
      // Log audit
      await auditLog(payload.sub, 'logout', {
        ip: c.req.header('x-forwarded-for') || 'unknown',
      });

      // Invalidate session (delete from database)
      await db.sessions.deleteMany({
        where: { user_id: payload.sub },
      });
    }
  }

  // Clear auth cookie
  c.header('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

  return c.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Get current user info
 */
authRouter.get('/auth/me', async (c) => {
  const token = extractToken(c.req.raw);

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const payload = await verifyJWT(token);

  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  // Fetch full user from database
  const user = await db.users.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      avatar_url: true,
      role: true,
      permissions: true,
      created_at: true,
      last_login: true,
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});
```

### User Management API

**File:** `packages/server/src/server/handlers/users.ts`

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

export const usersRouter = new Hono();

/**
 * GET /api/users
 * List all users (admin only)
 */
usersRouter.get('/api/users', async (c) => {
  const users = await db.users.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      avatar_url: true,
      role: true,
      provider: true,
      created_at: true,
      last_login: true,
    },
  });

  return c.json({ users });
});

/**
 * PUT /api/users/:id
 * Update user (admin only)
 */
const updateUserSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  permissions: z.array(z.string()).optional(),
});

usersRouter.put(
  '/api/users/:id',
  zValidator('json', updateUserSchema),
  async (c) => {
    const userId = c.req.param('id');
    const updates = c.req.valid('json');

    const user = await db.users.update({
      where: { id: userId },
      data: updates,
    });

    await auditLog(userId, 'role_change', {
      new_role: updates.role,
      new_permissions: updates.permissions,
    });

    return c.json({ user });
  }
);

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
usersRouter.delete('/api/users/:id', async (c) => {
  const userId = c.req.param('id');

  await db.users.delete({
    where: { id: userId },
  });

  await auditLog(userId, 'user_deleted', {});

  return c.json({ message: 'User deleted' });
});
```

---

## UI Components

### Login Page

**File:** `mission-command/src/ui/LoginView.tsx`

```typescript
import { useState } from 'react';

export function LoginView() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubLogin = () => {
    setIsLoading(true);
    window.location.href = '/auth/github';
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    window.location.href = '/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">
            Mission Command Centre
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Sign in to access workflows
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        {isLoading && (
          <div className="text-center text-sm text-gray-600">
            Redirecting to login...
          </div>
        )}
      </div>
    </div>
  );
}
```

### User Management View

**File:** `mission-command/src/ui/UserManagementView.tsx`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export function UserManagementView() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => client.get('/api/users'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role, permissions }: any) =>
      client.put(`/api/users/${userId}`, { body: JSON.stringify({ role, permissions }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  const users = usersData?.users || [];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <table className="min-w-full bg-white border border-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-2 border-b">Email</th>
            <th className="px-4 py-2 border-b">Name</th>
            <th className="px-4 py-2 border-b">Role</th>
            <th className="px-4 py-2 border-b">Last Login</th>
            <th className="px-4 py-2 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user: any) => (
            <tr key={user.id}>
              <td className="px-4 py-2 border-b">{user.email}</td>
              <td className="px-4 py-2 border-b">{user.name}</td>
              <td className="px-4 py-2 border-b">{user.role}</td>
              <td className="px-4 py-2 border-b">
                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
              </td>
              <td className="px-4 py-2 border-b">
                <select
                  value={user.role}
                  onChange={(e) => updateRoleMutation.mutate({
                    userId: user.id,
                    role: e.target.value,
                  })}
                  className="border rounded px-2 py-1"
                >
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## RBAC Integration

### Update Role Types

**File:** `packages/auth/src/index.ts` (create if not exists)

```typescript
/**
 * Mission Command Centre Roles
 */
export enum MissionCommandRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

/**
 * Role permissions matrix
 */
export const ROLE_PERMISSIONS = {
  admin: [
    'workflows:*',
    'approvals:*',
    'monitoring:*',
    'users:*',
  ],
  operator: [
    'workflows:read',
    'workflows:start',
    'approvals:read',
    'approvals:approve',
    'monitoring:read',
  ],
  viewer: [
    'workflows:read',
    'approvals:read',
    'monitoring:read',
  ],
};

/**
 * Check if user has permission
 */
export function hasPermission(
  user: { role: MissionCommandRole; permissions?: string[] },
  requiredPermission: string
): boolean {
  // Check explicit permissions first
  if (user.permissions?.includes(requiredPermission)) {
    return true;
  }

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];

  // Check wildcard permissions
  for (const permission of rolePermissions) {
    if (permission === '*' || permission.endsWith(':*')) {
      const resource = permission.split(':')[0];
      if (requiredPermission.startsWith(resource + ':')) {
        return true;
      }
    }

    if (permission === requiredPermission) {
      return true;
    }
  }

  return false;
}
```

---

## Security Considerations

### OAuth Security

1. **State Parameter** - Prevents CSRF attacks
   - Generate random state token
   - Verify on callback
   - Store in HTTP-only cookie

2. **PKCE (Recommended for Production)**
   - Generate code verifier
   - Create code challenge
   - Send on authorization request

3. **Token Storage**
   - Use HTTP-only cookies
   - Set Secure flag in production
   - SameSite=Lax to prevent CSRF

### JWT Security

1. **Secret Key**
   ```bash
   # Generate secure secret
   openssl rand -base64 32
   ```

2. **Token Expiration**
   - Default: 7 days
   - Refresh tokens for long-lived sessions

3. **Token Validation**
   - Verify signature on every request
   - Check expiration
   - Validate user still exists in database

### Rate Limiting

```typescript
/**
 * Rate limit auth endpoints
 */
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts',
});

app.use('/auth/github', authLimiter);
app.use('/auth/google', authLimiter);
```

### Input Validation

- Use Zod schemas for all inputs
- Validate OAuth state parameter
- Sanitize user data before database insertion

---

## Testing

### Integration Tests

**File:** `packages/server/src/server/handlers/auth-github.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { testClient } from '../test-utils';

describe('GitHub OAuth', () => {
  it('should redirect to GitHub on /auth/github', async () => {
    const response = await testClient.get('/auth/github');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('github.com');
  });

  it('should handle OAuth callback', async () => {
    const mockCode = 'test-code';
    const mockState = 'test-state';

    const response = await testClient.get('/auth/github/callback', {
      query: { code: mockCode, state: mockState },
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/');
  });
});
```

### E2E Tests

```typescript
describe('Authentication Flow', () => {
  it('should login user with GitHub', async () => {
    await page.goto('/auth/github');
    await page.waitForURL('**/github.com/**');

    // Mock GitHub login
    await page.fill('input[name="login"]', 'test-user');
    await page.fill('input[name="password"]', 'test-password');
    await page.click('button[type="submit"]');

    // Verify redirect back to app
    await page.waitForURL('/');
    expect(await page.textContent('h1')).toContain('Mission Command');
  });
});
```

---

## Deployment

### Environment Setup

1. **Create OAuth Apps**

   **GitHub:**
   - Go to: https://github.com/settings/developers
   - Create OAuth App
   - Callback URL: `https://your-domain.com/auth/github/callback`

   **Google:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 credentials
   - Callback URL: `https://your-domain.com/auth/google/callback`

2. **Database Migration**

   ```bash
   # Run migrations
   pnpm db:migrate

   # Or use SQL files directly
   psql -d mastra -f schema.sql
   ```

3. **Environment Variables**

   Set all required environment variables in production:
   - OAuth credentials
   - JWT secret
   - Database URL

### Deployment Checklist

- [ ] OAuth apps created with production URLs
- [ ] Database migrations applied
- [ ] JWT_SECRET generated and set
- [ ] HTTPS enabled (required for OAuth)
- [ ] Rate limiting configured
- [ ] Logging and monitoring set up
- [ ] Backup strategy for database

---

## Success Criteria

### Phase 5 Complete When:

- [ ] Users can login with GitHub OAuth
- [ ] Users can login with Google OAuth
- [ ] JWT tokens are generated and validated
- [ ] Users table stores user profiles
- [ ] Sessions table tracks active sessions
- [ ] Audit log records auth events
- [ ] RBAC rules enforce role permissions
- [ ] Admin UI allows user role changes
- [ ] Login page renders OAuth buttons
- [ ] Logout clears session cookies
- [ ] Rate limiting prevents brute force
- [ ] Integration tests pass

---

## Next Steps

1. **Implement OAuth Handlers** - Create GitHub and Google handlers
2. **Database Setup** - Run migrations to create tables
3. **JWT Implementation** - Generate and verify tokens
4. **API Endpoints** - Build auth and user management routes
5. **UI Components** - Build login and user management pages
6. **Testing** - Write integration and E2E tests
7. **Documentation** - Update user guide

---

**Implementation Estimate:** 4-6 hours

**Dependencies:**
- Requires: Phase 1 (Vite App)
- Requires: Phase 2 (UI Integration)
- Requires: Phase 3 (API Endpoints)

**Blocked By:**
- OAuth app creation (manual step)
- Database setup
