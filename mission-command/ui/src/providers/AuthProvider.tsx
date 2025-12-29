import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MissionCommandRole, MissionCommandUser } from '@mastra/auth';

/**
 * Authentication context type
 */
interface AuthContextType {
  user: MissionCommandUser | null;
  role: MissionCommandRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

/**
 * Auth Provider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * JWT token payload structure
 */
interface JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  role: MissionCommandRole;
  permissions?: string[];
  exp?: number;
}

/**
 * Parse JWT token and extract payload
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
    console.error('Failed to parse JWT token:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Get JWT token from localStorage or cookie
 */
function getStoredToken(): string | null {
  // Try localStorage first
  const localStorageToken = localStorage.getItem('mastra_auth_token');
  if (localStorageToken) {
    return localStorageToken;
  }

  // Try cookie
  const match = document.cookie.match(/(?:^|;) ?mastra_auth_token=([^;]*)(?:;|$)/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Authentication Provider
 *
 * Manages JWT token-based authentication with role-based access control.
 * Extracts user information and role from JWT token payload.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<MissionCommandUser | null>(null);
  const [role, setRole] = useState<MissionCommandRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize auth state from stored token on mount
   */
  useEffect(() => {
    const token = getStoredToken();
    if (token && !isTokenExpired(token)) {
      const payload = parseJWT(token);
      if (payload) {
        const missionUser: MissionCommandUser = {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role || 'viewer',
          permissions: payload.permissions as any,
        };
        setUser(missionUser);
        setRole(missionUser.role);
      }
    }
    setIsLoading(false);
  }, []);

  /**
   * Login with JWT token
   * Stores token and extracts user information
   */
  const login = (token: string) => {
    // Store token in localStorage
    localStorage.setItem('mastra_auth_token', token);

    // Also set as cookie for server-side auth
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 days
    document.cookie = `mastra_auth_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

    // Parse and set user
    const payload = parseJWT(token);
    if (payload) {
      const missionUser: MissionCommandUser = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role || 'viewer',
        permissions: payload.permissions as any,
      };
      setUser(missionUser);
      setRole(missionUser.role);
    }
  };

  /**
   * Logout and clear stored token
   */
  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('mastra_auth_token');

    // Clear cookie
    document.cookie = 'mastra_auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Clear state
    setUser(null);
    setRole(null);
  };

  const value: AuthContextType = {
    user,
    role,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
