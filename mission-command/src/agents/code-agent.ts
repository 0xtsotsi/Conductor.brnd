/**
 * Code Generation Agent for Mission Command Centre
 *
 * This agent uses AI to analyze feature descriptions and generate code changes,
 * create commit messages, and suggest file modifications.
 */

import { Agent, createTool } from '@mastra/core';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Tool: Read a file from the filesystem
 */
export const readFileTool = createTool({
  id: 'read-file',
  description: 'Read the contents of a file from the filesystem',
  inputSchema: z.object({
    filePath: z.string().describe('Absolute path to the file to read'),
  }),
  outputSchema: z.object({
    content: z.string().describe('File contents'),
    path: z.string().describe('File path that was read'),
  }),
  execute: async ({ context }) => {
    const filePath = context?.get('filePath') as string;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        content,
        path: filePath,
      };
    } catch (error) {
      throw new Error(
        `Failed to read file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Tool: Write content to a file
 */
export const writeFileTool = createTool({
  id: 'write-file',
  description: 'Write or overwrite a file with content',
  inputSchema: z.object({
    filePath: z.string().describe('Absolute path to the file to write'),
    content: z.string().describe('Content to write to the file'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string().describe('Path of the file that was written'),
    size: z.number().describe('Size of the written content in bytes'),
  }),
  execute: async ({ context }) => {
    const filePath = context?.get('filePath') as string;
    const content = context?.get('content') as string;

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, content, 'utf-8');

      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      throw new Error(
        `Failed to write file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Tool: List files in a directory
 */
export const listFilesTool = createTool({
  id: 'list-files',
  description: 'List files and directories in a given path',
  inputSchema: z.object({
    directoryPath: z.string().describe('Absolute path to the directory'),
    recursive: z.boolean().optional().default(false).describe('Whether to list recursively'),
    pattern: z.string().optional().describe('Optional glob pattern to filter files'),
  }),
  outputSchema: z.object({
    files: z.array(z.object({
      name: z.string(),
      path: z.string(),
      type: z.enum(['file', 'directory']),
    })),
  }),
  execute: async ({ context }) => {
    const directoryPath = context?.get('directoryPath') as string;
    const recursive = (context?.get('recursive') as boolean) ?? false;
    const pattern = context?.get('pattern') as string | undefined;

    try {
      const files: Array<{ name: string; path: string; type: 'file' | 'directory' }> = [];

      const traverseDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Apply pattern filter if provided
          if (pattern && !entry.name.match(pattern)) {
            continue;
          }

          if (entry.isDirectory()) {
            files.push({
              name: entry.name,
              path: fullPath,
              type: 'directory',
            });

            if (recursive) {
              await traverseDir(fullPath);
            }
          } else {
            files.push({
              name: entry.name,
              path: fullPath,
              type: 'file',
            });
          }
        }
      };

      await traverseDir(directoryPath);

      return { files };
    } catch (error) {
      throw new Error(
        `Failed to list directory '${directoryPath}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Tool: Create a git commit
 */
export const gitCommitTool = createTool({
  id: 'git-commit',
  description: 'Create a git commit with changes in the current working directory',
  inputSchema: z.object({
    message: z.string().describe('Commit message'),
    workingDirectory: z.string().describe('Absolute path to the git repository'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    commitHash: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const message = context?.get('message') as string;
    const workingDirectory = context?.get('workingDirectory') as string;

    try {
      // Check if working directory is a git repository
      const gitDir = path.join(workingDirectory, '.git');
      try {
        await fs.access(gitDir);
      } catch {
        throw new Error(`Directory '${workingDirectory}' is not a git repository`);
      }

      // Add all changes
      execSync('git add .', {
        cwd: workingDirectory,
        stdio: 'pipe',
      });

      // Create commit
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Extract commit hash
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
      }).trim();

      return {
        success: true,
        commitHash,
        message,
      };
    } catch (error) {
      throw new Error(
        `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Tool: Get git status
 */
export const gitStatusTool = createTool({
  id: 'git-status',
  description: 'Get the current git status showing modified, added, and deleted files',
  inputSchema: z.object({
    workingDirectory: z.string().describe('Absolute path to the git repository'),
  }),
  outputSchema: z.object({
    modified: z.array(z.string()).describe('List of modified files'),
    added: z.array(z.string()).describe('List of added files'),
    deleted: z.array(z.string()).describe('List of deleted files'),
    untracked: z.array(z.string()).describe('List of untracked files'),
  }),
  execute: async ({ context }) => {
    const workingDirectory = context?.get('workingDirectory') as string;

    try {
      const output = execSync('git status --porcelain', {
        cwd: workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      const modified: string[] = [];
      const added: string[] = [];
      const deleted: string[] = [];
      const untracked: string[] = [];

      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;

        const status = line.substring(0, 2);
        const filePath = line.substring(3);

        if (status.includes('M')) {
          modified.push(filePath);
        }
        if (status.includes('A')) {
          added.push(filePath);
        }
        if (status.includes('D')) {
          deleted.push(filePath);
        }
        if (status.includes('??')) {
          untracked.push(filePath);
        }
      }

      return {
        modified,
        added,
        deleted,
        untracked,
      };
    } catch (error) {
      throw new Error(
        `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Tool: Analyze existing code structure
 */
export const analyzeCodeTool = createTool({
  id: 'analyze-code',
  description: 'Analyze the existing codebase structure and provide recommendations',
  inputSchema: z.object({
    workingDirectory: z.string().describe('Absolute path to the project root'),
    featureDescription: z.string().describe('Description of the feature to implement'),
  }),
  outputSchema: z.object({
    projectStructure: z.string().describe('Description of the project structure'),
    recommendations: z.string().describe('Recommendations for implementing the feature'),
    relevantFiles: z.array(z.string()).describe('List of relevant files to modify'),
  }),
  execute: async ({ context }) => {
    const workingDirectory = context?.get('workingDirectory') as string;
    const featureDescription = context?.get('featureDescription') as string;

    try {
      // Check for package.json
      const packageJsonPath = path.join(workingDirectory, 'package.json');
      let projectInfo = '';

      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        projectInfo = `Project: ${packageJson.name || 'unknown'}\n`;
        projectInfo += `Type: ${packageJson.type || 'commonjs'}\n`;
        if (packageJson.dependencies) {
          projectInfo += `Dependencies: ${Object.keys(packageJson.dependencies).slice(0, 10).join(', ')}\n`;
        }
      } catch {
        projectInfo = 'No package.json found\n';
      }

      // List common directories
      const commonDirs = ['src', 'lib', 'app', 'components', 'pages', 'server', 'client'];
      const foundDirs: string[] = [];

      for (const dir of commonDirs) {
        try {
          const dirPath = path.join(workingDirectory, dir);
          await fs.access(dirPath);
          foundDirs.push(dir);
        } catch {
          // Directory doesn't exist
        }
      }

      const structure = foundDirs.length > 0
        ? `Found directories: ${foundDirs.join(', ')}`
        : 'No common project directories found';

      return {
        projectStructure: `${projectInfo}${structure}`,
        recommendations: `To implement "${featureDescription}", you should:\n` +
          '1. Read relevant files to understand the codebase\n' +
          '2. Make necessary code changes using the write-file tool\n' +
          '3. Check the status with git-status\n' +
          '4. Create a commit with git-commit',
        relevantFiles: foundDirs.map(d => path.join(workingDirectory, d)),
      };
    } catch (error) {
      throw new Error(
        `Failed to analyze code: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Determine the LLM model based on environment variables
 */
function getModel() {
  // Use environment variables to select the model
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    // Import and use Claude
    const { anthropic } = require('@ai-sdk/anthropic');
    return anthropic('claude-sonnet-4-20250514'); // Claude Sonnet 4
  } else if (openaiKey) {
    // Import and use GPT
    const { openai } = require('@ai-sdk/openai');
    return openai('gpt-4o'); // GPT-4o
  } else {
    // Default to a widely available model
    // Note: This will require the user to have configured some model
    const { openai } = require('@ai-sdk/openai');
    return openai('gpt-4o');
  }
}

/**
 * Code Generation Agent
 *
 * This agent can:
 * - Analyze feature descriptions
 * - Read and understand existing code
 * - Generate code changes
 * - Create commits
 * - Suggest file modifications
 */
export const codeAgent = new Agent({
  id: 'code-generation-agent',
  name: 'Code Generation Agent',
  description: 'AI agent that analyzes feature descriptions and generates code changes',
  instructions: `You are an expert software developer and code generation agent. Your role is to:

1. **Understand the Feature**: Carefully analyze the feature description to understand what needs to be implemented.

2. **Explore the Codebase**: Use the analyze-code tool to understand the project structure and identify relevant files.

3. **Read Relevant Files**: Use the read-file tool to read files that are relevant to the feature.

4. **Generate Code**: Make code changes using the write-file tool. Ensure your code:
   - Follows existing code style and conventions
   - Is well-documented with comments
   - Handles errors appropriately
   - Includes necessary imports and dependencies

5. **Review Changes**: Use git-status to see what files have been modified.

6. **Create Commit**: Use git-commit to create a meaningful commit message that describes the changes.

**Best Practices**:
- Always read existing code before making changes to understand the context
- Write clean, maintainable code
- Use descriptive commit messages
- Handle errors gracefully
- Add appropriate logging where needed
- Consider edge cases in your implementation

**Constraints**:
- Only modify files that are necessary for the feature
- Don't delete code unless absolutely necessary
- Test your changes mentally before committing
- If you're unsure about something, ask for clarification
`,
  model: getModel(),
  tools: {
    readFile: readFileTool,
    writeFile: writeFileTool,
    listFiles: listFilesTool,
    gitCommit: gitCommitTool,
    gitStatus: gitStatusTool,
    analyzeCode: analyzeCodeTool,
  },
});

export default codeAgent;
