#!/usr/bin/env node
/**
 * Mission Command Development Server
 *
 * This is the development server entry point for Mission Command.
 * It starts the API server on port 4111.
 *
 * Usage:
 *   node --loader ts-node/esm server.ts
 *   # or
 *   pnpm tsx server.ts
 */

import { serve } from '@hono/node-server';
import { createMissionCommandServer } from './src/server/example-integration';

async function main() {
  console.log('Starting Mission Command development server...');

  try {
    // Create the server instance
    const { app } = await createMissionCommandServer();

    // Add health check endpoint
    app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mission-command',
      });
    });

    // Start the server
    const port = 4111;
    serve({
      fetch: app.fetch,
      port,
    });

    console.log('✓ Server started successfully');
    console.log(`✓ API server running on http://localhost:${port}`);
    console.log(`✓ Health check: http://localhost:${port}/health`);
    console.log('\nAvailable endpoints:');
    console.log('  GET  /health                    - Health check');
    console.log('  POST /api/auth/github           - GitHub OAuth');
    console.log('  POST /api/auth/google           - Google OAuth');
    console.log('  GET  /api/auth/session          - Current session');
    console.log('  GET  /api/users                 - List users (admin)');
    console.log('  GET  /api/audit/logs            - Audit logs');
    console.log('  POST /api/workflows/:id/start   - Start workflow');
    console.log('\nPress Ctrl+C to stop the server');

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
