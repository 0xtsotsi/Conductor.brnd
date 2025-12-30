/**
 * Mission Command - User Deactivate/Reactivate Modal Component
 *
 * Modal for confirming user deactivation or reactivation.
 * Features:
 * - Clear explanation of what deactivation means
 * - Warning about consequences
 * - Confirmation for both deactivation and reactivation
 */

import { useState } from 'react';

export interface UserDeactivateModalProps {
  isOpen: boolean;
  mode: 'deactivate' | 'reactivate';
  userName: string;
  userEmail: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function UserDeactivateModal({
  isOpen,
  mode,
  userName,
  userEmail,
  onConfirm,
  onCancel,
}: UserDeactivateModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!confirmed && mode === 'deactivate') {
      return;
    }

    setProcessing(true);
    try {
      await onConfirm();
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const isDeactivation = mode === 'deactivate';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-mastra-bg-2 rounded-lg shadow-xl max-w-lg w-full border border-mastra-el-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-mastra-el-border">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isDeactivation
                  ? 'bg-orange-100'
                  : 'bg-green-100'
              }`}
            >
              {isDeactivation ? (
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-mastra-el-text">
                {isDeactivation ? 'Deactivate User' : 'Reactivate User'}
              </h2>
              <p className="text-sm text-mastra-el-text-muted">
                {isDeactivation
                  ? 'This action will prevent the user from logging in'
                  : 'This action will restore user access'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* User Info */}
          <div className="mb-6 p-4 bg-mastra-bg-1 border border-mastra-el-border rounded-md">
            <p className="text-sm text-mastra-el-text-muted mb-1">User</p>
            <p className="font-medium text-mastra-el-text">{userName}</p>
            <p className="text-sm text-mastra-el-text-muted">{userEmail}</p>
          </div>

          {/* Deactivation Info */}
          {isDeactivation ? (
            <>
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-md">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0"
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
                    <p className="text-sm font-medium text-orange-800 mb-2">
                      What happens when you deactivate a user?
                    </p>
                    <ul className="text-sm text-orange-700 space-y-1">
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-orange-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        User will not be able to log in
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-orange-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        All active sessions will be invalidated
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-orange-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        User data will be preserved
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-orange-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        User can be reactivated at any time
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="mb-6">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-mastra-el-border rounded mt-1"
                  />
                  <span className="ml-2 text-sm text-mastra-el-text">
                    I understand that deactivating this user will immediately revoke
                    their access to the system
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-green-400 mr-2 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      What happens when you reactivate a user?
                    </p>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-green-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        User will be able to log in again
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-green-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        User's previous role and permissions will be restored
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-4 h-4 mr-1 text-green-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        User data and history remain intact
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-mastra-el-border">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 bg-mastra-bg-1 border border-mastra-el-border text-mastra-el-text rounded-md hover:bg-mastra-el-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={processing || (isDeactivation && !confirmed)}
              className={`px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDeactivation
                  ? 'bg-orange-600'
                  : 'bg-green-600'
              }`}
            >
              {processing
                ? isDeactivation
                  ? 'Deactivating...'
                  : 'Reactivating...'
                : isDeactivation
                ? 'Deactivate User'
                : 'Reactivate User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
