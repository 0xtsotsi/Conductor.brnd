# Mission Command Security Guide

Security best practices, threat model, and hardening guidelines for Mission Command Centre deployment.

## Overview

Mission Command Centre implements multiple security layers including OAuth2 authentication, JWT-based authorization, RBAC, audit logging, and secure webhook handling. This guide covers security architecture, configuration, and operational best practices.

---

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────┐
│                     Authentication Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ GitHub OAuth │  │ Google OAuth │  │ JWT Tokens   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Authorization Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ RBAC Middleware│  │ Role Checks │  │ Permission  │       │
│  │              │  │              │  │ Enforcement  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Audit & Logging                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Audit Log    │  │ Rate Limiting│  │ Session Mgmt │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Threat Model

### Identified Threats

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Unauthorized API access | Medium | High | JWT authentication, RBAC |
| CSRF attacks on OAuth | Low | Medium | State parameter validation |
| Webhook spoofing | Medium | High | HMAC-SHA256 signature verification |
| SQL injection | Low | Critical | Parameterized queries |
| XSS attacks | Low | Medium | Input sanitization, CSP headers |
| Rate limit abuse | Medium | Low | Per-user rate limiting |
| Session hijacking | Low | High | HTTP-only cookies, short TTL |
| Data exfiltration | Low | High | Audit logging, access controls |

---

## Authentication Security

### OAuth2 Configuration

#### GitHub OAuth

**Required Settings:**

```bash
# Generate strong random secrets
GITHUB_CLIENT_ID=ghp_xxx...  # From GitHub OAuth app
GITHUB_CLIENT_SECRET=ghp_xxx...  # Keep secret!
GITHUB_CALLBACK_URL=https://your-domain.com/api/auth/callback
```

**Best Practices:**

1. Use a dedicated GitHub OAuth app per environment
2. Set callback URL to exact production domain
3. Enable "Device flow" for headless environments
4. Rotate client secrets every 90 days
5. Monitor GitHub OAuth app usage logs

#### Google OAuth

**Required Settings:**

```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX_xxx...
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/callback
```

**Best Practices:**

1. Configure OAuth consent screen with proper branding
2. Limit OAuth scopes to minimum required (email, profile)
3. Enable Google Cloud audit logging
4. Use Workspace restrictions for enterprise deployments
5. Set up OAuth API usage alerts

### JWT Token Security

**Token Configuration:**

```typescript
// JWT token settings
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,  // 32+ bytes, cryptographically random
  expiresIn: '7d',  // Token expiration
  algorithm: 'HS256',  // HMAC-SHA256
  issuer: 'mission-command',
  audience: 'mission-command-api'
};
```

**JWT Secret Generation:**

```bash
# Generate secure JWT secret
openssl rand -base64 32
```

**Best Practices:**

1. Store `JWT_SECRET` in environment variables, never in code
2. Use different secrets per environment (dev/staging/prod)
3. Rotate secrets periodically (recommended: 90 days)
4. Implement token refresh mechanism for long-lived sessions
5. Include user identifier and role in JWT payload
6. Verify `iss`, `aud`, and `exp` claims on every request

**Token Structure:**

```typescript
interface JWTPayload {
  userId: string;        // User's unique identifier
  email: string;         // User's email
  role: 'admin' | 'operator' | 'viewer';  // User's role
  iat: number;           // Issued at timestamp
  exp: number;           // Expiration timestamp
  iss: string;           // Issuer (mission-command)
  aud: string;           // Audience (mission-command-api)
}
```

---

## Authorization & RBAC

### Role Definitions

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Admin** | Full access, user management, system settings | System administrators |
| **Operator** | Workflow execution, approvals, run monitoring | DevOps engineers, developers |
| **Viewer** | Read-only access to workflows and runs | Stakeholders, auditors |

### Role Assignment

**Admin Determination:**

```typescript
// Email-based admin assignment
const ADMIN_EMAILS = new Set([
  'admin@yourcompany.com',
  'security@yourcompany.com'
]);

// Domain-based admin assignment
const ADMIN_DOMAINS = new Set([
  'yourcompany.com',
  'trusted-partner.com'
]);

function determineRole(email: string): Role {
  if (ADMIN_EMAILS.has(email)) return 'admin';
  const domain = email.split('@')[1];
  if (ADMIN_DOMAINS.has(domain)) return 'admin';
  return 'viewer';  // Default role
}
```

**Best Practices:**

1. Use environment variables for admin email/domain lists
2. Implement approval workflow for role changes
3. Audit all role modifications
4. Use principle of least privilege
5. Regular role access reviews (quarterly)

### RBAC Middleware

**Implementation:**

```typescript
import { requireRole } from '@mastra/auth/rbac-middleware';

// Protect admin endpoints
app.get('/api/admin/*', requireRole('admin'));

// Protect operator endpoints
app.post('/api/workflows/*/execute', requireRole('operator'));

// Allow all authenticated users
app.get('/api/workflows', requireRole('viewer'));
```

**Security Checks:**

1. Validate JWT on every request
2. Verify role matches endpoint requirement
3. Check resource ownership where applicable
4. Log all authorization failures

---

## Webhook Security

### GitHub Webhook Verification

**HMAC-SHA256 Signature Verification:**

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
```

**Configuration:**

```bash
# Generate webhook secret
openssl rand -hex 20

# Set in environment
GITHUB_WEBHOOK_SECRET=your_random_secret_here
```

**Best Practices:**

1. Use unique webhook secrets per repository/environment
2. Rotate webhook secrets periodically
3. Reject requests without valid signatures
4. Log all webhook verification failures
5. Use HTTPS for webhook endpoints only

---

## API Security

### Rate Limiting

**Configuration:**

```typescript
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000,  // 1 hour
  maxRequests: 100,           // Per user per hour
  cleanupIntervalMs: 60 * 1000  // Cleanup expired entries
};
```

**Implementation:**

```typescript
import { rateLimitMiddleware } from './rate-limit';

// Apply rate limiting to all API routes
app.use('/api/*', rateLimitMiddleware);

// Custom rate limit for expensive operations
app.use('/api/workflows/*/execute',
  rateLimitMiddleware({ maxRequests: 10, windowMs: 60 * 1000 })
);
```

**Best Practices:**

1. Implement per-user rate limiting (not per-IP)
2. Use stricter limits for expensive operations
3. Include rate limit headers in responses
4. Log rate limit violations
5. Implement exponential backoff for retries

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1735584000
```

### Input Validation

**Zod Schema Validation:**

```typescript
import { z } from 'zod';

// Validate user input
const executeWorkflowSchema = z.object({
  input: z.object({
    repositoryUrl: z.string().url(),
    branch: z.string().min(1).max(255),
    prNumber: z.number().int().positive().optional()
  })
});

// Use in route handler
const validatedData = executeWorkflowSchema.parse(req.body);
```

**Best Practices:**

1. Validate all user input on server-side
2. Use strict JSON Schema validation
3. Sanitize strings to prevent injection attacks
4. Limit string lengths to prevent DoS
5. Validate file types and sizes for uploads

### CORS Configuration

```typescript
app.use('/api/*', cors({
  origin: [
    'https://your-frontend-domain.com',
    'https://admin.your-domain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));
```

---

## Data Security

### Database Security

**PostgreSQL Hardening:**

```sql
-- Create dedicated database user
CREATE USER mission_command WITH PASSWORD 'strong_password_here';

-- Grant minimum required permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mission_command;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mission_command;

-- Enable row-level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users
  FOR ALL
  USING (id = current_user_id());
```

**Best Practices:**

1. Use strong database passwords (32+ characters)
2. Enable SSL/TLS for database connections
3. Implement row-level security for multi-tenant data
4. Regular database backups with encryption
5. Rotate database credentials periodically
6. Use connection pooling with prepared statements

### Encryption at Rest

**Configuration:**

```bash
# Enable PostgreSQL encryption
# (Database-level transparent data encryption)

# File system encryption (LUKS, BitLocker)
# For storage containing sensitive data
```

### Encryption in Transit

**Requirements:**

1. HTTPS required for all external connections
2. TLS 1.2 or higher for OAuth callbacks
3. Certificate validation for all HTTPS requests
4. Disable weak cipher suites

---

## Session Management

### Session Security

**Configuration:**

```typescript
const SESSION_CONFIG = {
  cookieName: 'mission_command_session',
  expiresIn: 7 * 24 * 60 * 60 * 1000,  // 7 days
  httpOnly: true,      // Prevent JavaScript access
  secure: true,        // HTTPS only in production
  sameSite: 'lax',     // CSRF protection
  path: '/',
  domain: '.yourdomain.com'  // For subdomain sharing
};
```

**Best Practices:**

1. Use HTTP-only cookies (prevent XSS access)
2. Enable `secure` flag in production
3. Set appropriate `sameSite` policy
4. Implement session expiration
5. Provide logout functionality
6. Invalidate all sessions on password change

### Session Invalidation

```typescript
// Invalidate user's sessions
async function invalidateUserSessions(userId: string) {
  await database.sessions.deleteMany({ userId });
  await database.refreshTokens.deleteMany({ userId });
  await auditService.logAction('session_invalidation', { userId });
}
```

---

## Audit & Logging

### Audit Log Events

**Critical Events to Log:**

```typescript
const AUDIT_EVENTS = [
  'user_login',
  'user_logout',
  'role_change',
  'workflow_execute',
  'workflow_approve',
  'workflow_decline',
  'user_create',
  'user_delete',
  'permission_denied',
  'rate_limit_exceeded'
];
```

**Audit Log Structure:**

```typescript
interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

**Best Practices:**

1. Log all authentication attempts (success/failure)
2. Log all authorization failures
3. Log all modifications to sensitive data
4. Include IP address and user agent
5. Use append-only audit logs (prevent tampering)
6. Regular audit log reviews
7. Set up alerts for suspicious activity

### Log Security

**Configuration:**

```typescript
// Never log sensitive data
const REDACTED_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'jwt',
  'authorization'
];

// Sanitize logs
function sanitizeLog(data: any): any {
  // Remove sensitive fields
}
```

---

## Production Deployment Security

### Environment Variables

**Required Security Variables:**

```bash
# JWT Secret (32+ bytes, random)
JWT_SECRET=<generate_with_openssl_rand_-_base64_32>

# GitHub OAuth
GITHUB_CLIENT_ID=<from_github_oauth_app>
GITHUB_CLIENT_SECRET=<from_github_oauth_app>

# Google OAuth
GOOGLE_CLIENT_ID=<from_google_oauth_console>
GOOGLE_CLIENT_SECRET=<from_google_oauth_console>

# Webhook Secret (20+ hex bytes)
GITHUB_WEBHOOK_SECRET=<generate_with_openssl_rand_-hex_20>

# Admin Configuration
ADMIN_EMAILS=admin@company.com,security@company.com
ADMIN_DOMAINS=company.com

# Database (use SSL connection string)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

**Best Practices:**

1. Never commit environment variables to git
2. Use `.env` files locally (gitignored)
3. Use secrets management in production (Vault, AWS Secrets Manager)
4. Rotate secrets regularly
5. Use different secrets per environment
6. Restrict environment variable access

### Infrastructure Security

**Docker Security:**

```dockerfile
# Use non-root user
USER node

# Read-only root filesystem
READONLY_ROOT_FILESYSTEM=true

# Drop all capabilities
CAP_DROP=ALL

# Security options
docker run --security-opt=no-new-privileges ...
```

**Network Security:**

1. Run behind reverse proxy (nginx, Apache)
2. Configure firewall rules (ufw, security groups)
3. Enable DDoS protection (Cloudflare, AWS Shield)
4. Use VPN for admin access
5. Implement network segmentation

### Reverse Proxy Configuration

**Nginx Example:**

```nginx
server {
    listen 443 ssl http2;
    server_name mission-command.example.com;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'";

    location / {
        proxy_pass http://localhost:4111;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Vulnerability Management

### Dependency Scanning

```bash
# Run security audit
pnpm audit

# Fix vulnerabilities
pnpm audit fix

# Check for outdated packages
pnpm outdated
```

**Best Practices:**

1. Run dependency scans in CI/CD pipeline
2. Automatically block builds with high-severity vulnerabilities
3. Update dependencies regularly
4. Use lock files (package-lock.json, pnpm-lock.yaml)
5. Review security advisories for dependencies

### Security Headers

**Implement in application:**

```typescript
// Security headers middleware
app.use('*', (c, next) => {
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'self'");
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  return next();
});
```

---

## Incident Response

### Security Incident Checklist

1. **Containment**
   - [ ] Block affected IPs/accounts
   - [ ] Rotate compromised secrets
   - [ ] Disable vulnerable endpoints

2. **Investigation**
   - [ ] Review audit logs
   - [ ] Identify root cause
   - [ ] Assess data exposure

3. **Recovery**
   - [ ] Apply security patches
   - [ ] Restore from clean backups
   - [ ] Verify system integrity

4. **Post-Incident**
   - [ ] Document incident details
   - [ ] Update security policies
   - [ ] Implement preventive measures
   - [ ] Conduct security review

### Security Monitoring

**Key Metrics to Monitor:**

- Failed authentication attempts per IP
- Rate limit violations per user
- Unusual API access patterns
- Webhook signature verification failures
- Authorization failures
- Database query performance (detect injection attempts)

**Alert Configuration:**

1. Set up alerts for repeated authentication failures
2. Monitor for unusual admin activity
3. Alert on webhook signature failures
4. Track API error rates
5. Monitor database connection pool exhaustion

---

## Compliance

### GDPR Considerations

1. **Data Minimization**: Collect only required user data
2. **Right to Access**: Provide user data export
3. **Right to Deletion**: Implement account deletion
4. **Data Portability**: Export data in standard format
5. **Consent Management**: Document OAuth consent

### SOC 2 Considerations

1. **Access Controls**: Implement RBAC with audit logging
2. **Change Management**: Track all configuration changes
3. **Incident Response**: Document incident procedures
4. **Data Encryption**: Encrypt data at rest and in transit
5. **Monitoring**: Continuous security monitoring

---

## Security Checklist

### Pre-Deployment

- [ ] JWT secret is 32+ bytes and randomly generated
- [ ] OAuth client secrets are unique per environment
- [ ] Webhook secrets are configured and verified
- [ ] HTTPS enabled with valid certificates
- [ ] Database uses SSL/TLS connections
- [ ] Rate limiting configured and tested
- [ ] Security headers implemented
- [ ] CORS restricted to trusted origins
- [ ] Input validation on all endpoints
- [ ] Audit logging enabled for critical operations
- [ ] Admin email/domain lists configured
- [ ] Environment variables not committed to git
- [ ] Dependency audit run with no critical vulnerabilities

### Operational

- [ ] Regular security updates applied
- [ ] Secrets rotated quarterly
- [ ] Audit logs reviewed monthly
- [ ] Role access reviews quarterly
- [ ] Security monitoring alerts configured
- [ ] Incident response plan documented
- [ ] Backups tested regularly
- [ ] Penetration testing performed annually

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Web Security Guidelines](https://web.dev/secure/)
