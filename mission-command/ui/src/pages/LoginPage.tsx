import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MissionCommandRole } from '@mastra/auth';
import { useAuth } from '../providers/AuthProvider';

/**
 * OAuth provider type
 */
type OAuthProvider = 'github' | 'google' | 'keycloak';

/**
 * OAuth provider configuration
 */
interface OAuthProviderConfig {
  name: string;
  icon: string;
  color: string;
}

const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  github: {
    name: 'GitHub',
    icon: '🐙',
    color: 'bg-gray-800 hover:bg-gray-900',
  },
  google: {
    name: 'Google',
    icon: '🔵',
    color: 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300',
  },
  keycloak: {
    name: 'Keycloak',
    icon: '🔑',
    color: 'bg-orange-600 hover:bg-orange-700',
  },
};

/**
 * Login Page Component
 *
 * Provides OAuth2 login buttons for authentication.
 * After successful login, stores JWT token and redirects to dashboard.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get redirect path from location state or default to home
  const from = (location.state as any)?.from || '/';

  /**
   * Handle OAuth login
   * In a real implementation, this would redirect to the OAuth provider's authorization URL
   */
  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement actual OAuth flow
      // For now, this is a placeholder that simulates a successful login
      //
      // Real implementation should:
      // 1. Redirect to OAuth provider's authorization URL
      // 2. Handle the callback with authorization code
      // 3. Exchange code for JWT token with backend
      // 4. Store token and redirect

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock successful login with a fake JWT token
      // In production, this would come from your OAuth callback endpoint
      const mockToken = generateMockJWT('user-123', 'admin', 'admin@example.com');

      login(mockToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Generate a mock JWT token for demo purposes
   * In production, this would come from your backend OAuth callback
   */
  function generateMockJWT(
    sub: string,
    role: MissionCommandRole,
    email: string
  ): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub,
        email,
        name: email.split('@')[0],
        role,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      })
    );
    const signature = 'mock-signature';
    return `${header}.${payload}.${signature}`;
  }

  return (
    <div className="min-h-screen bg-mastra-bg-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Login Card */}
        <div className="bg-mastra-bg-2 border border-mastra-el-border rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🚀</div>
            <h1 className="text-2xl font-bold text-mastra-el-text mb-2">
              Mission Command Centre
            </h1>
            <p className="text-mastra-el-text-muted">
              Sign in to access your workflows
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* OAuth Login Buttons */}
          <div className="space-y-3">
            {(Object.keys(OAUTH_PROVIDERS) as OAuthProvider[]).map(provider => {
              const config = OAUTH_PROVIDERS[provider];
              return (
                <button
                  key={provider}
                  onClick={() => handleOAuthLogin(provider)}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-md font-medium transition-colors ${config.color} ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span className="text-xl">{config.icon}</span>
                  <span>
                    {isLoading ? 'Signing in...' : `Sign in with ${config.name}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dev Login (for testing) */}
          <div className="mt-6 pt-6 border-t border-mastra-el-border">
            <p className="text-xs text-center text-mastra-el-text-muted mb-3">
              Quick login for testing (development only)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'operator', 'viewer'] as MissionCommandRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => {
                    const token = generateMockJWT(`user-${role}`, role, `${role}@example.com`);
                    login(token);
                    navigate(from, { replace: true });
                  }}
                  disabled={isLoading}
                  className="px-3 py-2 text-sm bg-mastra-el-3 hover:bg-mastra-el-3/80 text-mastra-el-text rounded-md transition-colors disabled:opacity-50"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-mastra-el-text-muted">
              By signing in, you agree to the Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
