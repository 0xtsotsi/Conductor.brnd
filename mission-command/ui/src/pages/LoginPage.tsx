import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';

/**
 * Login Page
 *
 * OAuth2 login flow with role-based redirects
 * For now, provides a simple development login
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // For development: Create a mock JWT token
      // In production, this would call the OAuth endpoint
      const mockPayload = {
        sub: email,
        email: email,
        name: email.split('@')[0],
        role: email.includes('admin') ? 'admin' : 'operator',
      };

      // Create a mock JWT (for development only!)
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(mockPayload));
      const signature = 'mock-signature';
      const token = `${header}.${payload}.${signature}`;

      login(token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    // In production, redirect to OAuth provider
    const oauthUrl = `/api/auth/${provider}?redirect=${encodeURIComponent(redirectTo)}`;
    window.location.href = oauthUrl;
  };

  return (
    <div className="min-h-screen bg-mastra-bg-1 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-mastra-el-6">Mission Command Centre</h1>
          <p className="mt-2 text-mastra-el-3">Sign in to access your workflows</p>
        </div>

        {/* Login Form */}
        <div className="bg-mastra-bg-2 border border-mastra-border-1 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/20 border border-red-700 text-red-300 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Development Mode Notice */}
            <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-300 px-4 py-3 rounded text-sm">
              <strong>Development Mode:</strong> Use any email/password.
              <br />
              Emails containing "admin" get admin role.
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-mastra-el-4 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-mastra-bg-3 border border-mastra-border-1 rounded-md text-mastra-el-6 placeholder-mastra-el-2 focus:outline-none focus:ring-2 focus:ring-mastra-bg-7"
                placeholder="admin@example.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-mastra-el-4 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-mastra-bg-3 border border-mastra-border-1 rounded-md text-mastra-el-6 placeholder-mastra-el-2 focus:outline-none focus:ring-2 focus:ring-mastra-bg-7"
                placeholder="••••••••"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-mastra-bg-7 text-white rounded-md hover:bg-mastra-bg-7/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* OAuth Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-mastra-border-1"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-mastra-bg-2 text-mastra-el-3">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('github')}
              className="w-full px-4 py-2 bg-mastra-bg-3 border border-mastra-border-1 text-mastra-el-4 rounded-md hover:bg-mastra-bg-4 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full px-4 py-2 bg-mastra-bg-3 border border-mastra-border-1 text-mastra-el-4 rounded-md hover:bg-mastra-bg-4 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-mastra-el-3">
          Protected by Mission Command RBAC
        </p>
      </div>
    </div>
  );
}
