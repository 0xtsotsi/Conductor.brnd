/**
 * Mission Command - User Form Modal Component
 *
 * Modal for creating or editing a user.
 * Features:
 * - Form validation
 * - Edit existing user or create new user
 * - Role selection
 * - Avatar URL input
 */

import { useState, useEffect } from 'react';

export interface UserFormData {
  email: string;
  name: string;
  avatar_url?: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
}

export interface UserFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<UserFormData>;
  onSave: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
}

export function UserFormModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onCancel,
}: UserFormModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    name: '',
    avatar_url: '',
    role: 'viewer',
    is_active: true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        email: initialData.email || '',
        name: initialData.name || '',
        avatar_url: initialData.avatar_url || '',
        role: initialData.role || 'viewer',
        is_active: initialData.is_active ?? true,
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UserFormData, string>> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    // Name validation
    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    }));

    // Clear error for this field
    if (errors[name as keyof UserFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-mastra-bg-2 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-mastra-el-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-mastra-el-border">
          <h2 className="text-xl font-bold text-mastra-el-text">
            {mode === 'create' ? 'Create New User' : 'Edit User'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={mode === 'edit'}
              className={`w-full px-3 py-2 bg-mastra-bg-1 border rounded-md text-mastra-el-text focus:outline-none focus:ring-2 focus:ring-mastra-el-accent disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.email
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-mastra-el-border'
              }`}
              placeholder="user@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-mastra-bg-1 border rounded-md text-mastra-el-text focus:outline-none focus:ring-2 focus:ring-mastra-el-accent ${
                errors.name
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-mastra-el-border'
              }`}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              Avatar URL (Optional)
            </label>
            <input
              type="url"
              name="avatar_url"
              value={formData.avatar_url || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-border rounded-md text-mastra-el-text focus:outline-none focus:ring-2 focus:ring-mastra-el-accent"
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-mastra-el-text mb-2">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-mastra-bg-1 border rounded-md text-mastra-el-text focus:outline-none focus:ring-2 focus:ring-mastra-el-accent ${
                errors.role
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-mastra-el-border'
              }`}
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="operator">Operator - Can execute workflows</option>
              <option value="admin">Admin - Full administrative access</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role}</p>
            )}
          </div>

          {/* Active Status (only for edit mode) */}
          {mode === 'edit' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                id="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-mastra-el-accent focus:ring-mastra-el-accent border-mastra-el-border rounded"
              />
              <label
                htmlFor="is_active"
                className="ml-2 block text-sm text-mastra-el-text"
              >
                User is active (can login)
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-mastra-el-border">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 bg-mastra-bg-1 border border-mastra-el-border text-mastra-el-text rounded-md hover:bg-mastra-el-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-mastra-el-accent text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
