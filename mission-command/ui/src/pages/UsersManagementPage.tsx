/**
 * Mission Command - User Management Page
 *
 * Admin-only page for managing users, roles, and sessions.
 * Features:
 * - List all users with pagination and filters
 * - Change user roles
 * - Delete users
 * - View user details
 * - Invalidate user sessions
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';

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

interface UserListResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
}

export function UsersManagementPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'operator' | 'viewer'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSessions, setUserSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });

      if (roleFilter !== 'all') {
        params.append('role', roleFilter);
      }

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data: UserListResponse = await response.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user sessions
  const fetchUserSessions = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setUserSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  // Change user role
  const changeRole = async (userId: string, newRole: 'admin' | 'operator' | 'viewer') => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to change role');
      }

      // Refresh user list
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      // Refresh user list
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Invalidate all user sessions
  const invalidateSessions = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/sessions`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to invalidate sessions');
      }

      alert('All sessions invalidated successfully');
      if (selectedUser?.id === userId) {
        await fetchUserSessions(userId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // View user sessions
  const viewSessions = async (user: User) => {
    setSelectedUser(user);
    setShowSessions(true);
    await fetchUserSessions(user.id);
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">User Management</h1>
        <button
          onClick={() => fetchUsers()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchUsers()}
              placeholder="Search by name or email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Filter
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setPage(0);
                fetchUsers();
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.avatar_url && (
                        <img
                          src={user.avatar_url}
                          alt={user.name || user.email}
                          className="h-10 w-10 rounded-full"
                        />
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || user.email}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => changeRole(user.id, e.target.value as any)}
                      disabled={user.id === currentUser?.sub}
                      className={`text-sm px-2 py-1 rounded ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'operator'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="operator">Operator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.provider}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => viewSessions(user)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Sessions
                    </button>
                    <button
                      onClick={() => invalidateSessions(user.id)}
                      className="text-orange-600 hover:text-orange-900 mr-4"
                    >
                      Invalidate
                    </button>
                    {user.id !== currentUser?.sub && (
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 bg-gray-100 rounded">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Modal */}
      {showSessions && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  Sessions for {selectedUser.name || selectedUser.email}
                </h2>
                <button
                  onClick={() => {
                    setShowSessions(false);
                    setSelectedUser(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {userSessions.length === 0 ? (
                <p className="text-gray-500">No active sessions</p>
              ) : (
                <div className="space-y-4">
                  {userSessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(session.created_at).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Expires:</span>{' '}
                          {new Date(session.expires_at).toLocaleString()}
                        </div>
                        {session.ip_address && (
                          <div>
                            <span className="font-medium">IP:</span> {session.ip_address}
                          </div>
                        )}
                        {session.user_agent && (
                          <div className="col-span-2">
                            <span className="font-medium">User Agent:</span>{' '}
                            <span className="break-all">{session.user_agent}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
