import { Navigate, useLocation } from 'react-router-dom';
import { MissionCommandRole } from '@mastra/auth';
import { useAuth } from '../providers/AuthProvider';

/**
 * Protected Route Props
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Minimum role required to access this route
   * If not specified, any authenticated user can access
   */
  requiredRole?: MissionCommandRole;
  /**
   * Array of roles that can access this route
   * Use this for more complex role requirements
   */
  allowedRoles?: MissionCommandRole[];
}

/**
 * Role hierarchy (higher number = more permissions)
 */
const ROLE_HIERARCHY: Record<MissionCommandRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

/**
 * Check if user's role meets the minimum required role
 */
function hasRequiredRole(
  userRole: MissionCommandRole,
  requiredRole: MissionCommandRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user's role is in the allowed roles list
 */
function hasAllowedRole(
  userRole: MissionCommandRole,
  allowedRoles: MissionCommandRole[]
): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Protected Route Component
 *
 * Wraps routes that require authentication.
 * Redirects to login if user is not authenticated.
 * Shows permissions warning if user lacks required role.
 */
export function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mastra-el-accent mx-auto mb-4"></div>
          <p className="text-mastra-el-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Check role requirements
  if (requiredRole && role && !hasRequiredRole(role, requiredRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-mastra-el-text mb-2">
            Insufficient Permissions
          </h1>
          <p className="text-mastra-el-text-muted mb-6">
            You need <span className="font-mono text-sm bg-mastra-el-3 px-2 py-1 rounded">{requiredRole}</span> role or higher to access this page.
            Your current role: <span className="font-mono text-sm bg-mastra-el-3 px-2 py-1 rounded">{role}</span>
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-mastra-el-3 text-mastra-el-text rounded-md hover:bg-mastra-el-3/80"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && role && !hasAllowedRole(role, allowedRoles)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-mastra-el-text mb-2">
            Access Denied
          </h1>
          <p className="text-mastra-el-text-muted mb-6">
            This page is restricted to specific roles. Your current role: <span className="font-mono text-sm bg-mastra-el-3 px-2 py-1 rounded">{role}</span>
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-mastra-el-3 text-mastra-el-text rounded-md hover:bg-mastra-el-3/80"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // User is authenticated and has required role
  return <>{children}</>;
}
