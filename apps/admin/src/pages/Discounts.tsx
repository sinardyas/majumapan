import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db, type LocalDiscount } from '@/db';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { formatCurrency } from '@pos/shared';

interface DiscountFormData {
  id?: string;
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountScope: 'product' | 'cart';
  value: string;
  minPurchaseAmount: string;
  maxDiscountAmount: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
}

const emptyFormData: DiscountFormData = {
  code: '',
  name: '',
  description: '',
  discountType: 'percentage',
  discountScope: 'cart',
  value: '',
  minPurchaseAmount: '',
  maxDiscountAmount: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
};

export default function Discounts() {
  const { user } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  const { fullSync } = useSyncStore();
  
  const [discounts, setDiscounts] = useState<LocalDiscount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DiscountFormData>(emptyFormData);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [user?.storeId]);

  const loadData = async () => {
    if (!user?.storeId) {
      setIsLoading(false);
      return;
    }

    try {
      const discs = await db.discounts
        .where({ storeId: user.storeId })
        .toArray();
      setDiscounts(discs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDiscounts = discounts.filter((discount) => {
    const matchesScope = scopeFilter === 'all' || discount.discountScope === scopeFilter;
    const matchesSearch = !searchQuery ||
      discount.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discount.code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesScope && matchesSearch;
  });

  const handleOpenModal = (discount?: LocalDiscount) => {
    if (discount) {
      setFormData({
        id: discount.id,
        code: discount.code || '',
        name: discount.name,
        description: discount.description || '',
        discountType: discount.discountType,
        discountScope: discount.discountScope,
        value: discount.value.toString(),
        minPurchaseAmount: discount.minPurchaseAmount?.toString() || '',
        maxDiscountAmount: discount.maxDiscountAmount?.toString() || '',
        startDate: discount.startDate ? discount.startDate.slice(0, 16) : '',
        endDate: discount.endDate ? discount.endDate.slice(0, 16) : '',
        usageLimit: discount.usageLimit?.toString() || '',
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
      setFormError('You must be online to modify discounts');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        code: formData.code || undefined,
        name: formData.name,
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountScope: formData.discountScope,
        value: parseFloat(formData.value),
        minPurchaseAmount: formData.minPurchaseAmount ? parseFloat(formData.minPurchaseAmount) : undefined,
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
      };

      let response;
      if (formData.id) {
        response = await api.put(`/discounts/${formData.id}`, payload);
      } else {
        response = await api.post('/discounts', payload);
      }

      if (response.success) {
        await fullSync();
        await loadData();
        handleCloseModal();
      } else {
        setFormError(response.error || 'Failed to save discount');
      }
    } catch (error) {
      console.error('Error saving discount:', error);
      setFormError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (discountId: string) => {
    if (!isOnline) {
      alert('You must be online to delete discounts');
      return;
    }

    if (!confirm('Are you sure you want to delete this discount?')) {
      return;
    }

    try {
      const response = await api.delete(`/discounts/${discountId}`);
      
      if (response.success) {
        await fullSync();
        await loadData();
      } else {
        alert(response.error || 'Failed to delete discount');
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      alert('An error occurred');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isDiscountActive = (discount: LocalDiscount) => {
    if (!discount.isActive) return false;
    const now = new Date();
    if (discount.startDate && new Date(discount.startDate) > now) return false;
    if (discount.endDate && new Date(discount.endDate) < now) return false;
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) return false;
    return true;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show message for admin users without a store assigned
  if (!user?.storeId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-md">
          <svg className="h-16 w-16 text-amber-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Store Assigned</h2>
          <p className="text-gray-600 mb-4">
            Your admin account is not assigned to a specific store. 
            Please use the store selector feature (coming soon) or contact the system administrator.
          </p>
          <p className="text-sm text-amber-600">
            Tip: Login with a manager or cashier account to access store data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
          <p className="text-gray-600">Manage your discount codes and promotions</p>
        </div>
        <Button onClick={() => handleOpenModal()} disabled={!isOnline}>
          Add Discount
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search discounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="input"
        >
          <option value="all">All Types</option>
          <option value="cart">Cart Discounts</option>
          <option value="product">Product Discounts</option>
        </select>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filteredDiscounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No discounts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Discount</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">Valid Period</th>
                  <th className="px-6 py-3 font-medium">Usage</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDiscounts.map((discount) => (
                  <tr key={discount.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{discount.name}</p>
                        {discount.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {discount.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {discount.code ? (
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                          {discount.code}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        discount.discountScope === 'cart'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {discount.discountScope}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {discount.discountType === 'percentage'
                        ? `${discount.value}%`
                        : formatCurrency(discount.value)
                      }
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>
                        <p>{formatDate(discount.startDate)}</p>
                        <p className="text-gray-400">to</p>
                        <p>{formatDate(discount.endDate)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {discount.usageLimit ? (
                        <span>
                          {discount.usageCount} / {discount.usageLimit}
                        </span>
                      ) : (
                        <span>{discount.usageCount} uses</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isDiscountActive(discount)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {isDiscountActive(discount) ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(discount)}
                          disabled={!isOnline}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(discount.id)}
                          disabled={!isOnline}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {formData.id ? 'Edit Discount' : 'Add Discount'}
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

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="label">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="input w-full font-mono"
                    placeholder="SAVE10"
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Scope *</label>
                  <select
                    value={formData.discountScope}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountScope: e.target.value as 'product' | 'cart' }))}
                    className="input w-full"
                    required
                  >
                    <option value="cart">Cart</option>
                    <option value="product">Product</option>
                  </select>
                </div>
                <div>
                  <label className="label">Type *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}
                    className="input w-full"
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="label">Value *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                    className="input w-full"
                    placeholder={formData.discountType === 'percentage' ? '10' : '5.00'}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min Purchase Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minPurchaseAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, minPurchaseAmount: e.target.value }))}
                    className="input w-full"
                    placeholder="50.00"
                  />
                </div>
                <div>
                  <label className="label">Max Discount Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxDiscountAmount: e.target.value }))}
                    className="input w-full"
                    placeholder="20.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="label">Usage Limit</label>
                <input
                  type="number"
                  min="0"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, usageLimit: e.target.value }))}
                  className="input w-full"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {formData.id ? 'Update Discount' : 'Create Discount'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
