import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MissionCommandUser, MissionCommandRole } from '@mastra/auth';

/**
 * Authentication context for Mission Command Centre
 *
 * Manages JWT-based authentication with role-based access control (RBAC).
 * Stores JWT in localStorage and provides user info throughout the app.
 */

interface AuthContextType {
  user: MissionCommandUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'mission_command_jwt';
const API_URL = import.meta.env.VITE_MASTRA_API_URL || '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MissionCommandUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from JWT on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        // Decode JWT payload (without verification - that's server-side)
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Ensure role exists (default to viewer)
        if (!payload.role) {
          payload.role = 'viewer';
        }

        setUser(payload as MissionCommandUser);
      } catch (error) {
        console.error('Failed to decode JWT:', error);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);

      // Decode JWT to get user info
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.role) {
        payload.role = 'viewer';
      }

      setUser(payload as MissionCommandUser);
    } catch (error) {
      console.error('Failed to decode JWT during login:', error);
      throw new Error('Invalid token');
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Helper to get the current user's role
 */
export function useUserRole(): MissionCommandRole | null {
  const { user } = useAuth();
  return user?.role ?? null;
}

/**
 * Helper to check if current user has a specific role
 */
export function useHasRole(requiredRole: MissionCommandRole): boolean {
  const { user } = useAuth();
  if (!user) return false;

  // Role hierarchy: admin > operator > viewer
  const roleHierarchy: Record<MissionCommandRole, number> = {
    admin: 3,
    operator: 2,
    viewer: 1,
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}
