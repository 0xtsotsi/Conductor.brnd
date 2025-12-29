/**
 * Mission Command User Storage
 *
 * Provides storage for Mission Command users.
 * Uses LibSQL (SQLite) for development, supports PostgreSQL for production.
 */

import type { OAuthStorage } from './oauth-handler';

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
 * Database migration SQL for creating users table
 */
export const CREATE_USERS_TABLE_SQL = `
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
`;

/**
 * Run database migration to create users table
 */
export async function runUserMigration(db: any) {
  await db.execute(CREATE_USERS_TABLE_SQL);
}
