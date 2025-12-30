# Mission Command Troubleshooting Guide

Common issues, error messages, and solutions for Mission Command Centre.

---

## Table of Contents

1. [Installation & Setup Issues](#installation--setup-issues)
2. [Authentication Issues](#authentication-issues)
3. [Database Issues](#database-issues)
4. [Workflow Execution Issues](#workflow-execution-issues)
5. [API Issues](#api-issues)
6. [UI Issues](#ui-issues)
7. [GitHub Integration Issues](#github-integration-issues)
8. [Performance Issues](#performance-issues)
9. [Deployment Issues](#deployment-issues)

---

## Installation & Setup Issues

### Module Not Found Errors

**Error:**
```
Error: Cannot find module '@mastra/core'
```

**Cause:** Dependencies not installed or build not completed.

**Solution:**

```bash
# Install dependencies from mission-command root
cd /path/to/mission-command
pnpm install

# Build from monorepo root first
cd /path/to/Conductor-brnd
pnpm build

# Then build mission-command specifically
cd packages/mission-command
pnpm build
```

---

### Build Errors - Out of Memory

**Error:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Cause:** TypeScript compilation requires more memory than default Node.js allocation.

**Solution:**

```bash
# Build with increased memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

---

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::4111
```

**Cause:** Port 4111 is already being used by another process.

**Solution:**

```bash
# Find process using the port
lsof -i :4111
# or
netstat -tulpn | grep 4111

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=4112 pnpm run dev:server
```

---

### Environment Variables Not Loading

**Error:**
```
Error: JWT_SECRET is required
```

**Cause:** `.env` file not configured or variables missing.

**Solution:**

```bash
# Copy example env file
cp .env.example .env

# Edit with required values
nano .env

# Ensure you have at minimum:
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - GITHUB_TOKEN
# - GITHUB_WEBHOOK_SECRET
# - DATABASE_URL (for production)
```

---

## Authentication Issues

### JWT Verification Failed

**Error:**
```
401 Unauthorized: Invalid token
```

**Cause:** JWT token expired, invalid, or verification failed.

**Diagnosis:**

```bash
# Check JWT secret matches between generation and verification
echo $JWT_SECRET

# Decode JWT to check expiration
# https://jwt.io/ or use jwt-cli
```

**Solution:**

1. **Token Expired:**
   - User must re-authenticate via OAuth
   - Consider implementing refresh token mechanism

2. **Secret Mismatch:**
   - Ensure `JWT_SECRET` is identical between server restarts
   - Regenerate tokens after secret change

3. **Algorithm Mismatch:**
   - Verify JWT uses `HS256` algorithm
   - Check `jwt-middleware.ts` configuration

---

### OAuth Callback Fails

**Error:**
```
Error exchanging code for token
```

**Cause:** OAuth client ID/secret incorrect or callback URL mismatch.

**Diagnosis:**

```bash
# Check OAuth configuration
echo $GITHUB_CLIENT_ID
echo $GITHUB_CLIENT_SECRET

# Verify callback URL in OAuth app settings matches:
# https://github.com/settings/developers
```

**Solution:**

1. **GitHub OAuth:**
   - Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
   - Check callback URL matches OAuth app configuration exactly
   - Ensure OAuth app is not in "sandbox mode"
   - Verify network connectivity to `github.com`

2. **Google OAuth:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Check callback URL in Google Cloud Console
   - Ensure OAuth consent screen is configured
   - Verify API is enabled in Google Cloud project

---

### Wrong Role Assigned

**Error:** User has incorrect role after OAuth login.

**Cause:** Admin email/domain configuration incorrect.

**Diagnosis:**

```bash
# Check admin configuration
echo $ADMIN_EMAILS
echo $ADMIN_DOMAINS
```

**Solution:**

```bash
# Add user email to admin list
ADMIN_EMAILS=user@example.com,admin@example.com

# Or add domain to admin domains
ADMIN_DOMAINS=example.com

# Restart server after changes
```

---

### CSRF State Validation Failed

**Error:**
```
CSRF validation failed: Invalid state parameter
```

**Cause:** OAuth flow state parameter mismatch or replay attack.

**Solution:**

1. Clear browser cookies and try again
2. Ensure cookies are enabled in browser
3. Check for multiple concurrent OAuth flows
4. Verify `cookie-parser` middleware is configured

---

## Database Issues

### Connection Refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause:** PostgreSQL database not running or wrong host/port.

**Solution:**

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Or start Docker services
pnpm dev:services:up

# Verify DATABASE_URL
echo $DATABASE_URL
# Format: postgresql://user:password@localhost:5432/database_name
```

---

### Authentication Failed

**Error:**
```
Error: password authentication failed for user "mission_command"
```

**Cause:** Database user doesn't exist or wrong password.

**Solution:**

```sql
-- Create database user
CREATE USER mission_command WITH PASSWORD 'your_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE mission_command TO mission_command;

-- Update .env with correct credentials
DATABASE_URL=postgresql://mission_command:your_password@localhost:5432/mission_command
```

---

### Tables Don't Exist

**Error:**
```
Error: relation "mission_command_users" does not exist
```

**Cause:** Database schema not initialized.

**Solution:**

```bash
# Run database initialization
pnpm run db:init

# Or manually run migrations
psql $DATABASE_URL < schema.sql

# Verify tables created
psql $DATABASE_URL -c "\dt"
```

---

### Connection Pool Exhausted

**Error:**
```
Error: Connection pool exhausted - timeout
```

**Cause:** Too many concurrent database connections or leaks.

**Diagnosis:**

```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

**Solution:**

```typescript
// Increase pool size in configuration
const poolConfig = {
  max: 20,  // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};
```

---

## Workflow Execution Issues

### Workflow Not Found

**Error:**
```
404 Not Found: Workflow "workflow-id" not found
```

**Cause:** Workflow ID incorrect or workflow not registered.

**Solution:**

```bash
# List available workflows
curl -H "Authorization: Bearer $JWT" http://localhost:4111/api/workflows

# Check workflow is registered in Mastra instance
# See src/server/mastra-server.ts
```

---

### Workflow Execution Timeout

**Error:**
```
Error: Workflow execution timed out
```

**Cause:** Workflow step taking too long or hung.

**Solution:**

```typescript
// Increase timeout in workflow configuration
const workflow = new Workflow({
  id: 'my-workflow',
  timeout: 300000  // 5 minutes in milliseconds
});
```

---

### Agent Tool Not Found

**Error:**
```
Error: Tool "github-create-branch" not found
```

**Cause:** Agent tool not registered or wrong tool name.

**Solution:**

```typescript
// Verify tool is registered in agent
const agent = new Agent({
  name: 'code-agent',
  tools: {
    githubCreateBranch,  // Check tool is imported
    githubCreatePR
  }
});
```

---

### Suspended Run Not Resuming

**Error:** Suspended workflow run not resuming after approval.

**Cause:** Storage backend not persisting suspended runs properly.

**Diagnosis:**

```bash
# Check suspended runs storage
curl -H "Authorization: Bearer $JWT" http://localhost:4111/api/approvals
```

**Solution:**

1. Verify `SuspendedRunsStorage` implementation
2. Check database/network connectivity
3. Review logs for storage errors
4. Ensure resume function is called with correct `runId`

---

## API Issues

### 404 Not Found on API Endpoints

**Error:**
```
404 Not Found: /api/workflows
```

**Cause:** API route not registered or wrong path.

**Solution:**

```typescript
// Verify route is registered in server
app.route('/api/workflows', workflowsAPI);

// Check route path matches client request
// Leading/trailing slashes matter!
```

---

### CORS Errors in Browser

**Error:**
```
Access to fetch at 'http://localhost:4111/api/workflows' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Cause:** CORS not configured for frontend origin.

**Solution:**

```typescript
// Add CORS middleware
import { cors } from 'hono/cors';

app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  credentials: true
}));
```

---

### Rate Limit Exceeded

**Error:**
```
429 Too Many Requests: Rate limit exceeded
```

**Cause:** API request limit exceeded.

**Solution:**

1. **Wait for rate limit reset** (check `X-RateLimit-Reset` header)
2. **Increase rate limit** in configuration:
   ```typescript
   rateLimit({ maxRequests: 200, windowMs: 3600000 })
   ```
3. **Implement exponential backoff** in client

---

### Request Body Too Large

**Error:**
```
413 Payload Too Large
```

**Cause:** Request exceeds size limit.

**Solution:**

```typescript
// Increase body size limit
app.use('/api/*', async (c, next) => {
  // Configure body parser with larger limit
  return next();
});
```

---

## UI Issues

### Not Authenticating

**Error:** Infinite redirect loop or stuck on login page.

**Cause:** JWT not being stored or sent in requests.

**Diagnosis:**

```javascript
// Open browser console
console.log(localStorage.getItem('jwt_token'));  // Should show token
console.log(document.cookie);  // Should show session cookie
```

**Solution:**

1. Check browser console for errors
2. Verify OAuth callback URL is correct
3. Check `VITE_MASTRA_API_URL` in UI `.env`
4. Ensure `AuthProvider` is wrapping app

---

### API Requests Fail with 401

**Error:** All API requests return 401 Unauthorized.

**Cause:** Authorization header not being sent.

**Diagnosis:**

```javascript
// Check network tab in browser DevTools
// Look for Authorization header in request headers
```

**Solution:**

```typescript
// Ensure MastraClient is configured with getToken
const client = new MastraClient({
  baseUrl: import.meta.env.VITE_MASTRA_API_URL,
  getToken: () => localStorage.getItem('jwt_token')
});
```

---

### React Hydration Errors

**Error:**
```
Hydration failed: Initial UI does not match what was rendered on the server
```

**Cause:** Server-rendered HTML differs from client-rendered HTML.

**Solution:**

1. Check for conditional rendering based on `window` or browser APIs
2. Use `useEffect` for browser-specific code
3. Ensure consistent data between server and client

---

### Components Not Updating

**Error:** UI not reflecting workflow run updates.

**Cause:** React Query not refetching or SSE not connected.

**Solution:**

```typescript
// Enable refetch interval
const { data } = useQuery({
  queryKey: ['missions'],
  queryFn: () => client.listActiveMissions(),
  refetchInterval: 5000  // Poll every 5 seconds
});

// Or use SSE for real-time updates
const { data } = useWorkflowSubscribe(workflowId);
```

---

## GitHub Integration Issues

### GitHub Webhook Not Triggering

**Error:** Webhook not received by server.

**Cause:** Webhook URL incorrect or GitHub cannot reach server.

**Diagnosis:**

```bash
# Check webhook delivery status in GitHub repository
# Settings → Webhooks → Recent Deliveries
```

**Solution:**

1. Verify webhook URL is correct: `https://your-domain.com/api/webhooks/github`
2. Ensure server is publicly accessible (not localhost)
3. Check firewall allows GitHub IPs: `curl https://api.github.com/meta`
4. Verify webhook secret matches `GITHUB_WEBHOOK_SECRET`

---

### Webhook Signature Verification Failed

**Error:**
```
Error: Invalid webhook signature
```

**Cause:** Webhook secret mismatch or signature calculation error.

**Solution:**

```bash
# Verify secret matches GitHub webhook configuration
echo $GITHUB_WEBHOOK_SECRET

# Regenerate if needed
openssl rand -hex 20

# Update in both .env and GitHub webhook settings
```

---

### GitHub API Rate Limit

**Error:**
```
403 Forbidden: API rate limit exceeded
```

**Cause:** Exceeded GitHub API rate limit (5000 requests/hour authenticated).

**Solution:**

1. **Wait for rate limit reset** (top of the hour)
2. **Use authenticated requests** (provide `GITHUB_TOKEN`)
3. **Implement request queuing** for bulk operations
4. **Check rate limit status:**
   ```bash
   curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit
   ```

---

### Branch/PR Creation Failed

**Error:**
```
Error: Failed to create branch: Reference already exists
```

**Cause:** Branch already exists in repository.

**Solution:**

1. **Check if branch exists:**
   ```bash
   git ls-remote https://github.com/user/repo.git | grep feature-branch
   ```

2. **Delete existing branch or use different name:**
   ```typescript
   const branchName = `feature-${Date.now()}`;
   ```

---

## Performance Issues

### Slow API Response Times

**Symptom:** API requests taking > 1 second.

**Diagnosis:**

```bash
# Check server CPU/memory
top -p $(pgrep -f "node.*server")

# Check database query performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Solution:**

1. Add database indexes on frequently queried columns
2. Enable query result caching
3. Use connection pooling
4. Implement pagination for large result sets

---

### Memory Leak

**Symptom:** Server memory usage grows continuously.

**Diagnosis:**

```bash
# Monitor memory usage over time
watch -n 5 'ps aux | grep node'
```

**Solution:**

1. Check for unclosed database connections
2. Verify event listeners are properly removed
3. Look for circular references in data structures
4. Use memory profiling tools:
   ```bash
   node --inspect server.js
   # Open chrome://inspect in Chrome
   ```

---

### High CPU Usage

**Symptom:** Server CPU at 100% constantly.

**Diagnosis:**

```bash
# Generate CPU profile
kill -USR2 $(pgrep -f "node.*server")

# Analyze with clinic.js
npm install -g clinic
clinic doctor -- node server.js
```

**Solution:**

1. Optimize expensive loops or computations
2. Implement worker threads for CPU-intensive tasks
3. Use caching for repeated calculations
4. Add query optimization for database calls

---

## Deployment Issues

### Docker Container Crashes

**Error:**
```
Container exited with code 1
```

**Cause:** Application error or missing dependencies.

**Diagnosis:**

```bash
# Check container logs
docker logs <container_id>

# Run interactively to see errors
docker run -it mission-command /bin/sh
```

**Solution:**

1. Check all environment variables are set
2. Verify `DATABASE_URL` is accessible from container
3. Ensure port 4111 is exposed in Dockerfile
4. Check healthcheck endpoint: `/health`

---

### SSL Certificate Errors

**Error:**
```
Error: unable to verify the first certificate
```

**Cause:** Self-signed certificate or missing CA bundle.

**Solution:**

```bash
# For development, disable certificate verification (NOT FOR PRODUCTION)
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm run dev:server

# For production, use valid certificates
# Let's Encrypt: https://letsencrypt.org/
```

---

### Nginx 502 Bad Gateway

**Error:**
```
502 Bad Gateway
```

**Cause:** Nginx cannot connect to upstream Node.js server.

**Solution:**

```nginx
# Check nginx upstream configuration
upstream mission_command {
    server localhost:4111;
    keepalive 64;
}

# Verify server is running
systemctl status mission-command

# Check firewall allows connection
sudo ufw allow from 127.0.0.1 to any port 4111
```

---

## Debug Mode

### Enable Verbose Logging

```bash
# Set log level to debug
LOG_LEVEL=debug pnpm run dev:server

# Enable HTTP request logging
DEBUG=http:* pnpm run dev:server
```

### Database Query Logging

```typescript
// Enable query logging in development
const pool = new Pool({
  connectionString: DATABASE_URL,
  log: (...messages) => console.log('[DB]', ...messages)
});
```

### Trace Request Flow

```typescript
// Add request ID middleware
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  console.log(`[${requestId}] ${c.req.method} ${c.req.url}`);
  await next();
});
```

---

## Getting Help

If you continue to experience issues:

1. **Check Logs:**
   ```bash
   # Server logs
   journalctl -u mission-command -f

   # Docker logs
   docker logs -f mission-command
   ```

2. **Review Documentation:**
   - [API Reference](./API_REFERENCE.md)
   - [Security Guide](./SECURITY_GUIDE.md)
   - [Deployment Guide](../DEPLOYMENT.md)

3. **Search Existing Issues:**
   - GitHub Issues: https://github.com/mastra-ai/mastra/issues

4. **Create Debug Dump:**
   ```bash
   pnpm run debug:dump
   # Creates debug-dump.tar.gz with logs and diagnostics
   ```

5. **Report Issue:**
   - Include error messages
   - Provide reproduction steps
   - Attach debug dump (sanitized)
   - Specify environment details (OS, Node version, etc.)
