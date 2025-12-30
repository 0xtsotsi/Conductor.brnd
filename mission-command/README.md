# Mission Command Centre

**A web-based UI for managing Mastra workflows that orchestrate AI agents in code review and landing workflows.**

## 🎯 Overview

Mission Command Centre is a workflow orchestration UI built on top of **Mastra** - the TypeScript-first AI agent framework. It provides a web interface for creating, monitoring, and managing AI-powered workflows with human-in-the-loop approval gates.

### Key Features

- 🎨 **Modern React UI** - Built with Vite, TypeScript, and Tailwind CSS
- 🔐 **OAuth2 Authentication** - GitHub and Google OAuth with JWT-based sessions
- 👥 **Role-Based Access Control (RBAC)** - Admin, Operator, and Viewer roles
- 🤖 **AI Agent Orchestration** - Native Mastra agents run within workflows
- 🔀 **Human-in-the-Loop** - Suspend/resume workflows for human approval
- 🔗 **GitHub Integration** - Automated branch creation, PRs, and merges
- 📊 **Real-Time Monitoring** - Live workflow execution tracking
- 🔒 **Production-Ready** - PostgreSQL storage, rate limiting, audit logging

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mission Command UI (React)                    │
│                    Vite + TypeScript + Tailwind                  │
│                    Port: 3000                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AuthProvider + RBAC                        │    │
│  │         (OAuth2 + JWT + Role Checks)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (JWT Auth)
                             │ Port: 4111
┌────────────────────────────▼────────────────────────────────────┐
│                         Mastra Server                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐            │
│  │ Workflow    │  │ Agent        │  │ OAuth/Auth  │            │
│  │ Executor    │  │ Runtime      │  │ Middleware  │            │
│  └─────────────┘  └──────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐            │
│  │ RBAC        │  │ Audit        │  │ Rate Limit  │            │
│  │ Middleware  │  │ Logging      │  │ Protection  │            │
│  └─────────────┘  └──────────────┘  └─────────────┘            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    Storage Layer                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │  PostgreSQL Database                             │           │
│  │  ├── users (OAuth accounts + RBAC)               │           │
│  │  ├── sessions (JWT session management)           │           │
│  │  ├── audit_log (activity tracking)               │           │
│  │  └── suspended_runs (workflow state)             │           │
│  └──────────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Browser │         │   API    │         │  OAuth   │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │ 1. Click Login     │                    │
     ├───────────────────>│                    │
     │                    │ 2. Redirect to     │
     │                    │    OAuth provider  │
     │                    ├──────────────────>│
     │                    │                    │
     │                    │ 3. User approves  │
     │                    │<──────────────────┤
     │                    │                    │
     │                    │ 4. Exchange code   │
     │                    │    for token       │
     │                    ├──────────────────>│
     │                    │<──────────────────┤
     │                    │                    │
     │                    │ 5. Fetch user      │
     │                    │    profile         │
     │                    ├──────────────────>│
     │                    │<──────────────────┤
     │                    │                    │
     │ 6. Redirect with  │                    │
     │    JWT token       │                    │
     │<───────────────────┤                    │
     │                    │                    │
     │ 7. Store JWT       │                    │
     │    (localStorage)   │                    │
     ├                    │                    │
     │                    │                    │
     │ 8. API Request     │                    │
     │    with JWT        │                    │
     ├───────────────────>│                    │
     │                    │ 9. Validate JWT    │
     │                    │    + Check Role    │
     │<───────────────────┤                    │
     │  Response Data     │                    │
     ├                    │                    │
```

## 📦 Installation

### Prerequisites

- Node.js 18+
- pnpm 9.7.0+
- PostgreSQL (for production) or LibSQL (for development)

### Setup

```bash
# Clone the repository
git clone https://github.com/mastra-ai/mastra.git
cd mastra
cd packages/mission-command

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build the package
pnpm build
```

### Environment Variables

```bash
# Database (required for production)
DATABASE_URL=postgresql://user:password@localhost:5432/mission_command

# GitHub OAuth (required)
GITHUB_CLIENT_ID=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google OAuth (optional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# JWT Secret (required - generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here_minimum_32_bytes

# GitHub (required)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your_random_webhook_secret_here

# Admin Configuration (optional)
ADMIN_EMAILS=admin@company.com,security@company.com
ADMIN_DOMAINS=company.com

# Server (optional)
PORT=4111

# Cleanup (optional)
CLEANUP_INTERVAL_MS=3600000
RATE_LIMIT_CLEANUP_INTERVAL_MS=60000
```

### OAuth App Setup

**GitHub OAuth:**

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set:
   - Application name: `Mission Command`
   - Homepage URL: `http://localhost:3000` (dev) or your domain (prod)
   - Callback URL: `http://localhost:4111/api/auth/callback`
4. Copy Client ID and Client Secret to `.env`

**Google OAuth:**

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 credentials
3. Set authorized redirect URI: `http://localhost:4111/api/auth/callback`
4. Copy Client ID and Client Secret to `.env`

## 🚀 Quick Start

### 1. Start the UI (Development)

```bash
cd ui
pnpm install
pnpm dev
```

The UI will be available at http://localhost:3000

### 2. Start the Mastra Server

```bash
// From mission-command root
import { createServer } from './src/server/example';

const server = await createServer({
  databaseUrl: process.env.DATABASE_URL,
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,

  resumeWorkflow: async ({ runId, resumeData }) => {
    // Resume workflow with approval decision
    await mastra.getWorkflow('code-review').resume(runId, resumeData);
  },
});

Bun.serve({
  port: 4111,
  fetch: server.app.fetch,
});
```

The API will be available at http://localhost:4111

### 3. Configure GitHub Webhook

1. Go to your repository settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.com/webhooks/github`
3. Content type: `application/json`
4. Secret: Use the same value as `GITHUB_WEBHOOK_SECRET`
5. Events: Pull requests (opened, synchronized, closed, merged)

## 📖 Documentation

### Core Documentation

- **[API Reference](./docs/API_REFERENCE.md)** - Complete API endpoint documentation
- **[Security Guide](./docs/SECURITY_GUIDE.md)** - Security best practices and hardening
- **[Troubleshooting Guide](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Migration Guide](./docs/MIGRATION_GUIDE.md)** - Version migration instructions
- **[Contributing Guide](./docs/CONTRIBUTING.md)** - Development contribution guidelines

### Phase Documentation

- **[Phase 4 Implementation](./PHASE_4_IMPLEMENTATION.md)** - Production hardening documentation
- **[Phase 5 Authentication](./PHASE_5_AUTH_IMPLEMENTATION.md)** - OAuth and RBAC implementation
- **[Code Review Workflow](./CODE_REVIEW_WORKFLOW.md)** - Workflow implementation guide
- **[UI README](./ui/README.md)** - UI component documentation
- **[GitHub Tools README](./src/tools/README.md)** - GitHub API tools documentation

### Architecture

- **[Architecture](./ARCHITECTURE.md)** - System architecture and component diagrams
- **[Deployment](./DEPLOYMENT.md)** - Production deployment guide
- **[Development](./DEVELOPMENT.md)** - Development environment setup

## 🎨 UI Views

| View | Purpose | Route | Required Role |
|------|---------|-------|---------------|
| **Login** | OAuth authentication | `/login` | Public |
| **Mission Catalog** | Browse and create workflows | `/` | Viewer+ |
| **Mission Detail** | View/edit workflow definition | `/workflow/:id` | Viewer+ |
| **Mission Runs** | List workflow executions | `/runs` | Viewer+ |
| **Run Detail** | Monitor execution status | `/runs/:runId` | Viewer+ |
| **Approval Queue** | Review pending approvals | `/approvals` | Operator+ |
| **User Management** | Manage users and roles | `/admin/users` | Admin |

## 👥 Role-Based Access Control (RBAC)

### Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, user management, system settings, workflow management |
| **Operator** | Execute workflows, approve/decline requests, view runs |
| **Viewer** | Read-only access to workflows and runs |

### Role Assignment

Users are assigned roles based on:

1. **Email-Based Admin**: `ADMIN_EMAILS` environment variable
2. **Domain-Based Admin**: `ADMIN_DOMAINS` environment variable
3. **Default Role**: `viewer` for all other users

### API Authorization

```typescript
// Admin-only endpoint
app.get('/api/admin/*', requireRole('admin'));

// Operator+ endpoint
app.post('/api/workflows/*/execute', requireRole('operator'));

// Viewer+ endpoint
app.get('/api/workflows', requireRole('viewer'));
```

## 🔌 GitHub Integration

Mission Command Centre provides 5 GitHub agent tools:

1. **githubCreateBranch** - Create feature branches
2. **githubCreatePR** - Create pull requests
3. **githubGetDiff** - Fetch PR diffs for review
4. **githubMergePR** - Merge approved PRs
5. **githubPostComment** - Post comments on PRs

See [GitHub Tools README](./src/tools/README.md) for detailed usage.

## 📊 API Endpoints

### Webhook Endpoints

| Method | Endpoint | Description | Rate Limited |
|--------|----------|-------------|--------------|
| POST | `/webhooks/github` | Receive GitHub webhooks | ✅ 100/hr |
| GET | `/webhooks/github/health` | Health check | ❌ |
| GET | `/webhooks/github/suspended` | List suspended runs | ❌ |
| POST | `/webhooks/github/cleanup` | Manual cleanup | ❌ |

### Mastra Server Endpoints

Mastra Server provides auto-generated REST APIs for:

- **Workflows**: `/workflows`, `/workflows/:id/runs`
- **Agents**: `/agents`, `/agents/:id/generate`
- **Storage**: `/threads`, `/messages`

See [Mastra Documentation](https://mastra.ai/docs) for complete API reference.

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- github-tools.test.ts
pnpm test -- github-webhook.test.ts
```

### Integration Tests (coming soon)

```bash
# Run integration tests
pnpm test:integration
```

### E2E Tests (coming soon)

```bash
# Run E2E tests with Playwright
pnpm test:e2e
```

## 🔒 Security Features

- **OAuth2 Authentication** - GitHub and Google OAuth with secure token handling
- **JWT-Based Sessions** - Stateless authentication with HMAC-SHA256 signing
- **Role-Based Access Control (RBAC)** - Admin, Operator, and Viewer roles
- **HMAC-SHA256 Webhook Verification** - Prevent webhook spoofing attacks
- **Per-User Rate Limiting** - 100 requests/hour (configurable)
- **Audit Logging** - All user actions logged with IP and timestamp
- **Session Management** - HTTP-only cookies, session invalidation
- **Input Validation** - All payloads validated with Zod schemas
- **Environment-Based Secrets** - No hardcoded credentials
- **CSRF Protection** - State parameter validation on OAuth flows

## 📈 Performance

- **Webhook Response Time**: < 100ms (with rate limiting)
- **Database Queries**: Optimized with indexes
- **Cleanup Overhead**: Minimal (background job)
- **Memory Usage**: Constant (bounded by rate limit store)

## 🛠️ Development

### Project Structure

```
mission-command/
├── src/
│   ├── server/              # API server and handlers
│   │   ├── handlers/        # API route handlers
│   │   │   ├── workflows.ts
│   │   │   ├── missions.ts
│   │   │   ├── approvals.ts
│   │   │   └── users-api.ts
│   │   ├── oauth-handler.ts # OAuth2 flows
│   │   ├── jwt-middleware.ts # JWT validation
│   │   ├── rbac-middleware.ts # Role-based auth
│   │   ├── rate-limit.ts    # Rate limiting
│   │   ├── audit-middleware.ts # Audit logging
│   │   ├── user-storage.ts  # Database operations
│   │   └── mastra-server.ts # Main server
│   ├── auth/                # Authentication services
│   │   ├── audit-service.ts
│   │   └── types.ts
│   ├── tools/               # GitHub agent tools
│   │   ├── github-tools.ts
│   │   └── github-tools.test.ts
│   ├── workflows/           # Mastra workflow definitions
│   │   ├── code-review-workflow.ts
│   │   └── index.ts
│   └── ui/                  # React UI components
├── ui/                      # Vite React app
│   ├── src/
│   │   ├── providers/       # React Context providers
│   │   │   ├── AuthProvider.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
├── docs/                    # Documentation
│   ├── API_REFERENCE.md
│   ├── SECURITY_GUIDE.md
│   ├── TROUBLESHOOTING.md
│   ├── MIGRATION_GUIDE.md
│   └── CONTRIBUTING.md
├── e2e/                     # E2E tests
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Building

```bash
# Build from monorepo root
pnpm build

# Build mission-command package only
pnpm build:package
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm format
```

## 🐛 Troubleshooting

### Database Connection Issues

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL is running and `DATABASE_URL` is correct.

### JWT Verification Failed

```
401 Unauthorized: Invalid token
```

**Solution**: Ensure `JWT_SECRET` is set and matches between server restarts. User should re-authenticate.

### OAuth Callback Fails

```
Error exchanging code for token
```

**Solution**:
- Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`
- Check callback URL matches OAuth app configuration exactly
- Ensure OAuth app is not in sandbox mode

### Table Doesn't Exist

```
Error: relation "mission_command_users" does not exist
```

**Solution**: Run database initialization to create required tables:
```bash
pnpm run db:init
```

### GitHub Token Not Working

```
Error: GITHUB_TOKEN environment variable is required
```

**Solution**: Set `GITHUB_TOKEN` in `.env` file with `repo` permissions.

For more troubleshooting help, see [Troubleshooting Guide](./docs/TROUBLESHOOTING.md).

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests
5. Submit a pull request

## 📚 Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Workflow Overview](https://mastra.ai/docs/workflows/overview)
- [Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume)

## 🆘 Support

For issues and questions:
- GitHub Issues: [Mission Command Centre Issues](https://github.com/mastra-ai/mastra/issues)
- Documentation: [Mastra Docs](https://mastra.ai/docs)

---

**Built with ❤️ using [Mastra](https://mastra.ai)**
