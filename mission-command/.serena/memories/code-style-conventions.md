# Code Style and Conventions

## General Guidelines
- Follow TypeScript strict mode
- Use ESLint and Prettier for code quality
- Avoid marketing language in documentation - focus on technical details
- Write for engineers, not marketing

## File Organization
- Each package has its own directory under `packages/`
- Source code in `src/` directory
- Tests co-located with source files
- Documentation in `docs/` and README files

## Naming Conventions
- **Variables**: camelCase
- **Components**: PascalCase (React components)
- **Files**: kebab-case for files, PascalCase for components
- **API endpoints**: snake_case in URLs
- **Database tables**: snake_case

## TypeScript Patterns
- Use interfaces for data shapes
- Use types for unions and primitives
- Properly type all function parameters and return values
- Use generic types where appropriate

## React Patterns
- Use functional components with hooks
- Use TypeScript interfaces for props
- Follow React best practices
- Use Tailwind CSS for styling
- Implement proper error boundaries

## API Patterns
- Use Hono for route handling
- Validate all input with Zod schemas
- Use proper HTTP status codes
- Return consistent JSON response format
- Include error details in development

## Database Patterns
- Use migrations for schema changes
- Proper indexes for performance
- Use proper foreign key constraints
- Store timestamps as ISO strings

## Security Patterns
- Never expose sensitive data in logs
- Use parameterized queries
- Validate all user inputs
- Use proper authentication and authorization
- Audit all sensitive operations