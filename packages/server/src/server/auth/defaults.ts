import type { MastraAuthConfig } from '@mastra/core/server';

// Default configuration that can be extended by clients
export const defaultAuthConfig: MastraAuthConfig = {
  protected: ['/api/*'],
  public: ['/api'],
  // Simple rule system
  rules: [
    // Admin users can do anything
    {
      condition: user => {
        if (typeof user === 'object' && user !== null) {
          if ('isAdmin' in user) {
            return !!user.isAdmin;
          }

          if ('role' in user) {
            return user.role === 'admin';
          }
        }
        return false;
      },
      allow: true,
    },
    // Approval endpoints - require workflows:approve permission
    // Viewers can only view approvals, operators and admins can approve/decline
    {
      condition: ({ path, method }) => {
        return (
          path.startsWith('/api/approvals') &&
          (method === 'POST' || method === 'DELETE') &&
          !path.endsWith('/timeline')
        );
      },
      condition: user => {
        if (typeof user === 'object' && user !== null) {
          // Admins can do anything
          if ('isAdmin' in user && user.isAdmin) {
            return true;
          }
          if ('role' in user && user.role === 'admin') {
            return true;
          }
          // Operators can approve/decline
          if ('role' in user && (user.role === 'operator' || user.role === 'admin')) {
            return true;
          }
          // Check for explicit workflows:approve permission
          if ('permissions' in user && Array.isArray(user.permissions)) {
            return user.permissions.includes('workflows:approve');
          }
        }
        return false;
      },
      allow: true,
    },
    // Missions endpoints - require monitoring:read permission
    // All authenticated users can view missions
    {
      condition: ({ path }) => {
        return path.startsWith('/api/missions');
      },
      condition: user => {
        if (typeof user === 'object' && user !== null) {
          // Admins can do anything
          if ('isAdmin' in user && user.isAdmin) {
            return true;
          }
          if ('role' in user && user.role === 'admin') {
            return true;
          }
          // Check for explicit monitoring:read permission
          if ('permissions' in user && Array.isArray(user.permissions)) {
            return user.permissions.includes('monitoring:read');
          }
          // Default: allow all authenticated users to view missions
          return true;
        }
        return false;
      },
      allow: true,
    },
    // GET /api/approvals - read-only access for viewers
    {
      condition: ({ path, method }) => {
        return path === '/api/approvals' && method === 'GET';
      },
      condition: user => {
        if (typeof user === 'object' && user !== null) {
          // All authenticated users can view approval queue
          return true;
        }
        return false;
      },
      allow: true,
    },
  ],
};
