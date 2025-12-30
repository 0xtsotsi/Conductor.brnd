/**
 * Test Options and Type Definitions
 */

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface TestMission {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  repository: string;
  branch: string;
  pullRequest?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestApprovalQueue {
  id: string;
  missionId: string;
  type: 'code_review' | 'deployment' | 'configuration';
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  reviewedBy?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

export interface TestEnvironment {
  name: string;
  baseUrl: string;
  databaseUrl: string;
  githubToken?: string;
  githubWebhookSecret?: string;
}

export interface PageElements {
  [key: string]: string;
}
