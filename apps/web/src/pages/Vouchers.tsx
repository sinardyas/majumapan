import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { voucherApi, type Voucher } from '@/services/voucher';
import { voucherApi as voucherApiService } from '@/services/voucher';
import { Button, Input } from '@pos/ui';
import { Gift, Search, Plus, Trash2, AlertCircle } from 'lucide-react';
import { VoucherRuleBuilder } from '@/components/pos/VoucherRuleBuilder';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

export default function Vouchers() {
  const { user } = useAuthStore();
  
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'GC' | 'PR'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'voided'>('all');
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const formatCurrency = (amount: number | string | undefined) => {
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await voucherApi.getCustomerVouchers(user?.id || '');
      if (response.success && response.data) {
        const vouchersData = Array.isArray(response.data) ? response.data : [];
        setVouchers(vouchersData);
      }
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadVouchers();
    setCategories([
      { id: 'cat-1', name: 'Beverages' },
      { id: 'cat-2', name: 'Food' },
      { id: 'cat-3', name: 'Snacks' },
    ]);
    setProducts([
      { id: 'prod-1', name: 'Coffee', sku: 'COF001' },
      { id: 'prod-2', name: 'Sandwich', sku: 'SAN001' },
      { id: 'prod-3', name: 'Cake', sku: 'CAK001' },
    ]);
  }, [loadVouchers]);

  const filteredVouchers = vouchers.filter((voucher) => {
    const matchesType = typeFilter === 'all' || voucher.type === typeFilter;
    const matchesSearch = !searchQuery ||
      voucher.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = Boolean(voucher.isActive && !voucher.isVoid && (!voucher.expiresAt || new Date(voucher.expiresAt) > new Date()));
    } else if (statusFilter === 'expired') {
      matchesStatus = Boolean(voucher.expiresAt && new Date(voucher.expiresAt) < new Date());
    } else if (statusFilter === 'voided') {
      matchesStatus = Boolean(voucher.isVoid);
    }
    
    return matchesType && matchesSearch && matchesStatus;
  });

  const handleVoidVoucher = async () => {
    if (!selectedVoucher) return;
    
    setVoiding(true);
    setVoidError(null);
    
    try {
      const response = await voucherApiService.voidVoucher(selectedVoucher.code, { reason: voidReason });
      if (response.success) {
        loadVouchers();
        setIsVoidModalOpen(false);
        setSelectedVoucher(null);
        setVoidReason('');
      } else {
        setVoidError(response.error || 'Failed to void voucher');
      }
    } catch (error) {
      setVoidError('An error occurred while voiding the voucher');
    } finally {
      setVoiding(false);
    }
  };

  const openVoidModal = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setIsVoidModalOpen(true);
  };

  const getStatusBadge = (voucher: Voucher) => {
    if (voucher.isVoid) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Voided</span>;
    }
    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Expired</span>;
    }
    if (!voucher.isActive) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Inactive</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>;
  };

  const getTypeBadge = (voucher: Voucher) => {
    if (voucher.type === 'GC') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Gift Card</span>;
    }
    const typeLabels: Record<string, string> = {
      PERCENTAGE: 'Percentage',
      FIXED: 'Fixed',
      FREE_ITEM: 'Free Item',
    };
    return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{typeLabels[voucher.discountType || ''] || 'Promo'}</span>;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gift className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold">Vouchers</h1>
            <p className="text-gray-500">Manage gift cards and promotional vouchers</p>
          </div>
        </div>
        <Button onClick={() => setIsRuleBuilderOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Voucher
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'GC' | 'PR')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Types</option>
          <option value="GC">Gift Cards</option>
          <option value="PR">Promotional</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'expired' | 'voided')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      {/* Vouchers Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading vouchers...</p>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Gift className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No vouchers found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Value/Balance</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Expires</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium">{voucher.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    {getTypeBadge(voucher)}
                  </td>
                  <td className="px-4 py-3">
                    {voucher.type === 'GC' ? (
                      <span className="font-medium">{formatCurrency(voucher.currentBalance)}</span>
                    ) : (
                      <span>
                        {voucher.discountType === 'PERCENTAGE' && `${voucher.percentageValue}% off`}
                        {voucher.discountType === 'FIXED' && formatCurrency(voucher.fixedValue)}
                        {voucher.discountType === 'FREE_ITEM' && 'Free Item'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(voucher)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {voucher.expiresAt ? formatDate(voucher.expiresAt) : 'No expiry'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!voucher.isVoid && voucher.isActive && (
                        <button
                          onClick={() => openVoidModal(voucher)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Void voucher"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rule Builder Modal */}
      <VoucherRuleBuilder
        isOpen={isRuleBuilderOpen}
        onClose={() => setIsRuleBuilderOpen(false)}
        onSuccess={(_voucher) => {
          loadVouchers();
          setIsRuleBuilderOpen(false);
        }}
        categories={categories}
        products={products}
      />

      {/* Void Confirmation Modal */}
      {isVoidModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsVoidModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold">Void Voucher</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to void voucher <span className="font-mono font-medium">{selectedVoucher.code}</span>?
              This action cannot be undone.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Enter reason for voiding..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
              />
            </div>
            
            {voidError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{voidError}</p>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsVoidModalOpen(false);
                  setSelectedVoucher(null);
                  setVoidReason('');
                  setVoidError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleVoidVoucher}
                isLoading={voiding}
              >
                Void Voucher
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
