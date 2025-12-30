import { describe, it, expect, beforeEach, vi } from 'vitest';
import { githubCreateBranch, githubCreatePR, githubGetDiff, githubMergePR, githubPostComment } from './github-tools';

// Mock fetch globally
global.fetch = vi.fn();

describe('GitHub Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
  });

  describe('githubCreateBranch', () => {
    it('should create a new branch from base branch', async () => {
      const mockBaseRef = {
        object: { sha: 'abc123def456' },
      };

      const mockNewBranch = {
        ref: 'refs/heads/feature/test-branch',
        object: { sha: 'abc123def456' },
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBaseRef,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNewBranch,
        });

      const result = await githubCreateBranch.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          branchName: 'feature/test-branch',
          baseBranch: 'main',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.branchName).toBe('feature/test-branch');
      expect(result.ref).toBe('refs/heads/feature/test-branch');
      expect(result.sha).toBe('abc123def456');
    });

    it('should throw error if GITHUB_TOKEN is not set', async () => {
      delete process.env.GITHUB_TOKEN;

      await expect(
        githubCreateBranch.execute(
          {
            owner: 'test-owner',
            repo: 'test-repo',
            branchName: 'feature/test',
            baseBranch: 'main',
          },
          {}
        )
      ).rejects.toThrow('GITHUB_TOKEN environment variable is required');
    });
  });

  describe('githubCreatePR', () => {
    it('should create a pull request', async () => {
      const mockPR = {
        number: 123,
        url: 'https://api.github.com/repos/test-owner/test-repo/pulls/123',
        html_url: 'https://github.com/test-owner/test-repo/pull/123',
        state: 'open',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPR,
      });

      const result = await githubCreatePR.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          title: 'Test PR',
          body: 'Test PR body',
          head: 'feature/test',
          base: 'main',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(123);
      expect(result.prUrl).toBe('https://api.github.com/repos/test-owner/test-repo/pulls/123');
      expect(result.htmlUrl).toBe('https://github.com/test-owner/test-repo/pull/123');
      expect(result.state).toBe('open');
    });
  });

  describe('githubGetDiff', () => {
    it('should fetch diff for a pull request', async () => {
      const mockPR = {
        diff_url: 'https://github.com/test-owner/test-repo/pull/123.diff',
        changed_files: 5,
        additions: 100,
        deletions: 50,
      };

      const mockDiff = '@@ Diff content here @@';

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPR,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockDiff,
        });

      const result = await githubGetDiff.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          prNumber: 123,
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(123);
      expect(result.diff).toBe(mockDiff);
      expect(result.filesChanged).toBe(5);
      expect(result.additions).toBe(100);
      expect(result.deletions).toBe(50);
    });
  });

  describe('githubMergePR', () => {
    it('should merge a pull request', async () => {
      const mockMergeResult = {
        merged: true,
        sha: 'merged123',
        message: 'Pull Request successfully merged',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMergeResult,
      });

      const result = await githubMergePR.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          prNumber: 123,
          mergeMethod: 'merge',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merged123');
      expect(result.message).toBe('Pull Request successfully merged');
    });

    it('should merge with custom commit title and message', async () => {
      const mockMergeResult = {
        merged: true,
        sha: 'merged456',
        message: 'Pull Request successfully merged',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMergeResult,
      });

      const result = await githubMergePR.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          prNumber: 123,
          mergeMethod: 'squash',
          commitTitle: 'Custom title',
          commitMessage: 'Custom message',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.merged).toBe(true);
    });
  });

  describe('githubPostComment', () => {
    it('should post a comment on a pull request', async () => {
      const mockComment = {
        id: 456,
        html_url: 'https://github.com/test-owner/test-repo/pull/123#issuecomment-456',
        created_at: '2024-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockComment,
      });

      const result = await githubPostComment.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          prNumber: 123,
          body: 'Test comment',
        },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.commentId).toBe(456);
      expect(result.htmlUrl).toBe('https://github.com/test-owner/test-repo/pull/123#issuecomment-456');
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should support markdown in comment body', async () => {
      const mockComment = {
        id: 789,
        html_url: 'https://github.com/test-owner/test-repo/pull/123#issuecomment-789',
        created_at: '2024-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockComment,
      });

      const markdownBody = '# Heading\n\n**Bold** and *italic* text';
      const result = await githubPostComment.execute(
        {
          owner: 'test-owner',
          repo: 'test-repo',
          prNumber: 123,
          body: markdownBody,
        },
        {}
      );

      expect(result.success).toBe(true);
    });
  });
});
