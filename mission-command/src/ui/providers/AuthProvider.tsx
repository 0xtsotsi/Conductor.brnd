/**
 * Mission Command Auth Provider
 *
 * Provides authentication and role-based access control (RBAC) context
 * to all Mission Command UI components.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { MissionCommandRole, MissionCommandUser } from '@mastra/auth';

/**
 * Authentication context interface
 */
export interface AuthContextValue {
  /**
   * Authenticated user object (null if not authenticated)
   */
  user: MissionCommandUser | null;

  /**
   * User's role in Mission Command Centre
   */
  role: MissionCommandRole | null;

  /**
   * Whether user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Login function - initiates OAuth flow
   */
  login: (provider?: 'github' | 'google' | 'keycloak') => void;

  /**
   * Logout function - clears JWT and redirects
   */
  logout: () => void;

  /**
   * Refresh user data from JWT
   */
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth Provider Props
 */
export interface AuthProviderProps {
  children: ReactNode;
  /**
   * API base URL for auth endpoints
   */
  apiUrl?: string;
  /**
   * Login URL - where to redirect for login
   */
  loginUrl?: string;
  /**
   * Logout URL - where to redirect for logout
   */
  logoutUrl?: string;
}

/**
 * JWT payload structure
 */
interface JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  role: MissionCommandRole;
  permissions?: string[];
  exp?: number;
  iat?: number;
}

/**
 * Parse JWT token without verification (client-side only)
 * Verification happens server-side
 */
function parseJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}

/**
 * Get JWT from localStorage or cookie
 */
function getJWT(): string | null {
  // Try localStorage first
  const token = localStorage.getItem('mastra_jwt');
  if (token) return token;

  // Try cookie
  const match = document.cookie.match(/(^|;)\\s*mastra_jwt\\s*=\\s*([^;]+)/);
  return match ? match[2] : null;
}

/**
 * Check if JWT is expired
 */
function isJWTExpired(payload: JWTPayload): boolean {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Mission Command Auth Provider
 *
 * Wraps the application and provides authentication context.
 * Extracts and parses JWT from localStorage/cookie to get user role.
 */
export function AuthProvider({ children, apiUrl = '/api', loginUrl = '/api/auth/login', logoutUrl = '/api/auth/logout' }: AuthProviderProps) {
  const [user, setUser] = useState<MissionCommandUser | null>(null);
  const [role, setRole] = useState<MissionCommandRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /**
   * Refresh user data from current JWT
   */
  const refresh = () => {
    const token = getJWT();

    if (!token) {
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);
      return;
    }

    const payload = parseJWT(token);

    if (!payload) {
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);
      return;
    }

    // Check expiration
    if (isJWTExpired(payload)) {
      // Token expired, clear it
      localStorage.removeItem('mastra_jwt');
      document.cookie = 'mastra_jwt=; path=/; max-age=0';
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);
      return;
    }

    // Set user and role
    const userObj: MissionCommandUser = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'viewer',
      permissions: payload.permissions as any,
    };

    setUser(userObj);
    setRole(userObj.role);
    setIsAuthenticated(true);
  };

  /**
   * Initialize auth on mount
   */
  useEffect(() => {
    refresh();

    // Listen for storage changes (e.g., login from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mastra_jwt') {
        refresh();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Login - redirect to OAuth provider
   */
  const login = (provider?: 'github' | 'google' | 'keycloak') => {
    const redirectUrl = window.location.pathname + window.location.search;
    const loginParams = new URLSearchParams({
      redirect_uri: redirectUrl,
      ...(provider && { provider }),
    });
    window.location.href = `${loginUrl}?${loginParams.toString()}`;
  };

  /**
   * Logout - clear JWT and redirect
   */
  const logout = async () => {
    try {
      // Call logout endpoint to invalidate server-side session
      await fetch(logoutUrl, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('mastra_jwt');
      document.cookie = 'mastra_jwt=; path=/; max-age=0';

      // Clear state
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);

      // Redirect to home
      window.location.href = '/';
    }
  };

  const value: AuthContextValue = {
    user,
    role,
    isAuthenticated,
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth hook
 *
 * Access authentication context from any component.
 * Throws error if used outside AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
