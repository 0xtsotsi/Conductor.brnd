import { Navigate } from 'react-router-dom';
import { useAuth, useUserRole } from '../providers/AuthProvider';
import { MissionCommandRole } from '@mastra/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: MissionCommandRole;
  fallback?: React.ReactNode;
}

/**
 * Protected Route Component
 *
 * Wraps routes that require authentication.
 * Optionally checks for specific role requirements.
 *
 * @example
 * <Route path="/admin" element={
 *   <ProtectedRoute requiredRole="admin">
 *     <AdminPanel />
 *   </ProtectedRoute>
 * } />
 */
export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const userRole = useUserRole();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-mastra-el-text-muted">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role requirements
  if (requiredRole && userRole) {
    const roleHierarchy: Record<MissionCommandRole, number> = {
      admin: 3,
      operator: 2,
      viewer: 1,
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      // User doesn't have required role
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-mastra-el-error mb-4">
              Access Denied
            </h1>
            <p className="text-mastra-el-text-muted">
              You need {requiredRole} role to access this page.
            </p>
            <p className="text-mastra-el-text-muted mt-2">
              Your current role: {userRole}
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
