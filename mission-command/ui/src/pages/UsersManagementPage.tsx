/**
 * Mission Command - User Management Page
 *
 * Admin-only page for managing users, roles, and sessions.
 * Features:
 * - List all users with pagination and filters
 * - Create new users
 * - Edit user information
 * - Change user roles
 * - Deactivate/reactivate users
 * - Delete users
 * - View user sessions
 * - Invalidate user sessions
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { UserListPage, type User } from './users/UserListPage';
import { UserFormModal, type UserFormData } from './users/UserFormModal';
import { RoleAssignmentModal } from './users/RoleAssignmentModal';
import { UserDeactivateModal } from './users/UserDeactivateModal';
import { UserDeleteModal } from './users/UserDeleteModal';

interface UserListResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

type ModalType = 'edit' | 'role' | 'deactivate' | 'delete' | null;

export function UsersManagementPage() {
  const { token, user: currentUser } = useAuth();
  const API_URL = import.meta.env.VITE_MASTRA_API_URL || '';

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'operator' | 'viewer'>('all');

  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, search]);

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

      const response = await fetch(`${API_URL}/api/users?${params}`, {
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

  // Open create user modal
  const handleCreateUser = () => {
    setSelectedUser(null);
    setActiveModal('edit');
  };

  // Open edit user modal
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setActiveModal('edit');
  };

  // Save user (create or update)
  const handleSaveUser = async (formData: UserFormData) => {
    const isEdit = selectedUser !== null;
    const url = isEdit
      ? `${API_URL}/api/users/${selectedUser!.id}`
      : `${API_URL}/api/users`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save user');
      }

      await fetchUsers();
      closeModal();
    } catch (err) {
      throw err; // Re-throw to let modal handle error display
    }
  };

  // Open role change modal
  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setActiveModal('role');
  };

  // Confirm role change
  const handleConfirmRoleChange = async (newRole: 'admin' | 'operator' | 'viewer') => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
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

      await fetchUsers();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  // Open deactivate/reactivate modal
  const handleDeactivateUser = (user: User) => {
    setSelectedUser(user);
    setActiveModal('deactivate');
  };

  // Confirm deactivation/reactivation
  const handleConfirmDeactivation = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !selectedUser.is_active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      await fetchUsers();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  // Open delete user modal
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setActiveModal('delete');
  };

  // Confirm deletion
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      await fetchUsers();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Close modal
  const closeModal = () => {
    setActiveModal(null);
    setSelectedUser(null);
  };

  // View user details (placeholder - could expand to show detail modal)
  const handleViewUser = (user: User) => {
    // For now, just open edit modal
    handleEditUser(user);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <UserListPage
        users={users}
        total={total}
        page={page}
        limit={limit}
        loading={loading}
        error={error}
        search={search}
        roleFilter={roleFilter}
        onPageChange={setPage}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        onRoleFilterChange={(value) => {
          setRoleFilter(value);
          setPage(0);
        }}
        onRefresh={fetchUsers}
        onViewUser={handleViewUser}
        onEditUser={handleEditUser}
        onChangeRole={handleChangeRole}
        onDeactivateUser={handleDeactivateUser}
        onDeleteUser={handleDeleteUser}
      />

      {/* User Form Modal (Create/Edit) */}
      {activeModal === 'edit' && (
        <UserFormModal
          isOpen={true}
          mode={selectedUser ? 'edit' : 'create'}
          initialData={selectedUser || undefined}
          onSave={handleSaveUser}
          onCancel={closeModal}
        />
      )}

      {/* Role Assignment Modal */}
      {activeModal === 'role' && selectedUser && (
        <RoleAssignmentModal
          isOpen={true}
          userName={selectedUser.name || 'No name'}
          userEmail={selectedUser.email}
          currentRole={selectedUser.role}
          onConfirm={handleConfirmRoleChange}
          onCancel={closeModal}
        />
      )}

      {/* Deactivate/Reactivate Modal */}
      {activeModal === 'deactivate' && selectedUser && (
        <UserDeactivateModal
          isOpen={true}
          mode={selectedUser.is_active ? 'deactivate' : 'reactivate'}
          userName={selectedUser.name || 'No name'}
          userEmail={selectedUser.email}
          onConfirm={handleConfirmDeactivation}
          onCancel={closeModal}
        />
      )}

      {/* Delete Modal */}
      {activeModal === 'delete' && selectedUser && (
        <UserDeleteModal
          isOpen={true}
          userName={selectedUser.name || 'No name'}
          userEmail={selectedUser.email}
          onConfirm={handleConfirmDelete}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}

