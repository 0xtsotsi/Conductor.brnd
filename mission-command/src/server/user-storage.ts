/**
 * Mission Command User Storage
 *
 * Provides storage for Mission Command users, sessions, and audit logs.
 * Uses LibSQL (SQLite) for development, supports PostgreSQL for production.
 */

import type { OAuthStorage } from './oauth-handler';

/**
 * Table names
 */
const TABLE_USERS = 'mission_command_users';
const TABLE_SESSIONS = 'mission_command_user_sessions';
const TABLE_AUDIT_LOG = 'mission_command_audit_log';
const TABLE_REFRESH_TOKENS = 'mission_command_refresh_tokens';

/**
 * User session data
 */
export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

/**
 * Create a LibSQL-based user storage
 */
export function createLibSQLUserStorage(db: any): OAuthStorage {
  return {
    async findUserByProvider(sub: string, provider: string) {
      const result = await db.execute({
        sql: 'SELECT * FROM mission_command_users WHERE sub = ? AND provider = ?',
        args: [sub, provider],
      });

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id as string,
        sub: row.sub as string,
        email: row.email as string,
        name: (row.name as string) || undefined,
        avatar_url: (row.avatar_url as string) || undefined,
        provider: row.provider as 'github' | 'google',
        role: row.role as 'admin' | 'operator' | 'viewer',
        created_at: new Date(row.created_at as string),
        updated_at: new Date(row.updated_at as string),
      };
    },

    async createUser(user) {
      const id = crypto.randomUUID();

      await db.execute({
        sql: `
          INSERT INTO mission_command_users (
            id, sub, email, name, avatar_url, provider, role, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          id,
          user.sub,
          user.email,
          user.name || null,
          user.avatar_url || null,
          user.provider,
          user.role,
          user.created_at.toISOString(),
          user.updated_at.toISOString(),
        ],
      });

      return { ...user, id };
    },

    async updateUser(id, updates) {
      const setClause = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(', ');
      const values = Object.values(updates);

      await db.execute({
        sql: `UPDATE mission_command_users SET ${setClause}, updated_at = ? WHERE id = ?`,
        args: [...values, new Date().toISOString(), id],
      });

      const result = await db.execute({
        sql: 'SELECT * FROM mission_command_users WHERE id = ?',
        args: [id],
      });

      const row = result.rows[0];
      return {
        id: row.id as string,
        sub: row.sub as string,
        email: row.email as string,
        name: (row.name as string) || undefined,
        avatar_url: (row.avatar_url as string) || undefined,
        provider: row.provider as 'github' | 'google',
        role: row.role as 'admin' | 'operator' | 'viewer',
        created_at: new Date(row.created_at as string),
        updated_at: new Date(row.updated_at as string),
      };
    },
  };
}

/**
 * Create an in-memory user storage (for development only)
 */
export function createInMemoryUserStorage(): OAuthStorage {
  const users: Map<string, any> = new Map();

  return {
    async findUserByProvider(sub: string, provider: string) {
      for (const user of users.values()) {
        if (user.sub === sub && user.provider === provider) {
          return user;
        }
      }
      return null;
    },

    async createUser(user) {
      const id = crypto.randomUUID();
      const newUser = { ...user, id };
      users.set(id, newUser);
      return newUser;
    },

    async updateUser(id, updates) {
      const user = users.get(id);
      if (!user) {
        throw new Error(`User not found: ${id}`);
      }
      const updated = { ...user, ...updates, updated_at: new Date() };
      users.set(id, updated);
      return updated;
    },
  };
}

/**
 * Database migration SQL for creating users, sessions, and audit_log tables
 */
export const CREATE_USERS_TABLE_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS mission_command_users (
  id TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(sub, provider)
);

CREATE INDEX IF NOT EXISTS idx_users_sub_provider ON mission_command_users(sub, provider);
CREATE INDEX IF NOT EXISTS idx_users_email ON mission_command_users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON mission_command_users(role);

-- User sessions table
CREATE TABLE IF NOT EXISTS mission_command_user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES mission_command_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON mission_command_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON mission_command_user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON mission_command_user_sessions(token_hash);

-- Audit log table
CREATE TABLE IF NOT EXISTS mission_command_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES mission_command_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON mission_command_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON mission_command_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON mission_command_audit_log(action);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS mission_command_refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  family_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES mission_command_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON mission_command_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON mission_command_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON mission_command_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON mission_command_refresh_tokens(family_id);
`;

/**
 * Run database migration to create users table
 */
export async function runUserMigration(db: any) {
  await db.execute(CREATE_USERS_TABLE_SQL);
}

/**
 * Schema definitions for PostgreSQL tables
 */
const USERS_SCHEMA = {
  id: { type: 'uuid', primaryKey: true },
  sub: { type: 'text', nullable: false },
  email: { type: 'text', nullable: false },
  name: { type: 'text', nullable: true },
  avatar_url: { type: 'text', nullable: true },
  provider: { type: 'text', nullable: false },
  role: { type: 'text', nullable: false },
  created_at: { type: 'timestamp', nullable: false },
  updated_at: { type: 'timestamp', nullable: false },
};

const SESSIONS_SCHEMA = {
  id: { type: 'uuid', primaryKey: true },
  user_id: { type: 'uuid', nullable: false },
  token_hash: { type: 'text', nullable: false },
  expires_at: { type: 'timestamp', nullable: false },
  created_at: { type: 'timestamp', nullable: false },
  ip_address: { type: 'text', nullable: true },
  user_agent: { type: 'text', nullable: true },
};

const AUDIT_LOG_SCHEMA = {
  id: { type: 'uuid', primaryKey: true },
  user_id: { type: 'uuid', nullable: true },
  action: { type: 'text', nullable: false },
  resource: { type: 'text', nullable: true },
  details: { type: 'jsonb', nullable: true },
  ip_address: { type: 'text', nullable: true },
  created_at: { type: 'timestamp', nullable: false },
};

const REFRESH_TOKENS_SCHEMA = {
  id: { type: 'uuid', primaryKey: true },
  user_id: { type: 'uuid', nullable: false },
  token_hash: { type: 'text', nullable: false },
  expires_at: { type: 'timestamp', nullable: false },
  ip_address: { type: 'text', nullable: true },
  user_agent: { type: 'text', nullable: true },
  family_id: { type: 'text', nullable: true },
  created_at: { type: 'timestamp', nullable: false },
};

/**
 * PostgreSQL-based user storage
 */
// PostgreSQL-based user storage - commented out as we're using LibSQL
// export class PgUserStorage extends PgDB implements OAuthStorage {
//   ... (class definition removed to avoid import errors)
// }
