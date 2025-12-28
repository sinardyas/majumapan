import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  storeId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface UserFormData {
  id?: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  pin: string;
}

const emptyFormData: UserFormData = {
  email: '',
  password: '',
  name: '',
  role: 'cashier',
  pin: '',
};

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<UserFormData>(emptyFormData);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!isOnline) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get<{ users: User[] }>('/users');
      
      if (response.success && response.data) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesSearch = !searchQuery ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handleOpenModal = (user?: User) => {
    if (user) {
      setFormData({
        id: user.id,
        email: user.email,
        password: '',
        name: user.name,
        role: user.role,
        pin: '',
      });
    } else {
      setFormData(emptyFormData);
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(emptyFormData);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      setFormError('You must be online to manage users');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      let response;
      
      if (formData.id) {
        // Update user
        const payload: Record<string, unknown> = {
          email: formData.email,
          name: formData.name,
          role: formData.role,
        };
        
        response = await api.put(`/users/${formData.id}`, payload);

        // Update password if provided
        if (formData.password && response.success) {
          await api.put(`/users/${formData.id}/password`, {
            password: formData.password,
          });
        }

        // Update PIN if provided
        if (formData.pin && response.success) {
          await api.put(`/users/${formData.id}/pin`, {
            pin: formData.pin,
          });
        }
      } else {
        // Create user
        if (!formData.password) {
          setFormError('Password is required for new users');
          setIsSubmitting(false);
          return;
        }

        response = await api.post('/users', {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          pin: formData.pin || undefined,
          storeId: currentUser?.storeId,
        });
      }

      if (response.success) {
        await loadData();
        handleCloseModal();
      } else {
        setFormError(response.error || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setFormError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    if (!isOnline) {
      alert('You must be online to modify users');
      return;
    }

    try {
      const response = await api.put(`/users/${userId}`, { isActive: !isActive });
      
      if (response.success) {
        await loadData();
      } else {
        alert(response.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('An error occurred');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-blue-100 text-blue-700';
      case 'cashier':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const canEditUser = (user: User) => {
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'manager' && user.role !== 'admin') return true;
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <svg className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <p className="text-lg font-medium">You're offline</p>
          <p className="mt-2">User management requires an internet connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage your team members</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-lg font-semibold text-primary-600">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          {user.id === currentUser?.id && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {canEditUser(user) && user.id !== currentUser?.id && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(user)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user.id, user.isActive)}
                            className={user.isActive ? 'text-yellow-600' : 'text-green-600'}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {formData.id ? 'Edit User' : 'Add User'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="label">
                  Password {formData.id ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="input w-full"
                  required={!formData.id}
                  minLength={6}
                />
              </div>

              <div>
                <label className="label">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserFormData['role'] }))}
                  className="input w-full"
                  required
                >
                  {currentUser?.role === 'admin' && (
                    <option value="admin">Admin</option>
                  )}
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                </select>
              </div>

              <div>
                <label className="label">
                  PIN (6 digits) {formData.id ? '(leave blank to keep current)' : ''}
                </label>
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData(prev => ({ ...prev, pin: value }));
                  }}
                  className="input w-full"
                  maxLength={6}
                  pattern="\d{6}"
                  placeholder="000000"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {formData.id ? 'Update User' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
