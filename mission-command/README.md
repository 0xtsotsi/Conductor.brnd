# Mission Command Centre - GitHub Agent Tools

GitHub integration tools for Mastra agents to interact with GitHub repositories in code review and landing workflows.

## Overview

This package provides 5 GitHub agent tools that enable Mastra workflows to:
- Create feature branches
- Create pull requests
- Fetch PR diffs for review
- Merge approved PRs
- Post comments on PRs

## Installation

```bash
# From Mission Command project root
pnpm install
```

## Setup

### Environment Variables

Required environment variable:

```bash
GITHUB_TOKEN=ghp_xxx  # GitHub Personal Access Token with repo permissions
```

### Token Permissions

The GitHub token must have the following permissions:
- `repo` (full repository access)
  - `repo:status` (read/write commit status)
  - `repo_deployment` (access deployment status)
  - `public_repo` (access public repos)
  - `repo:invite` (accept repo invites)
  - `security_events` (read/write security events)

## Tools

### 1. githubCreateBranch

Create a new feature branch from a base branch.

**Input:**
```typescript
{
  owner: string;        // Repository owner (username or org)
  repo: string;         // Repository name
  branchName: string;   // New branch name (e.g., "feature/my-feature")
  baseBranch: string;   // Base branch to branch from (default: "main")
}
```

**Output:**
```typescript
{
  success: boolean;
  branchName: string;
  ref?: string;
  sha?: string;
}
```

**Example:**
```typescript
import { githubCreateBranch } from './tools/github-tools';

const result = await githubCreateBranch.execute({
  inputData: {
    owner: 'my-org',
    repo: 'my-repo',
    branchName: 'feature/add-auth',
    baseBranch: 'main',
  },
});
```

### 2. githubCreatePR

Create a pull request in a GitHub repository.

**Input:**
```typescript
{
  owner: string;      // Repository owner
  repo: string;       // Repository name
  title: string;      // PR title
  body: string;       // PR description
  head: string;       // Source branch
  base: string;       // Target branch (default: "main")
}
```

**Output:**
```typescript
{
  success: boolean;
  prNumber: number;
  prUrl: string;
  htmlUrl: string;
  state: string;
}
```

**Example:**
```typescript
import { githubCreatePR } from './tools/github-tools';

const result = await githubCreatePR.execute({
  inputData: {
    owner: 'my-org',
    repo: 'my-repo',
    title: 'Add authentication layer',
    body: 'This PR adds OAuth2 authentication with RBAC support.',
    head: 'feature/add-auth',
    base: 'main',
  },
});
```

### 3. githubGetDiff

Fetch the diff (file changes) for a pull request.

**Input:**
```typescript
{
  owner: string;      // Repository owner
  repo: string;       // Repository name
  prNumber: number;   // Pull request number
}
```

**Output:**
```typescript
{
  success: boolean;
  prNumber: number;
  diff: string;           // Full diff content
  filesChanged: number;   // Number of files changed
  additions: number;      // Lines added
  deletions: number;      // Lines deleted
}
```

**Example:**
```typescript
import { githubGetDiff } from './tools/github-tools';

const result = await githubGetDiff.execute({
  inputData: {
    owner: 'my-org',
    repo: 'my-repo',
    prNumber: 123,
  },
});

console.log(`Diff for PR #${result.prNumber}:`);
console.log(`Files changed: ${result.filesChanged}`);
console.log(`+${result.additions} -${result.deletions}`);
console.log(result.diff);
```

### 4. githubMergePR

Merge a pull request using the specified merge method.

**Input:**
```typescript
{
  owner: string;                      // Repository owner
  repo: string;                       // Repository name
  prNumber: number;                   // Pull request number
  mergeMethod: 'merge' | 'squash' | 'rebase';  // Merge method
  commitTitle?: string;               // Optional: Merge commit title
  commitMessage?: string;             // Optional: Merge commit message
}
```

**Output:**
```typescript
{
  success: boolean;
  merged: boolean;
  sha?: string;
  message: string;
}
```

**Example:**
```typescript
import { githubMergePR } from './tools/github-tools';

const result = await githubMergePR.execute({
  inputData: {
    owner: 'my-org',
    repo: 'my-repo',
    prNumber: 123,
    mergeMethod: 'squash',
    commitTitle: 'Merge feature/add-auth',
    commitMessage: 'Squashed commit for authentication feature',
  },
});
```

### 5. githubPostComment

Post a comment on a pull request issue.

**Input:**
```typescript
{
  owner: string;      // Repository owner
  repo: string;       // Repository name
  prNumber: number;   // Pull request number
  body: string;       // Comment body (supports GitHub-flavored markdown)
}
```

**Output:**
```typescript
{
  success: boolean;
  commentId: number;
  htmlUrl: string;
  createdAt: string;
}
```

**Example:**
```typescript
import { githubPostComment } from './tools/github-tools';

const result = await githubPostComment.execute({
  inputData: {
    owner: 'my-org',
    repo: 'my-repo',
    prNumber: 123,
    body: '## Review Feedback\n\nGreat work! Just a few minor suggestions:\n\n1. Add more tests\n2. Update documentation',
  },
});
```

## Usage in Mastra Workflows

### Example: Code Review Workflow

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { githubCreateBranch, githubCreatePR, githubGetDiff, githubMergePR, githubPostComment } from './tools/github-tools';

// Step: Create branch
const createBranchStep = createStep({
  id: 'create-branch',
  inputSchema: z.object({
    featureId: z.string(),
    repoUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    const [owner, repo] = inputData.repoUrl.split('github.com/')[1].split('/');
    const result = await githubCreateBranch.execute({
      inputData: {
        owner,
        repo,
        branchName: `feature/${inputData.featureId}`,
        baseBranch: 'main',
      },
    });
    return { branchName: result.branchName };
  },
});

// Step: Create PR
const createPRStep = createStep({
  id: 'create-pr',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    branchName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const result = await githubCreatePR.execute({
      inputData: {
        owner: inputData.owner,
        repo: inputData.repo,
        title: `Feature: ${inputData.branchName}`,
        body: 'Automated PR from Mission Command',
        head: inputData.branchName,
        base: 'main',
      },
    });
    return { prNumber: result.prNumber };
  },
});

// Compose workflow
export const codeReviewWorkflow = createWorkflow({
  id: 'code-review-workflow',
})
  .then(createBranchStep)
  .then(createPRStep)
  .commit();
```

### Example: Using with Agents

```typescript
import { Agent } from '@mastra/core/agent';
import { githubTools } from './tools/github-tools';

export const githubAgent = new Agent({
  name: 'github-agent',
  instructions: 'You help manage GitHub repositories and pull requests',
  tools: {
    ...githubTools,
  },
});

// Agent can now use GitHub tools
const response = await githubAgent.generate(
  'Create a feature branch called "feature/test" from main in repo "my-org/my-repo"'
);
```

## Testing

Run the test suite:

```bash
pnpm test -- github-tools.test.ts
```

## Error Handling

All tools include comprehensive error handling:

- **Missing GITHUB_TOKEN**: Throws error before making API calls
- **API errors**: Returns detailed error messages with status codes
- **Validation errors**: Zod schemas validate all inputs
- **Network errors**: Caught and reported with context

## Rate Limiting

GitHub API has rate limits:
- **Authenticated requests**: 5,000 requests/hour
- **Unauthenticated requests**: 60 requests/hour

The tools use authenticated requests (via GITHUB_TOKEN), giving you the higher limit.

Monitor rate limit response headers:
```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1372700873
```

## Security Considerations

1. **Token Storage**: Never commit GITHUB_TOKEN to version control
   - Use `.env` files (add to `.gitignore`)
   - Use secret management in production (e.g., AWS Secrets Manager, Vault)

2. **Token Scoping**: Use minimal required permissions
   - Create dedicated tokens for Mission Command
   - Rotate tokens regularly

3. **Logging**: Be careful not to log token values
   - Tools sanitize tokens in error messages
   - Check logs before committing

## Troubleshooting

### "GITHUB_TOKEN environment variable is required"
- Ensure `GITHUB_TOKEN` is set in your environment
- Check `.env` file exists and is loaded
- Verify token isn't expired

### "GitHub API error (404): Not Found"
- Verify repository owner and name are correct
- Check token has `repo` permissions
- Ensure repository exists and is accessible

### "Failed to create branch: Branch already exists"
- Branch name conflicts with existing branch
- Use a unique branch name or delete existing branch first

### "Failed to merge PR: Pull Request is not mergeable"
- PR has merge conflicts
- CI checks haven't passed
- Branch is behind base branch

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: [Mission Command Centre Issues](https://github.com/mastra-ai/mastra/issues)
- Documentation: [Mastra Docs](https://mastra.ai/docs)
