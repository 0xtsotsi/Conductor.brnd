# Code Review Workflow - Documentation

## Overview

The Code Review Workflow is a complete implementation of an automated code review and landing process built on Mastra. It demonstrates:

- ✅ **Sequential Workflow Steps** - Steps execute in order
- ✅ **GitHub Integration** - Uses GitHub API for branches, PRs, and merges
- ✅ **Human-in-the-Loop** - Suspends for human approval via `suspend()`/`resume()`
- ✅ **Conditional Branching** - Routes based on approval decision
- ✅ **Agent Integration** - Ready for AI agent code generation

## Workflow Steps

```
┌─────────────────┐
│  Create Branch  │  Create feature branch from main
└────────┬────────┘
         ▼
┌─────────────────┐
│ Implement Feature│  AI Agent writes code (placeholder)
└────────┬────────┘
         ▼
┌─────────────────┐
│   Create PR     │  Create pull request with description
└────────┬────────┘
         ▼
┌─────────────────┐
│  ⏸️  Approval    │  Suspend for human review (HUMAN-IN-THE-LOOP)
└────────┬────────┘
         ▼
    ┌────┴────┐
    │ Branch? │
    └────┬────┘
         │
    ┌────┴─────────┐
    │              │
  Approved      Rejected
    │              │
    ▼              ▼
┌─────────┐   ┌──────────────┐
│ Merge PR│   │Post Feedback │
└─────────┘   └──────────────┘
```

## Usage

### 1. Register the Workflow with Mastra

```typescript
import { Mastra } from '@mastra/core';
import { codeReviewWorkflow } from '@mission-command/workflows';

const mastra = new Mastra({
  workflows: {
    codeReview: codeReviewWorkflow,
  },
});
```

### 2. Start a Workflow Execution

```typescript
// Create a workflow run
const run = await mastra.workflows.codeReview.createRun({
  inputData: {
    featureId: 'user-authentication',
    repoUrl: 'https://github.com/myorg/myrepo',
    owner: 'myorg',
    repo: 'myrepo',
    baseBranch: 'main',
    featureDescription: 'Add OAuth2 authentication with GitHub and Google',
    mergeMethod: 'squash',
  },
});

// Start the execution
const result = await run.start();
```

### 3. Resume a Suspended Workflow

When the workflow reaches the approval step, it will suspend. Resume it with approval decision:

```typescript
// Resume with approval
await run.resume({
  resumeData: {
    approved: true,
  },
});

// Or resume with rejection and feedback
await run.resume({
  resumeData: {
    approved: false,
    feedback: 'Please add unit tests before merging.',
  },
});
```

### 4. Monitor Workflow Status

```typescript
// Get current status
const status = run.getStatus(); // 'running', 'suspended', 'completed', 'failed'

// Get suspended steps
const suspendedSteps = run.getSuspendedSteps();

// Get workflow results
const results = await run.getResults();
```

## Input Schema

```typescript
{
  featureId: string;           // Unique feature identifier
  repoUrl: string;             // GitHub repository URL
  owner: string;               // Repository owner
  repo: string;                // Repository name
  baseBranch?: string;         // Base branch (default: 'main')
  featureDescription: string;  // What the feature should do
  mergeMethod?: 'merge' | 'squash' | 'rebase';  // How to merge (default: 'squash')
}
```

## Output Schema

```typescript
{
  result: string;      // Final result message
  branchName: string;  // Name of created branch
  prNumber: number;    // Pull request number
  prUrl: string;       // Pull request URL
  commitHash?: string; // Commit SHA if merged
}
```

## Environment Variables

```bash
# Required: GitHub personal access token
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Optional: Custom GitHub API URL (for GitHub Enterprise)
# export GITHUB_API_URL="https://github.example.com/api/v3"
```

## GitHub Token Permissions

The GitHub token needs the following permissions:
- `repo` (Full control of private repositories)
  - `repo:status` (Access commit status)
  - `repo_deployment` (Access deployment statuses)
  - `public_repo` (Access public repositories)
  - `repo:invite` (Accept repository invitations)

## Example: Complete Flow

```typescript
import { Mastra } from '@mastra/core';
import { codeReviewWorkflow } from '@mission-command/workflows';

// Initialize Mastra
const mastra = new Mastra({
  workflows: {
    codeReview: codeReviewWorkflow,
  },
});

// Start the workflow
const run = await mastra.workflows.codeReview.createRun({
  inputData: {
    featureId: 'add-user-profile',
    repoUrl: 'https://github.com/myorg/myapp',
    owner: 'myorg',
    repo: 'myapp',
    baseBranch: 'main',
    featureDescription: 'Add user profile page with avatar upload',
    mergeMethod: 'squash',
  },
});

// Execute until suspension (approval step)
const result = await run.start();

console.log('Workflow suspended for approval');
console.log('PR:', result.suspendedSteps[0].suspendData.prUrl);

// Later: Resume with human decision
const finalResult = await run.resume({
  resumeData: {
    approved: true,
  },
});

console.log('Final result:', finalResult);
// Output: { result: 'PR #123 merged successfully', ... }
```

## Integration with Approval Queue UI

The workflow integrates with the Approval Queue UI:

1. **When Suspended**: PR appears in Approval Queue with "Approve"/"Reject" buttons
2. **On Approve**: UI calls `run.resume({ resumeData: { approved: true } })`
3. **On Reject**: UI calls `run.resume({ resumeData: { approved: false, feedback: '...' } })`

## Error Handling

The workflow handles errors gracefully:

```typescript
try {
  const result = await run.start();
} catch (error) {
  if (error.message.includes('Failed to create branch')) {
    console.error('Branch creation failed:', error);
    // Handle branch creation error
  } else if (error.message.includes('Failed to merge PR')) {
    console.error('Merge failed:', error);
    // Handle merge error
  }
}
```

## Extending the Workflow

### Add Automated Testing

```typescript
const testStep = createStep({
  id: 'run-tests',
  // ... run CI/CD tests and check results
});
```

### Add Code Review Agent

```typescript
const reviewStep = createStep({
  id: 'ai-review',
  // ... Use AI agent to review PR diff and suggest changes
});
```

### Add Deployment

```typescript
const deployStep = createStep({
  id: 'deploy',
  // ... Deploy merged changes to production
});
```

## Files

- `src/workflows/code-review-workflow.ts` - Main workflow definition
- `src/workflows/index.ts` - Workflow exports
- `src/tools/github-tools.ts` - GitHub API tools used by workflow
- `src/index.ts` - Package exports

## License

MIT
