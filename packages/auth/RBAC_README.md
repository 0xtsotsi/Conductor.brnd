# Mission Command Centre RBAC

Role-Based Access Control (RBAC) system for Mission Command Centre built on Mastra.

## Features

- **Role-based permissions**: Admin, Operator, Viewer roles with predefined permissions
- **JWT authentication**: Secure token-based authentication
- **Route-based authorization**: Automatic permission checking for API routes
- **Middleware helpers**: Easy-to-use middleware for protecting routes
- **Customizable**: Extensible with custom permissions and role mappings

## Installation

```bash
pnpm add @mastra/auth
```

## Quick Start

### 1. Setup Auth Provider

```typescript
import { Mastra } from '@mastra/core';
import { MissionCommandAuth } from '@mastra/auth';

const mastra = new Mastra({
  server: {
    auth: new MissionCommandAuth({
      secret: process.env.JWT_AUTH_SECRET!,
    }),
  },
});
```

### 2. Generate JWT Tokens with Role

When generating JWT tokens for users, include the `role` claim:

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    sub: 'user-123',
    email: 'user@example.com',
    name: 'John Doe',
    role: 'admin', // or 'operator' or 'viewer'
  },
  process.env.JWT_AUTH_SECRET!,
);
```

### 3. Protect Routes with Middleware

```typescript
import { Hono } from 'hono';
import {
  requirePermission,
  requireRole,
  requireMinRole,
} from '@mastra/auth';

const app = new Hono();

// Require specific permission
app.post(
  '/api/workflows',
  requirePermission('workflows:create'),
  async (c) => {
    // Only users with 'workflows:create' permission can access
    return c.json({ message: 'Workflow created' });
  },
);

// Require specific role
app.delete(
  '/api/admin/users/:id',
  requireRole('admin'),
  async (c) => {
    // Only admins can access
    return c.json({ message: 'User deleted' });
  },
);

// Require minimum role level (operator or admin)
app.post(
  '/api/workflows/:id/run',
  requireMinRole('operator'),
  async (c) => {
    // Operators and admins can access
    return c.json({ message: 'Workflow started' });
  },
);
```

## Roles and Permissions

### Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access to all resources and settings |
| **Operator** | Can execute workflows, approve/reject tasks, view monitoring |
| **Viewer** | Read-only access to workflows and monitoring |

### Permissions

#### Workflow Management
- `workflows:create` - Create new workflow definitions
- `workflows:read` - View workflow definitions
- `workflows:update` - Edit workflow definitions
- `workflows:delete` - Delete workflow definitions

#### Workflow Execution
- `workflows:execute` - Start workflow executions
- `workflows:approve` - Approve suspended workflow steps
- `workflows:reject` - Reject suspended workflow steps
- `workflows:resume` - Resume suspended workflows

#### Agent Management
- `agents:create` - Create new agents
- `agents:read` - View agent configurations
- `agents:update` - Edit agent configurations
- `agents:delete` - Delete agents

#### Monitoring
- `monitoring:read` - View workflow executions and logs
- `monitoring:cancel` - Cancel running workflow executions

#### System Administration
- `admin:users` - Manage users
- `admin:roles` - Manage roles and permissions
- `admin:settings` - Modify system settings

### Default Permissions by Role

**Admin**: All permissions

**Operator**:
- `workflows:read`
- `workflows:execute`
- `workflows:approve`
- `workflows:reject`
- `workflows:resume`
- `agents:read`
- `monitoring:read`
- `monitoring:cancel`

**Viewer**:
- `workflows:read`
- `agents:read`
- `monitoring:read`

## Advanced Usage

### Custom Role Permissions

Override default permissions for a role:

```typescript
const auth = new MissionCommandAuth({
  secret: process.env.JWT_AUTH_SECRET!,
  customRolePermissions: {
    operator: [
      'workflows:read',
      'workflows:execute',
      'workflows:approve',
      'workflows:reject',
      'workflows:resume',
      'agents:read',
      'agents:create', // Add custom permission
      'monitoring:read',
      'monitoring:cancel',
    ],
  },
});
```

### Custom Route Permissions

Define custom permissions for specific routes:

```typescript
const auth = new MissionCommandAuth({
  secret: process.env.JWT_AUTH_SECRET!,
  customRoutePermissions: {
    '/api/custom/route': {
      GET: 'workflows:read',
      POST: 'workflows:create',
    },
  },
});
```

### Custom User Permissions

Grant specific permissions to a user beyond their role:

```typescript
const token = jwt.sign(
  {
    sub: 'user-123',
    role: 'viewer',
    permissions: ['workflows:execute'], // Grant additional permission
  },
  secret,
);
```

### Programmatic Permission Checks

Check permissions in your code:

```typescript
import {
  userHasPermission,
  userHasAnyPermission,
  roleHasPermission,
} from '@mastra/auth';

const user: MissionCommandUser = {
  sub: 'user-123',
  role: 'operator',
};

// Check if user has specific permission
if (userHasPermission(user, 'workflows:execute')) {
  // User can execute workflows
}

// Check if user has any of the permissions
if (userHasAnyPermission(user, ['workflows:execute', 'workflows:approve'])) {
  // User has at least one of these permissions
}

// Check if role has permission
if (roleHasPermission('admin', 'admin:users')) {
  // Admin role has user management permission
}
```

## API Reference

### MissionCommandAuth

Main auth provider class.

```typescript
new MissionCommandAuth(options?: MissionCommandAuthOptions)
```

**Options:**
- `secret?: string` - JWT secret (defaults to `JWT_AUTH_SECRET` env var)
- `customRolePermissions?: Partial<Record<MissionCommandRole, MissionCommandPermission[]>>` - Custom role permissions
- `customRoutePermissions?: typeof ROUTE_PERMISSIONS` - Custom route permissions

### Middleware Functions

#### `requirePermission(permission)`

Require specific permission(s) to access route.

```typescript
requirePermission('workflows:create')
requirePermission(['workflows:delete', 'admin:settings'])
```

#### `requireRole(role)`

Require specific role to access route.

```typescript
requireRole('admin')
```

#### `requireMinRole(role)`

Require minimum role level (hierarchical).

```typescript
requireMinRole('operator') // Allows operators and admins
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_AUTH_SECRET` | Yes | Secret for JWT token verification |

## Integration with Mastra Server

The RBAC system integrates seamlessly with Mastra Server:

```typescript
import { Mastra } from '@mastra/core';
import { MissionCommandAuth } from '@mastra/auth';

const mastra = new Mastra({
  server: {
    auth: new MissionCommandAuth({
      secret: process.env.JWT_AUTH_SECRET!,
    }),
    // Server configuration
    port: 4111,
  },
  // Your workflows, agents, etc.
});

const server = mastra.getServer();
server.start(); // Server will automatically enforce RBAC
```

## Testing

Create test tokens with different roles:

```typescript
import jwt from 'jsonwebtoken';

function createTestToken(role: 'admin' | 'operator' | 'viewer') {
  return jwt.sign(
    {
      sub: 'test-user',
      email: 'test@example.com',
      role,
    },
    process.env.JWT_AUTH_SECRET!,
  );
}

// Usage in tests
const adminToken = createTestToken('admin');
const operatorToken = createTestToken('operator');
const viewerToken = createTestToken('viewer');
```

## License

Apache-2.0
