import { TestMission, TestApprovalQueue, TestUser } from '../fixtures/test-options';

/**
 * Random data generators for E2E tests
 *
 * These utilities generate random test data for use in E2E tests.
 * All generated data is deterministic based on the seed, ensuring
 * reproducibility in test runs.
 */

let seed = 12345;

/**
 * Simple seeded random number generator
 */
function seededRandom(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

/**
 * Reset random seed for reproducibility
 */
export function resetRandomSeed(newSeed: number = 12345): void {
  seed = newSeed;
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(seededRandom() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `${randomString(8).toLowerCase()}@test.local`;
}

/**
 * Generate random mission title
 */
export function randomMissionTitle(): string {
  const prefixes = ['Test', 'Sample', 'Demo', 'Example', 'Debug', 'Verify'];
  const actions = ['Create', 'Update', 'Delete', 'Review', 'Deploy', 'Build'];
  const targets = ['API', 'UI', 'Database', 'Service', 'Workflow', 'Component'];

  const prefix = prefixes[Math.floor(seededRandom() * prefixes.length)];
  const action = actions[Math.floor(seededRandom() * actions.length)];
  const target = targets[Math.floor(seededRandom() * targets.length)];
  const id = Math.floor(seededRandom() * 1000);

  return `${prefix} ${action} ${target} ${id}`;
}

/**
 * Generate random mission description
 */
export function randomMissionDescription(): string {
  const templates = [
    'This mission is testing {action} {target} functionality',
    'Verification of {target} {action} process',
    'Testing edge cases in {target} {action}',
    'Automated test for {action} {target}',
  ];

  const actions = ['create', 'update', 'delete', 'review'];
  const targets = ['API', 'UI', 'database', 'workflow'];

  const template = templates[Math.floor(seededRandom() * templates.length)];
  const action = actions[Math.floor(seededRandom() * actions.length)];
  const target = targets[Math.floor(seededRandom() * targets.length)];

  return template.replace('{action}', action).replace('{target}', target);
}

/**
 * Generate random repository name
 */
export function randomRepository(): string {
  const owners = ['test-org', 'example-corp', 'demo-team'];
  const repos = ['test-repo', 'example-service', 'demo-project'];

  const owner = owners[Math.floor(seededRandom() * owners.length)];
  const repo = repos[Math.floor(seededRandom() * repos.length)];

  return `${owner}/${repo}`;
}

/**
 * Generate random branch name
 */
export function randomBranch(): string {
  const types = ['feature', 'bugfix', 'hotfix', 'refactor'];
  const type = types[Math.floor(seededRandom() * types.length)];
  const id = Math.floor(seededRandom() * 1000);

  return `${type}/${randomString(8).toLowerCase()}-${id}`;
}

/**
 * Generate test mission object
 */
export function generateTestMission(overrides?: Partial<TestMission>): TestMission {
  const id = `mission-${randomString(8).toLowerCase()}`;
  const now = new Date();

  return {
    id,
    title: randomMissionTitle(),
    description: randomMissionDescription(),
    status: ['pending', 'in_progress', 'completed', 'failed'][
      Math.floor(seededRandom() * 4)
    ] as TestMission['status'],
    repository: randomRepository(),
    branch: randomBranch(),
    pullRequest: Math.floor(seededRandom() * 100) + 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Generate test approval queue object
 */
export function generateApprovalQueue(
  overrides?: Partial<TestApprovalQueue>
): TestApprovalQueue {
  const id = `approval-${randomString(8).toLowerCase()}`;
  const now = new Date();

  return {
    id,
    missionId: `mission-${randomString(8).toLowerCase()}`,
    type: ['code_review', 'deployment', 'configuration'][
      Math.floor(seededRandom() * 3)
    ] as TestApprovalQueue['type'],
    status: ['pending', 'approved', 'rejected'][
      Math.floor(seededRandom() * 3)
    ] as TestApprovalQueue['status'],
    requestedBy: 'test-operator@test.local',
    reviewedBy: undefined,
    createdAt: now,
    reviewedAt: undefined,
    ...overrides,
  };
}

/**
 * Generate array of test missions
 */
export function generateTestMissions(count: number): TestMission[] {
  return Array.from({ length: count }, () => generateTestMission());
}

/**
 * Generate array of test approval queues
 */
export function generateTestApprovalQueues(count: number): TestApprovalQueue[] {
  return Array.from({ length: count }, () => generateApprovalQueue());
}
