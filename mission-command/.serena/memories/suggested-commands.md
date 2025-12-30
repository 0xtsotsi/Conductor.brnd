# Development Commands

## Setup and Build
- `pnpm install` - Install dependencies (required first step)
- `pnpm build` - Build all packages (excludes examples and docs)
- `pnpm build:packages` - Build core packages only
- `pnpm build:core` - Build core framework package
- `pnpm build:cli` - Build CLI and playground package
- `pnpm build:memory` - Build memory package

## Development
- `pnpm dev:services:up` - Start local Docker services (required for integration tests)
- `pnpm dev:services:down` - Stop local Docker services
- `pnpm typecheck` - Run TypeScript checks across all packages
- `pnpm format` - Run linting across all packages with auto-fix

## Testing
- `pnpm test` - Run all tests (slow)
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:e2e` - Run E2E tests with Playwright
- For faster testing: Build from root, then cd to specific package

## Package-specific Testing (Faster)
```bash
# Build from root first
pnpm build

# Then test specific packages
cd packages/memory
pnpm test   # Much faster than running all tests
```

## Project Structure
- Root: Main project configuration and builds
- packages/: Core framework packages
- stores/: Storage adapters
- deployers/: Platform deployment adapters
- integrations/: Third-party API integrations
- examples/: Demo applications
- auth/: Authentication provider integrations

## Build with Increased Memory
If encountering memory errors:
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```