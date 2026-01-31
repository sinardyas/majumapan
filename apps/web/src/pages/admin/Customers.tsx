import { useState, useEffect, useCallback } from 'react';
import { Button, Input } from '@pos/ui';
import { Search, Plus, Trash2, Edit, Users, X } from 'lucide-react';
import { customerApi, type Customer, type CustomerGroup } from '@/services/customer';
import { useToast } from '@pos/ui';

interface CustomerFormData {
  phone: string;
  name: string;
  email: string;
}

export default function Customers() {
  const { success, error: showError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({ phone: '', name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  const formatCurrency = (amount: string | number | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'IDR',
    }).format(num);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const loadGroups = useCallback(async () => {
    const response = await customerApi.getGroups();
    if (response.success && response.data) {
      setGroups(response.data);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await customerApi.list({
        search: searchQuery || undefined,
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });
      
      if (response.success && response.data) {
        setCustomers(response.data);
        if (response.pagination && response.pagination.total !== undefined) {
          setPagination(prev => ({ ...prev, total: response.pagination!.total }));
        }
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      showError('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, groupFilter, pagination.limit, pagination.offset, showError]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let response;
      if (editingCustomer) {
        response = await customerApi.update(editingCustomer.id, {
          name: formData.name || undefined,
          email: formData.email || undefined,
        });
      } else {
        response = await customerApi.create({
          phone: formData.phone,
          name: formData.name || undefined,
          email: formData.email || undefined,
        });
      }

      if (response.success) {
        success(editingCustomer ? 'Customer updated' : 'Customer created');
        closeForm();
        loadCustomers();
      } else {
        showError(response.error || 'Failed to save customer');
      }
    } catch (err) {
      console.error('Error saving customer:', err);
      showError('Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    try {
      const response = await customerApi.delete(customerToDelete.id);
      if (response.success) {
        success('Customer deleted');
        setShowDeleteConfirm(false);
        setCustomerToDelete(null);
        loadCustomers();
      } else {
        showError(response.error || 'Failed to delete customer');
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
      showError('Failed to delete customer');
    }
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      phone: customer.phone,
      name: customer.name || '',
      email: customer.email || '',
    });
    setIsFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingCustomer(null);
    setFormData({ phone: '', name: '', email: '' });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
    setFormData({ phone: '', name: '', email: '' });
  };

  const getGroupBadgeClass = (groupName?: string) => {
    switch (groupName?.toLowerCase()) {
      case 'vip': return 'bg-purple-100 text-purple-700';
      case 'gold': return 'bg-yellow-100 text-yellow-700';
      case 'silver': return 'bg-gray-200 text-gray-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Customers
          </h1>
          <p className="text-gray-600">{pagination.total} customers registered</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by phone or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="input py-2 w-48"
        >
          <option value="all">All Groups</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No customers found</p>
          <Button variant="outline" className="mt-4" onClick={openCreateForm}>
            Add First Customer
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Group</th>
                <th className="px-6 py-3 font-medium">Total Spend</th>
                <th className="px-6 py-3 font-medium">Visits</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono">{customer.phone}</td>
                  <td className="px-6 py-4">{customer.name || '-'}</td>
                  <td className="px-6 py-4">
                    {customer.group ? (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getGroupBadgeClass(customer.group.name)}`}>
                        {customer.group.name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">{formatCurrency(customer.totalSpend)}</td>
                  <td className="px-6 py-4">{customer.visitCount}</td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(customer.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditForm(customer)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomerToDelete(customer);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingCustomer ? 'Edit Customer' : 'New Customer'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812-3456-7890"
                    disabled={!!editingCustomer}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Delete Customer?</h3>
              <p className="text-gray-600">
                Are you sure you want to delete {customerToDelete.name || customerToDelete.phone}?
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
