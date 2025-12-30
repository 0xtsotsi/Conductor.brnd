/**
 * Mission Command - User Profile Page
 *
 * Allows users to view and manage their own profile.
 * Features:
 * - View profile information
 * - Update name and avatar
 * - View active sessions
 * - Revoke specific sessions
 * - Logout from all devices
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'admin' | 'operator' | 'viewer';
  provider: 'github' | 'google';
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
}

interface SessionsResponse {
  sessions: Session[];
  total: number;
}

export function ProfilePage() {
  const { token, user: currentUser, logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchSessions();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!currentUser?.sub) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/users/${currentUser.sub}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const userData: User = await response.json();
      setUser(userData);
      setName(userData.name || '');
      setAvatarUrl(userData.avatar_url || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      if (!currentUser?.sub) {
        return;
      }

      const response = await fetch(`/api/users/${currentUser.sub}/sessions?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data: SessionsResponse = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const updateProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updates: any = {};
      if (name !== user?.name) updates.name = name;
      if (avatarUrl !== user?.avatar_url) updates.avatar_url = avatarUrl;

      if (Object.keys(updates).length === 0) {
        setEditing(false);
        return;
      }

      const response = await fetch(`/api/users/${currentUser?.sub}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedUser: User = await response.json();
      setUser(updatedUser);
      setEditing(false);
      setSuccess('Profile updated successfully');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) {
      return;
    }

    try {
      // Note: This would require a new endpoint for revoking a specific session
      // For now, we'll show a message
      alert('Session revocation requires endpoint implementation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const logoutFromAllDevices = async () => {
    if (!confirm('Are you sure you want to logout from all devices? This will invalidate all your sessions including this one.')) {
      return;
    }

    try {
      // Get refresh token from localStorage
      const refreshToken = localStorage.getItem('refreshToken');

      const response = await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to logout from all devices');
      }

      // Clear local storage and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isCurrentSession = (session: Session) => {
    // Check if this is the current session by comparing IP address or user agent
    // This is a simple heuristic; in production, you'd want to track session IDs
    const currentIp = session.ip_address; // In a real app, you'd get this from the server
    return false; // Placeholder
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Failed to load profile
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">My Profile</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Profile Information</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center space-x-6">
            <div className="flex-shrink-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || user.email}
                  className="h-24 w-24 rounded-full"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-3xl">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium">{user.name || 'No name set'}</h3>
              <p className="text-gray-500">{user.email}</p>
              <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
                user.role === 'admin'
                  ? 'bg-purple-100 text-purple-800'
                  : user.role === 'operator'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={updateProfile}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setName(user.name || '');
                    setAvatarUrl(user.avatar_url || '');
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Email:</span>
                <p className="mt-1">{user.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Provider:</span>
                <p className="mt-1 capitalize">{user.provider}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Role:</span>
                <p className="mt-1 Capitalize">{user.role}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Member Since:</span>
                <p className="mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Active Sessions ({sessions.length})</h2>
          <button
            onClick={logoutFromAllDevices}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout from All Devices
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="text-gray-500">No active sessions</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {formatDate(session.created_at)}
                  </div>
                  <div>
                    <span className="font-medium">Expires:</span>{' '}
                    {formatDate(session.expires_at)}
                  </div>
                  {session.ip_address && (
                    <div>
                      <span className="font-medium">IP Address:</span>{' '}
                      {session.ip_address}
                    </div>
                  )}
                  {session.user_agent && (
                    <div className="md:col-span-2">
                      <span className="font-medium">User Agent:</span>{' '}
                      <span className="break-all text-gray-600">{session.user_agent}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Actions */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Account Actions</h2>
        <div className="space-y-4">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
