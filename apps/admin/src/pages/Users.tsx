import { useState } from 'react';
import { useToast } from '@pos/ui';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { Modal } from '@pos/ui';
import { Input } from '@pos/ui';
import { Select } from '@pos/ui';
import type { User } from '@pos/shared';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filters, setFilters] = useState({
    role: '',
    storeId: '',
  });
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'manager' as 'admin' | 'manager' | 'cashier',
    storeId: '',
    password: '',
    isActive: true,
  });
  const { success, error, addToast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<User[]>('/users');
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        error('Error', 'Failed to load users');
      }
    } catch {
      error('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (filters.role && user.role !== filters.role) return false;
    if (filters.storeId && user.storeId !== filters.storeId) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingUser) {
        const response = await api.put<User>(`/users/${editingUser.id}`, formData);
        if (response.success) {
          success('Success', 'User updated successfully');
          await fetchUsers();
          setShowModal(false);
          setEditingUser(null);
        } else {
          error('Error', response.error || 'Failed to update user');
        }
      } else {
        const response = await api.post<User>('/users', formData);
        if (response.success) {
          success('Success', 'User created successfully');
          await fetchUsers();
          setShowModal(false);
        } else {
          error('Error', response.error || 'Failed to create user');
        }
      }
    } catch {
      error('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      storeId: user.storeId || '',
      password: '',
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    
    setIsLoading(true);
    try {
      const response = await api.delete(`/users/${id}`);
      if (response.success) {
        success('Success', 'User deactivated successfully');
        await fetchUsers();
      } else {
        error('Error', response.error || 'Failed to deactivate user');
      }
    } catch {
      error('Error', 'Failed to deactivate user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingUser(null);
    setFilters({ role: '', storeId: '' });
    setFormData({
      email: '',
      name: '',
      role: 'manager',
      storeId: '',
      password: '',
      isActive: true,
    });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={() => setShowModal(true)}>New User</Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="label">Role</label>
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            className="select w-40"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
          </select>
        </div>

        <div>
          <label className="label">Store</label>
          <select
            value={filters.storeId}
            onChange={(e) => setFilters({ ...filters, storeId: e.target.value })}
            className="select w-64"
          >
            <option value="">All Stores</option>
            {Array.from(new Set(users.map(u => u.storeId).filter(Boolean))).map(storeId => (
              <option key={storeId} value={storeId}>{storeId}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && users.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-gray-500">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {user.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.storeId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(user.id)}>
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCancel}
        title={editingUser ? 'Edit User' : 'New User'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="user@example.com"
                required
                disabled={!!editingUser}
              />
            </div>

            <div>
              <label className="label">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Enter user name"
                required
              />
            </div>

            <div>
              <label className="label">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'cashier' })}
                className="select"
                required
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>

            <div>
              <label className="label">Store</label>
              <select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                className="select"
              >
                <option value="">None</option>
                {Array.from(new Set(users.map(u => u.storeId).filter(Boolean))).map(storeId => (
                  <option key={storeId} value={storeId}>{storeId}</option>
                ))}
              </select>
            </div>

            {formData.role !== 'cashier' && (
              <div>
                <label className="label">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  placeholder={editingUser ? 'Leave empty to keep current password' : 'Enter password'}
                  required={!editingUser}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
