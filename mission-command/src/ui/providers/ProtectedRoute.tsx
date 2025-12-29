/**
 * Protected Route Component
 *
 * Wrapper component that protects routes requiring authentication.
 * Redirects to login if not authenticated, shows permissions warning
 * if role is insufficient.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { MissionCommandRole } from '@mastra/auth';

/**
 * Protected Route Props
 */
export interface ProtectedRouteProps {
  children: React.ReactElement;
  /**
   * Required role to access this route
   * If not specified, any authenticated user can access
   */
  requireRole?: MissionCommandRole | MissionCommandRole[];
  /**
   * Fallback path for unauthorized users
   */
  unauthorizedPath?: string;
}

/**
 * Protected Route Component
 *
 * Checks authentication and role before rendering children.
 * Redirects to login if not authenticated.
 * Shows permissions warning if role is insufficient.
 */
export function ProtectedRoute({
  children,
  requireRole,
  unauthorizedPath = '/unauthorized',
}: ProtectedRouteProps) {
  const { isAuthenticated, role, user } = useAuth();
  const location = useLocation();

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
  if (requireRole) {
    const requiredRoles = Array.isArray(requireRole) ? requireRole : [requireRole];

    if (!role || !requiredRoles.includes(role)) {
      // User doesn't have required role - show unauthorized page
      return (
        <Navigate
          to={unauthorizedPath}
          state={{
            reason: 'insufficient_role',
            required: requiredRoles,
            current: role,
          }}
          replace
        />
      );
    }
  }

  // User is authenticated and has required role
  return <>{children}</>;
}

/**
 * Unauthorized Page Component
 *
 * Shown when user tries to access a route without sufficient permissions.
 */
export function UnauthorizedPage() {
  const { user, role } = useAuth();
  const location = useLocation();
  const state = location.state as {
    reason?: string;
    required?: string[];
    current?: string;
  } | null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="mb-4 text-center">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Access Denied
        </h1>

        <p className="mb-4 text-center text-gray-600">
          {state?.reason === 'insufficient_role'
            ? `You don't have permission to access this page.`
            : `You are not authorized to access this page.`}
        </p>

        {user && (
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Your Information:</p>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Email:</span> {user.email || 'N/A'}
              </p>
              <p>
                <span className="font-medium">Role:</span>{' '}
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  {role || 'Unknown'}
                </span>
              </p>
            </div>

            {state?.required && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <p className="text-sm font-medium text-gray-700">Required Role(s):</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {state.required.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={() => (window.location.href = '/')}
            className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Go Home
          </button>
          <button
            onClick={() => window.history.back()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Login Page Component
 *
 * Simple login page with OAuth buttons.
 * In production, this would redirect to OAuth provider.
 */
export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const from = (location.state as any)?.from || '/';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Mission Command Centre
          </h1>
          <p className="text-gray-600">Sign in to access your missions</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => login('github')}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Continue with GitHub
          </button>

          <button
            onClick={() => login('google')}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>You will be redirected to authenticate</p>
          <p className="mt-1 text-xs text-gray-500">
            After login, you'll return to: {from}
          </p>
        </div>
      </div>
    </div>
  );
}
