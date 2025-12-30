/**
 * Mission Command - User List Page Component
 *
 * Displays a paginated, filterable table of users.
 * Features:
 * - Search by name or email
 * - Filter by role
 * - Pagination
 * - User actions (view, edit, deactivate, delete)
 * - Role badges with color coding
 */

import { useState } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'admin' | 'operator' | 'viewer';
  provider: 'github' | 'google';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserListPageProps {
  users: User[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
  search: string;
  roleFilter: 'all' | 'admin' | 'operator' | 'viewer';
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onRoleFilterChange: (role: 'all' | 'admin' | 'operator' | 'viewer') => void;
  onRefresh: () => void;
  onViewUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onChangeRole: (user: User) => void;
  onDeactivateUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export function UserListPage({
  users,
  total,
  page,
  limit,
  loading,
  error,
  search,
  roleFilter,
  onPageChange,
  onSearchChange,
  onRoleFilterChange,
  onRefresh,
  onViewUser,
  onEditUser,
  onChangeRole,
  onDeactivateUser,
  onDeleteUser,
}: UserListPageProps) {
  const totalPages = Math.ceil(total / limit);

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'operator':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProviderBadgeClass = (provider: string) => {
    switch (provider) {
      case 'github':
        return 'bg-gray-800 text-white border-gray-700';
      case 'google':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="user-list-page">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-mastra-el-text">User Management</h1>
          <p className="text-sm text-mastra-el-text-muted">
            Manage users, roles, and permissions
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-mastra-el-1 text-mastra-el-text border border-mastra-el-border rounded-md hover:bg-mastra-el-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-mastra-bg-2 border border-mastra-el-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or email"
              className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-border rounded-md text-mastra-el-text placeholder:text-mastra-el-text-muted focus:outline-none focus:ring-2 focus:ring-mastra-el-accent"
            />
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => onRoleFilterChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-border rounded-md text-mastra-el-text focus:outline-none focus:ring-2 focus:ring-mastra-el-accent"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* Results Info */}
          <div className="flex items-end">
            <div className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-border rounded-md text-mastra-el-text-muted text-sm">
              {total} user{total !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-mastra-bg-2 border border-mastra-el-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mastra-el-accent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-mastra-el-text-muted mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-mastra-el-text-muted">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-mastra-el-border">
                <thead className="bg-mastra-bg-1">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-mastra-el-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-mastra-bg-2 divide-y divide-mastra-el-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-mastra-bg-1">
                      {/* User Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.name || user.email}
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-mastra-el-3 flex items-center justify-center">
                              <span className="text-sm font-medium text-mastra-el-text">
                                {(user.name || user.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-mastra-el-text">
                              {user.name || 'No name'}
                            </div>
                            <div className="text-sm text-mastra-el-text-muted">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadgeClass(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Provider */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getProviderBadgeClass(
                            user.provider
                          )}`}
                        >
                          {user.provider}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                            user.is_active
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-mastra-el-text-muted">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onViewUser(user)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                            title="View details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => onEditUser(user)}
                            className="text-green-600 hover:text-green-800 font-medium"
                            title="Edit user"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onChangeRole(user)}
                            className="text-purple-600 hover:text-purple-800 font-medium"
                            title="Change role"
                          >
                            Role
                          </button>
                          <button
                            onClick={() => onDeactivateUser(user)}
                            className={`font-medium ${
                              user.is_active
                                ? 'text-orange-600 hover:text-orange-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                            title={user.is_active ? 'Deactivate user' : 'Reactivate user'}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => onDeleteUser(user)}
                            className="text-red-600 hover:text-red-800 font-medium"
                            title="Delete user"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-mastra-bg-1 px-6 py-4 border-t border-mastra-el-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-mastra-el-text-muted">
                    Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of{' '}
                    {total} users
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onPageChange(page - 1)}
                      disabled={page === 0}
                      className="px-3 py-1 bg-mastra-bg-2 border border-mastra-el-border rounded hover:bg-mastra-el-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 bg-mastra-bg-2 border border-mastra-el-border rounded text-sm">
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => onPageChange(page + 1)}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 bg-mastra-bg-2 border border-mastra-el-border rounded hover:bg-mastra-el-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
