/**
 * Mission Command - User Delete Modal Component
 *
 * Modal for confirming permanent user deletion.
 * Features:
 * - Strong warning about permanent action
 * - User must type confirmation
 * - Clear explanation of what will be deleted
 * - Cannot be undone
 */

import { useState } from 'react';

export interface UserDeleteModalProps {
  isOpen: boolean;
  userName: string;
  userEmail: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function UserDeleteModal({
  isOpen,
  userName,
  userEmail,
  onConfirm,
  onCancel,
}: UserDeleteModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (confirmationText !== userEmail) {
      return;
    }

    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const isConfirmed = confirmationText === userEmail;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-mastra-bg-2 rounded-lg shadow-xl max-w-lg w-full border border-red-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
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
            <div>
              <h2 className="text-xl font-bold text-red-900">Delete User</h2>
              <p className="text-sm text-red-700">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* User Info */}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700 mb-1">You are about to delete:</p>
            <p className="font-medium text-red-900">{userName}</p>
            <p className="text-sm text-red-700">{userEmail}</p>
          </div>

          {/* Warning */}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg
                className="w-5 h-5 text-red-500 mr-2 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-2">
                  Warning: This action is permanent
                </p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-1 text-red-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    All user data will be permanently deleted
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-1 text-red-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    User audit history will be preserved
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-1 text-red-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Active sessions will be invalidated
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-1 text-red-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    This action cannot be undone
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              To confirm deletion, type the user's email address:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={userEmail}
              className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-border rounded-md text-mastra-el-text focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="mt-2 text-xs text-mastra-el-text-muted">
              Type: <span className="font-mono font-medium">{userEmail}</span>
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-mastra-el-border">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="px-4 py-2 bg-mastra-bg-1 border border-mastra-el-border text-mastra-el-text rounded-md hover:bg-mastra-el-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleting || !isConfirmed}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete User Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
