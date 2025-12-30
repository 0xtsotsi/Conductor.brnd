/**
 * Mission Command User Storage
 *
 * Provides storage for Mission Command users, sessions, and audit logs.
 * Uses LibSQL (SQLite) for development, supports PostgreSQL for production.
 */

import type { IDatabase } from 'pg-promise';
import type { PgDomainConfig } from '../../../../stores/pg/src/storage/db';
import { PgDB } from '../../../../stores/pg/src/storage/db';
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
export class PgUserStorage extends PgDB implements OAuthStorage {
  constructor(config: PgDomainConfig) {
    super(config);
  }

  /**
   * Initialize all database tables
   */
  async init(): Promise<void> {
    // Create users table
    await this.createTable({
      tableName: TABLE_USERS as any,
      schema: USERS_SCHEMA,
    });

    await this.createIndex({
      name: 'idx_users_sub_provider_pg',
      table: TABLE_USERS as any,
      columns: ['sub', 'provider'],
      unique: true,
    });

    await this.createIndex({
      name: 'idx_users_email_pg',
      table: TABLE_USERS as any,
      columns: ['email'],
      unique: true,
    });

    await this.createIndex({
      name: 'idx_users_role_pg',
      table: TABLE_USERS as any,
      columns: ['role'],
    });

    // Create sessions table
    await this.createTable({
      tableName: TABLE_SESSIONS as any,
      schema: SESSIONS_SCHEMA,
    });

    await this.createIndex({
      name: 'idx_sessions_user_id_pg',
      table: TABLE_SESSIONS as any,
      columns: ['user_id'],
    });

    await this.createIndex({
      name: 'idx_sessions_expires_at_pg',
      table: TABLE_SESSIONS as any,
      columns: ['expires_at'],
    });

    await this.createIndex({
      name: 'idx_sessions_token_hash_pg',
      table: TABLE_SESSIONS as any,
      columns: ['token_hash'],
    });

    // Create audit log table
    await this.createTable({
      tableName: TABLE_AUDIT_LOG as any,
      schema: AUDIT_LOG_SCHEMA,
    });

    await this.createIndex({
      name: 'idx_audit_user_id_pg',
      table: TABLE_AUDIT_LOG as any,
      columns: ['user_id'],
    });

    await this.createIndex({
      name: 'idx_audit_created_at_pg',
      table: TABLE_AUDIT_LOG as any,
      columns: ['created_at'],
    });

    await this.createIndex({
      name: 'idx_audit_action_pg',
      table: TABLE_AUDIT_LOG as any,
      columns: ['action'],
    });

    // Create refresh tokens table
    await this.createTable({
      tableName: TABLE_REFRESH_TOKENS as any,
      schema: REFRESH_TOKENS_SCHEMA,
    });

    await this.createIndex({
      name: 'idx_refresh_tokens_user_id_pg',
      table: TABLE_REFRESH_TOKENS as any,
      columns: ['user_id'],
    });

    await this.createIndex({
      name: 'idx_refresh_tokens_token_hash_pg',
      table: TABLE_REFRESH_TOKENS as any,
      columns: ['token_hash'],
    });

    await this.createIndex({
      name: 'idx_refresh_tokens_expires_at_pg',
      table: TABLE_REFRESH_TOKENS as any,
      columns: ['expires_at'],
    });

    await this.createIndex({
      name: 'idx_refresh_tokens_family_id_pg',
      table: TABLE_REFRESH_TOKENS as any,
      columns: ['family_id'],
    });
  }

  /**
   * Find user by OAuth provider
   */
  async findUserByProvider(sub: string, provider: string): Promise<any> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_USERS} WHERE sub = $1 AND provider = $2`,
      [sub, provider]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      sub: row.sub,
      email: row.email,
      name: row.name || undefined,
      avatar_url: row.avatar_url || undefined,
      provider: row.provider,
      role: row.role,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /**
   * Create new user
   */
  async createUser(user: any): Promise<any> {
    const id = crypto.randomUUID();

    await this.insert({
      tableName: TABLE_USERS as any,
      data: {
        id,
        sub: user.sub,
        email: user.email,
        name: user.name || null,
        avatar_url: user.avatar_url || null,
        provider: user.provider,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });

    return { ...user, id };
  }

  /**
   * Update user
   */
  async updateUser(id: string, updates: any): Promise<any> {
    await this.update({
      tableName: TABLE_USERS as any,
      data: {
        ...updates,
        updated_at: new Date(),
      },
      where: { id },
    });

    const result = await this.query(
      `SELECT * FROM ${TABLE_USERS} WHERE id = $1`,
      [id]
    );

    if (result.length === 0) {
      throw new Error(`User not found: ${id}`);
    }

    const row = result[0];
    return {
      id: row.id,
      sub: row.sub,
      email: row.email,
      name: row.name || undefined,
      avatar_url: row.avatar_url || undefined,
      provider: row.provider,
      role: row.role,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<any> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_USERS} WHERE id = $1`,
      [userId]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      sub: row.sub,
      email: row.email,
      name: row.name || undefined,
      avatar_url: row.avatar_url || undefined,
      provider: row.provider,
      role: row.role,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_USERS} WHERE email = $1`,
      [email]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      sub: row.sub,
      email: row.email,
      name: row.name || undefined,
      avatar_url: row.avatar_url || undefined,
      provider: row.provider,
      role: row.role,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /**
   * Create user session
   */
  async createSession(session: Omit<UserSession, 'id' | 'createdAt'>): Promise<UserSession> {
    const id = crypto.randomUUID();
    const createdAt = new Date();

    await this.insert({
      tableName: TABLE_SESSIONS as any,
      data: {
        id,
        user_id: session.userId,
        token_hash: session.tokenHash,
        expires_at: session.expiresAt,
        created_at: createdAt,
        ip_address: session.ipAddress || null,
        user_agent: session.userAgent || null,
      },
    });

    return {
      id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      createdAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_SESSIONS} WHERE id = $1`,
      [sessionId]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    };
  }

  /**
   * Get session by token hash
   */
  async getSessionByTokenHash(tokenHash: string): Promise<UserSession | null> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_SESSIONS} WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    };
  }

  /**
   * Invalidate (delete) a session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await this.delete({
      tableName: TABLE_SESSIONS as any,
      where: { id: sessionId },
    });
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    await this.delete({
      tableName: TABLE_SESSIONS as any,
      where: { user_id: userId },
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.query(
      `DELETE FROM ${TABLE_SESSIONS} WHERE expires_at < NOW() RETURNING id`
    );
    return result.length;
  }

  /**
   * Log audit event
   */
  async logAuditEvent(event: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const id = crypto.randomUUID();
    const createdAt = new Date();

    await this.insert({
      tableName: TABLE_AUDIT_LOG as any,
      data: {
        id,
        user_id: event.userId || null,
        action: event.action,
        resource: event.resource || null,
        details: event.details ? JSON.stringify(event.details) : null,
        ip_address: event.ipAddress || null,
        created_at: createdAt,
      },
    });

    return {
      id,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      details: event.details,
      ipAddress: event.ipAddress,
      createdAt,
    };
  }

  /**
   * Get audit logs for a user
   */
  async getAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_AUDIT_LOG} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource || undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      ipAddress: row.ip_address || undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get all audit logs (admin only)
   */
  async getAllAuditLogs(
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_AUDIT_LOG} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.map((row: any) => ({
      id: row.id,
      userId: row.user_id || undefined,
      action: row.action,
      resource: row.resource || undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      ipAddress: row.ip_address || undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get a specific audit log entry by ID
   */
  async getAuditLogById(logId: string): Promise<AuditLogEntry | null> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_AUDIT_LOG} WHERE id = $1`,
      [logId]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      userId: row.user_id || undefined,
      action: row.action,
      resource: row.resource || undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      ipAddress: row.ip_address || undefined,
      createdAt: new Date(row.created_at),
    };
  }


  /**
   * List all users with pagination
   */
  async listUsers(
    limit: number = 50,
    offset: number = 0,
    filters?: { role?: string; search?: string }
  ): Promise<{ users: any[]; total: number }> {
    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.role) {
      conditions.push(`role = $${params.length + 1}`);
      params.push(filters.role);
    }

    if (filters?.search) {
      conditions.push(`(email ILIKE $${params.length + 1} OR name ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    // Get total count
    const countResult = await this.query(
      `SELECT COUNT(*) as count FROM ${TABLE_USERS} ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0].count);

    // Get paginated users
    const usersResult = await this.query(
      `SELECT * FROM ${TABLE_USERS} ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const users = usersResult.map((row: any) => ({
      id: row.id,
      sub: row.sub,
      email: row.email,
      name: row.name || undefined,
      avatar_url: row.avatar_url || undefined,
      provider: row.provider,
      role: row.role,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));

    return { users, total };
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<any> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_USERS} WHERE id = $1`,
      [userId]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      sub: row.sub,
      email: row.email,
      name: row.name || undefined,
      avatar_url: row.avatar_url || undefined,
      provider: row.provider,
      role: row.role,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /**
   * Delete user by ID
   */
  async deleteUser(userId: string): Promise<void> {
    await this.delete({
      tableName: TABLE_USERS as any,
      where: { id: userId },
    });
  }

  /**
   * Get user sessions with pagination
   */
  async getUserSessions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ sessions: UserSession[]; total: number }> {
    // Get total count
    const countResult = await this.query(
      `SELECT COUNT(*) as count FROM ${TABLE_SESSIONS} WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(countResult[0].count);

    // Get sessions
    const result = await this.query(
      `SELECT * FROM ${TABLE_SESSIONS} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const sessions: UserSession[] = result.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));

    return { sessions, total };
  }

  /**
   * Create a refresh token
   */
  async createRefreshToken(token: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    familyId?: string;
  }): Promise<any> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.insert({
      tableName: TABLE_REFRESH_TOKENS as any,
      record: {
        id,
        user_id: token.userId,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt.toISOString(),
        ip_address: token.ipAddress || null,
        user_agent: token.userAgent || null,
        family_id: token.familyId || null,
        created_at: now.toISOString(),
      },
    });

    return {
      id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
      familyId: token.familyId,
      createdAt: now,
    };
  }

  /**
   * Get refresh token by hash
   */
  async getRefreshTokenByHash(tokenHash: string): Promise<any | null> {
    const result = await this.query(
      `SELECT * FROM ${TABLE_REFRESH_TOKENS} WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      familyId: row.family_id || undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Delete refresh token
   */
  async deleteRefreshToken(tokenId: string): Promise<void> {
    await this.query(
      `DELETE FROM ${TABLE_REFRESH_TOKENS} WHERE id = $1`,
      [tokenId]
    );
  }

  /**
   * Delete all refresh tokens for a user
   * If familyId is provided, only delete tokens in that family
   */
  async deleteAllRefreshTokens(userId: string, familyId?: string): Promise<number> {
    const params: any[] = [userId];
    let sql = `DELETE FROM ${TABLE_REFRESH_TOKENS} WHERE user_id = $1`;

    if (familyId) {
      sql += ` AND family_id = $2`;
      params.push(familyId);
    }

    const result = await this.query(sql, params);
    return result.rowCount || 0;
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    const result = await this.query(
      `DELETE FROM ${TABLE_REFRESH_TOKENS} WHERE expires_at < NOW()`
    );
    return result.rowCount || 0;
  }
}
