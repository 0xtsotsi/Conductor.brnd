# Project Purpose

Mission Command Centre is a web-based UI for managing Mastra workflows that orchestrate AI agents in code review and landing workflows. It provides a workflow orchestration UI built on top of Mastra - the TypeScript-first AI agent framework.

## Key Features
- Modern React UI built with Vite, TypeScript, and Tailwind CSS
- AI Agent Orchestration with native Mastra agents running within workflows
- Human-in-the-Loop with suspend/resume workflows for human approval
- GitHub Integration for automated branch creation, PRs, and merges
- Real-Time Monitoring of workflow execution tracking
- Production-Ready with PostgreSQL storage, rate limiting, and auto-cleanup

## Architecture
The project follows a layered architecture:
- UI Layer: React/Vite frontend on port 3000
- API Layer: Mastra Server on port 4111
- Storage Layer: LibSQL (dev) or PostgreSQL (prod)
- GitHub Integration via OAuth and webhooks

## User Management Features
The project includes comprehensive user management with:
- Role-based access control (RBAC): admin, operator, viewer
- OAuth authentication (GitHub, Google)
- User CRUD operations
- Session management
- Audit logging
- Admin-only user management interface