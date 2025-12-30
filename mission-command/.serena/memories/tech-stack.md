# Tech Stack

## Core Technologies
- **Language**: TypeScript (strict type checking)
- **Package Manager**: pnpm v9.7.0+
- **Runtime**: Node.js 18+
- **Build Tool**: Vite (for UI)
- **Framework**: Mastra (TypeScript-first AI agent framework)

## Frontend (UI)
- **React**: 19.0.0
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **Tanstack React Query**: Data fetching and caching
- **React Router**: Client-side routing

## Backend
- **Hono**: Lightweight web framework for API endpoints
- **PostgreSQL/LibSQL**: Database storage
- **OAuth2**: GitHub and Google authentication
- **JWT**: Token-based authentication
- **Zod**: Input validation

## Testing
- **Vitest**: Unit testing framework
- **Playwright**: E2E testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting

## Authentication & Security
- **RBAC**: Role-based access control (admin, operator, viewer)
- **OAuth2**: Third-party authentication
- **JWT**: Bearer token authentication
- **Audit Logging**: Comprehensive activity tracking
- **Rate Limiting**: Request throttling
- **HMAC-SHA256**: Webhook signature verification

## APIs and Tools
- **GitHub API**: Branch creation, PR management, code review
- **Model Context Protocol (MCP)**: External tool integration
- **Storage Adapters**: Pluggable backends (PG, Chroma, Pinecone, etc.)