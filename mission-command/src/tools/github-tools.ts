import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * GitHub Agent Tools for Mission Command Centre
 *
 * These tools enable Mastra agents to interact with GitHub repositories
 * for code review and landing workflows.
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Helper function to make authenticated GitHub API requests
 */
async function githubRequest(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${GITHUB_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Mission-Command-Centre',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API error (${response.status}): ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Tool: Create a new branch in a GitHub repository
 */
export const githubCreateBranch = createTool({
  id: 'github-create-branch',
  description: 'Create a new feature branch from a base branch in a GitHub repository',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    branchName: z.string().describe('Name for the new branch (e.g., feature/my-feature)'),
    baseBranch: z.string().describe('Base branch to create from (default: main)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    branchName: z.string(),
    ref: z.string().optional(),
    sha: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { owner, repo, branchName, baseBranch } = inputData;
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    try {
      // Get the SHA of the base branch
      const baseRef = await githubRequest(
        `/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
        token
      );

      const sha = baseRef.object.sha;

      // Create the new branch
      const result = await githubRequest(
        `/repos/${owner}/${repo}/git/refs`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: sha,
          }),
        }
      );

      return {
        success: true,
        branchName,
        ref: result.ref,
        sha: result.object.sha,
      };
    } catch (error) {
      throw new Error(
        `Failed to create branch '${branchName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * Tool: Create a pull request in a GitHub repository
 */
export const githubCreatePR = createTool({
  id: 'github-create-pr',
  description: 'Create a pull request in a GitHub repository',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    title: z.string().describe('Pull request title'),
    body: z.string().describe('Pull request description/body'),
    head: z.string().describe('Head branch (source branch)'),
    base: z.string().describe('Base branch (target branch, default: main)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    prNumber: z.number(),
    prUrl: z.string(),
    htmlUrl: z.string(),
    state: z.string(),
  }),
  execute: async (inputData) => {
    const { owner, repo, title, body, head, base } = inputData;
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    try {
      const result = await githubRequest(
        `/repos/${owner}/${repo}/pulls`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body,
            head,
            base,
          }),
        }
      );

      return {
        success: true,
        prNumber: result.number,
        prUrl: result.url,
        htmlUrl: result.html_url,
        state: result.state,
      };
    } catch (error) {
      throw new Error(
        `Failed to create PR: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * Tool: Get the diff for a pull request
 */
export const githubGetDiff = createTool({
  id: 'github-get-diff',
  description: 'Fetch the diff (file changes) for a pull request',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    prNumber: z.number().describe('Pull request number'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    prNumber: z.number(),
    diff: z.string(),
    filesChanged: z.number(),
    additions: z.number(),
    deletions: z.number(),
  }),
  execute: async (inputData) => {
    const { owner, repo, prNumber } = inputData;
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    try {
      // Get PR details first
      const pr = await githubRequest(
        `/repos/${owner}/${repo}/pulls/${prNumber}`,
        token
      );

      // Get the diff
      const diffResponse = await fetch(pr.diff_url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3.diff',
        },
      });

      if (!diffResponse.ok) {
        throw new Error(`Failed to fetch diff: ${diffResponse.statusText}`);
      }

      const diff = await diffResponse.text();

      return {
        success: true,
        prNumber,
        diff,
        filesChanged: pr.changed_files,
        additions: pr.additions,
        deletions: pr.deletions,
      };
    } catch (error) {
      throw new Error(
        `Failed to get diff for PR #${prNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * Tool: Merge a pull request
 */
export const githubMergePR = createTool({
  id: 'github-merge-pr',
  description: 'Merge a pull request using the specified merge method',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    prNumber: z.number().describe('Pull request number'),
    mergeMethod: z.enum(['merge', 'squash', 'rebase']).default('merge').describe('Merge method'),
    commitTitle: z.string().optional().describe('Title for the merge commit'),
    commitMessage: z.string().optional().describe('Message for the merge commit'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    merged: z.boolean(),
    sha: z.string().optional(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    const { owner, repo, prNumber, mergeMethod, commitTitle, commitMessage } = inputData;
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    try {
      const body: any = {
        merge_method: mergeMethod,
      };

      if (commitTitle) {
        body.commit_title = commitTitle;
      }

      if (commitMessage) {
        body.commit_message = commitMessage;
      }

      const result = await githubRequest(
        `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
        token,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      return {
        success: true,
        merged: result.merged,
        sha: result.sha,
        message: result.message,
      };
    } catch (error) {
      throw new Error(
        `Failed to merge PR #${prNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * Tool: Post a comment on a pull request
 */
export const githubPostComment = createTool({
  id: 'github-post-comment',
  description: 'Post a comment on a pull request issue',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    prNumber: z.number().describe('Pull request number'),
    body: z.string().describe('Comment body text (supports GitHub-flavored markdown)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    commentId: z.number(),
    htmlUrl: z.string(),
    createdAt: z.string(),
  }),
  execute: async (inputData) => {
    const { owner, repo, prNumber, body } = inputData;
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    try {
      const result = await githubRequest(
        `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body,
          }),
        }
      );

      return {
        success: true,
        commentId: result.id,
        htmlUrl: result.html_url,
        createdAt: result.created_at,
      };
    } catch (error) {
      throw new Error(
        `Failed to post comment on PR #${prNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * Export all GitHub tools as a set for easy import
 */
export const githubTools = {
  githubCreateBranch,
  githubCreatePR,
  githubGetDiff,
  githubMergePR,
  githubPostComment,
};

export default githubTools;
