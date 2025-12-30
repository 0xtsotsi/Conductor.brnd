/**
 * Mission Command - Role Assignment Modal Component
 *
 * Modal for changing a user's role.
 * Features:
 * - Role selection with descriptions
 * - Confirmation of role change
 * - Warning about permission changes
 */

import { useState } from 'react';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface RoleAssignmentModalProps {
  isOpen: boolean;
  userName: string;
  userEmail: string;
  currentRole: UserRole;
  onConfirm: (newRole: UserRole) => Promise<void>;
  onCancel: () => void;
}

const roleDescriptions: Record<
  UserRole,
  { title: string; description: string; permissions: string[]; color: string }
> = {
  admin: {
    title: 'Admin',
    description: 'Full administrative access',
    permissions: [
      'Manage all users',
      'Create and edit workflows',
      'Execute workflows',
      'Approve/reject requests',
      'View audit logs',
      'Manage system settings',
    ],
    color: 'purple',
  },
  operator: {
    title: 'Operator',
    description: 'Can execute and manage workflows',
    permissions: [
      'View workflows',
      'Create and edit workflows',
      'Execute workflows',
      'Approve/reject requests',
      'View mission runs',
    ],
    color: 'blue',
  },
  viewer: {
    title: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'View workflows',
      'View mission runs',
      'View profile',
    ],
    color: 'gray',
  },
};

export function RoleAssignmentModal({
  isOpen,
  userName,
  userEmail,
  currentRole,
  onConfirm,
  onCancel,
}: RoleAssignmentModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (selectedRole === currentRole) {
      onCancel();
      return;
    }

    setConfirming(true);
    try {
      await onConfirm(selectedRole);
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const getRoleBadgeClass = (role: UserRole) => {
    const color = roleDescriptions[role].color;
    const colorClasses: Record<string, string> = {
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colorClasses[color];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-mastra-bg-2 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-mastra-el-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-mastra-el-border">
          <h2 className="text-xl font-bold text-mastra-el-text">
            Change User Role
          </h2>
        </div>

        <div className="p-6">
          {/* User Info */}
          <div className="mb-6 p-4 bg-mastra-bg-1 border border-mastra-el-border rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-mastra-el-text-muted">User</p>
                <p className="font-medium text-mastra-el-text">{userName}</p>
                <p className="text-sm text-mastra-el-text-muted">{userEmail}</p>
              </div>
              <div>
                <p className="text-sm text-mastra-el-text-muted mb-1">
                  Current Role
                </p>
                <span
                  className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full border ${getRoleBadgeClass(
                    currentRole
                  )}`}
                >
                  {roleDescriptions[currentRole].title}
                </span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <svg
                className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Important: Role changes affect permissions immediately
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  The user will gain or lose access to features based on the new role.
                  This action will be logged in the audit trail.
                </p>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-mastra-el-text mb-4">
              Select New Role
            </p>

            {(Object.keys(roleDescriptions) as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-4 border-2 rounded-md transition-all ${
                  selectedRole === role
                    ? 'border-mastra-el-accent bg-mastra-el-1'
                    : 'border-mastra-el-border bg-mastra-bg-1 hover:border-mastra-el-accent/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="role"
                        checked={selectedRole === role}
                        onChange={() => setSelectedRole(role)}
                        className="h-4 w-4 text-mastra-el-accent focus:ring-mastra-el-accent"
                      />
                      <span className="font-medium text-mastra-el-text">
                        {roleDescriptions[role].title}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getRoleBadgeClass(
                          role
                        )}`}
                      >
                        {role}
                      </span>
                    </div>
                    <p className="text-sm text-mastra-el-text-muted mb-2">
                      {roleDescriptions[role].description}
                    </p>
                    <ul className="text-xs text-mastra-el-text-muted space-y-1">
                      {roleDescriptions[role].permissions.map((permission) => (
                        <li key={permission} className="flex items-start">
                          <svg
                            className="w-4 h-4 mr-1 text-green-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-mastra-el-border">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="px-4 py-2 bg-mastra-bg-1 border border-mastra-el-border text-mastra-el-text rounded-md hover:bg-mastra-el-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming || selectedRole === currentRole}
              className="px-4 py-2 bg-mastra-el-accent text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming
                ? 'Changing Role...'
                : selectedRole === currentRole
                ? 'Select a Different Role'
                : 'Change Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
