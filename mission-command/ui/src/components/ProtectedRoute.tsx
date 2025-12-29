import { Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import type { MissionCommandRole } from '@mastra/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: MissionCommandRole;
}

/**
 * Protected Route Component
 *
 * Checks authentication and role before rendering children
 * Redirects to login if not authenticated
 * Shows permissions warning if insufficient role
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-mastra-bg-1">
        <div className="text-mastra-el-4">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role requirements if specified
  if (requiredRole) {
    const roleHierarchy: Record<MissionCommandRole, number> = {
      viewer: 1,
      operator: 2,
      admin: 3,
    };

    if (roleHierarchy[role] < roleHierarchy[requiredRole]) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-mastra-bg-1">
          <div className="max-w-md p-6 bg-mastra-bg-2 border border-mastra-border-1 rounded-lg">
            <h1 className="text-xl font-bold text-mastra-el-6 mb-4">Insufficient Permissions</h1>
            <p className="text-mastra-el-3">
              You need {requiredRole} or higher role to access this page.
            </p>
            <p className="text-mastra-el-3 mt-2">
              Your current role: <span className="font-semibold">{role}</span>
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
