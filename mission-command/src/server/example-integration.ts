/**
 * Mission Command Server Integration Example
 *
 * This file shows how to integrate the OAuth handler and user management API
 * into a Mastra server instance.
 *
 * Setup:
 * 1. Configure environment variables (see .env.example)
 * 2. Run database migrations
 * 3. Start Mastra server with OAuth enabled
 */

import { Mastra } from '@mastra/core';
import { MissionCommandAuth } from '@mastra/auth';
import { createOAuthHandler } from './oauth-handler';
import { createUsersAPI } from './users-api';
import { createLibSQLUserStorage, runUserMigration } from './user-storage';
import { createLibsqlStore } from '@mastra/storage-libsql';

/**
 * Create Mission Command server with OAuth authentication
 */
export async function createMissionCommandServer() {
  // Initialize LibSQL storage
  const storage = createLibsqlStore({
    url: process.env.LIBSQL_URL || 'file:mission-command.db',
  });

  // Run user migration to create table
  await runUserMigration(storage);

  // Create user storage adapter
  const userStorage = createLibSQLUserStorage(storage);

  // Create OAuth handler
  const oauthHandler = createOAuthHandler({
    jwtSecret: process.env.JWT_AUTH_SECRET || 'your-secret-key',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    defaultRole: (process.env.DEFAULT_ROLE as any) || 'viewer',
    storage: userStorage,
  });

  // Create user management API
  const usersAPI = createUsersAPI({
    storage: userStorage,
  });

  // Create Mission Command auth
  const auth = new MissionCommandAuth({
    secret: process.env.JWT_AUTH_SECRET || 'your-secret-key',
  });

  // Create Mastra instance
  const mastra = new Mastra({
    auth,
    storage,
  });

  // Get Hono app
  const app = mastra.getServer();

  // Mount OAuth handler
  app.route('/', oauthHandler);

  // Mount user management API
  app.route('/', usersAPI);

  return mastra;
}

/**
 * Example .env configuration:
 *
 * # JWT Secret for token signing
 * JWT_AUTH_SECRET=your-super-secret-key-change-this
 *
 * # Frontend URL (for OAuth redirects)
 * FRONTEND_URL=http://localhost:3000
 *
 * # GitHub OAuth App (create at https://github.com/settings/developers)
 * GITHUB_CLIENT_ID=your-github-client-id
 * GITHUB_CLIENT_SECRET=your-github-client-secret
 *
 * # Google OAuth App (create at https://console.cloud.google.com)
 * GOOGLE_CLIENT_ID=your-google-client-id
 * GOOGLE_CLIENT_SECRET=your-google-client-secret
 *
 * # Default role for new users
 * DEFAULT_ROLE=viewer
 *
 * # LibSQL database URL
 * LIBSQL_URL=file:mission-command.db
 */
