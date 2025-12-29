# Mission Command Centre

**A web-based UI for managing Mastra workflows that orchestrate AI agents in code review and landing workflows.**

## 🎯 Overview

Mission Command Centre is a workflow orchestration UI built on top of **Mastra** - the TypeScript-first AI agent framework. It provides a web interface for creating, monitoring, and managing AI-powered workflows with human-in-the-loop approval gates.

### Key Features

- 🎨 **Modern React UI** - Built with Vite, TypeScript, and Tailwind CSS
- 🤖 **AI Agent Orchestration** - Native Mastra agents run within workflows
- 🔀 **Human-in-the-Loop** - Suspend/resume workflows for human approval
- 🔗 **GitHub Integration** - Automated branch creation, PRs, and merges
- 📊 **Real-Time Monitoring** - Live workflow execution tracking
- 🔒 **Production-Ready** - PostgreSQL storage, rate limiting, auto-cleanup

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mission Command UI (React)                    │
│                    Vite + TypeScript + Tailwind                  │
│                    Port: 3000                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
                             │ Port: 4111
┌────────────────────────────▼────────────────────────────────────┐
│                         Mastra Server                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐            │
│  │ Workflow    │  │ Agent        │  │ Storage     │            │
│  │ Executor    │  │ Runtime      │  │ Layer       │            │
│  └─────────────┘  └──────────────┘  └─────────────┘            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    Storage Layer                                  │
│  ┌─────────────┐  ┌──────────────┐                               │
│  │ LibSQL      │  │ PostgreSQL   │  (dev: LibSQL, prod: Supabase) │
│  │ (dev)       │  │ (prod)       │                               │
│  └─────────────┘  └──────────────┘                               │
└───────────────────────────────────────────────────────────────────┘
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

# GitHub (required)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your_random_webhook_secret_here

# Server (optional)
PORT=4111

# Cleanup (optional)
CLEANUP_INTERVAL_MS=3600000
RATE_LIMIT_CLEANUP_INTERVAL_MS=60000
```

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

- **[Phase 4 Implementation](./PHASE_4_IMPLEMENTATION.md)** - Production hardening documentation
- **[Code Review Workflow](./CODE_REVIEW_WORKFLOW.md)** - Workflow implementation guide
- **[UI README](./ui/README.md)** - UI component documentation
- **[GitHub Tools README](./src/tools/README.md)** - GitHub API tools documentation

## 🎨 UI Views

| View | Purpose | Route |
|------|---------|-------|
| **Mission Catalog** | Browse and create workflows | `/` |
| **Mission Detail** | View/edit workflow definition | `/workflow/:id` |
| **Mission Runs** | List workflow executions | `/runs` |
| **Run Detail** | Monitor execution status | `/runs/:runId` |
| **Approval Queue** | Review pending approvals | `/approvals` |

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

- **Signature Verification** - HMAC-SHA256 webhook signature verification
- **Rate Limiting** - 100 requests/hour per IP (configurable)
- **TTL-based Expiration** - Suspended runs auto-expire after 7 days
- **Input Validation** - All payloads validated with Zod schemas
- **Environment-based Secrets** - No hardcoded credentials

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
│   ├── server/              # Webhook handlers and middleware
│   │   ├── github-webhook.ts
│   │   ├── suspended-runs-storage.ts
│   │   ├── rate-limit.ts
│   │   └── cleanup.ts
│   ├── tools/               # GitHub agent tools
│   │   ├── github-tools.ts
│   │   └── github-tools.test.ts
│   ├── workflows/           # Mastra workflow definitions
│   │   ├── code-review-workflow.ts
│   │   └── index.ts
│   └── ui/                  # React UI components
│       ├── CatalogView.tsx
│       ├── MissionRunsView.tsx
│       └── ApprovalQueueView.tsx
├── ui/                      # Vite React app
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
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

### Table Doesn't Exist

```
Error: relation "mastra_suspended_runs" does not exist
```

**Solution**: Call `await storage.init()` to create tables.

### GitHub Token Not Working

```
Error: GITHUB_TOKEN environment variable is required
```

**Solution**: Set `GITHUB_TOKEN` in `.env` file with `repo` permissions.

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
