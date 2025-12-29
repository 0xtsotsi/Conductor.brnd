import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MissionCommandRole, MissionCommandUser } from '@mastra/auth';

interface AuthContextType {
  user: MissionCommandUser | null;
  role: MissionCommandRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider for Mission Command Centre
 *
 * Manages JWT authentication and RBAC role state
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<MissionCommandUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const token = localStorage.getItem('mastra_auth_token');
        if (token) {
          // Decode JWT payload (without verification for UI display)
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            role: payload.role || 'viewer',
          });
        }
      } catch (error) {
        console.error('Failed to load user from token:', error);
        localStorage.removeItem('mastra_auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = (token: string) => {
    try {
      localStorage.setItem('mastra_auth_token', token);
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role || 'viewer',
      });
    } catch (error) {
      console.error('Failed to login:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('mastra_auth_token');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    role: user?.role || 'viewer',
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
