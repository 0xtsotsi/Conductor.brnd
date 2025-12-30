import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';

/**
 * Auth Callback Page
 *
 * Handles OAuth callback after successful authentication.
 * Extracts JWT token from URL query params and stores it.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/';
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
      return;
    }

    if (token) {
      try {
        login(token);
        navigate(redirect, { replace: true });
      } catch (err) {
        setError('Failed to process authentication token');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    } else {
      setError('No authentication token found');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen bg-mastra-bg-1 flex items-center justify-center">
      {error ? (
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-mastra-el-error mb-2">
            Authentication Error
          </h1>
          <p className="text-mastra-el-text-muted">{error}</p>
          <p className="text-sm text-mastra-el-text-muted mt-4">
            Redirecting to login page...
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mastra-el-accent mx-auto mb-4"></div>
          <p className="text-mastra-el-text-muted">Completing sign in...</p>
        </div>
      )}
    </div>
  );
}
