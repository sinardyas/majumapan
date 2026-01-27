import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { voucherApi, type Voucher } from '@/services/voucher';
import { Button } from '@pos/ui';
import { Gift, Search, X, AlertTriangle } from 'lucide-react';

export default function CustomerVouchers() {
  const { user } = useAuthStore();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'voided'>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    loadVouchers();
  }, [user?.storeId]);

  const loadVouchers = async () => {
    if (!user?.storeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await voucherApi.getCustomerVouchers(user.storeId);
      if (response.success && response.data?.data) {
        setVouchers(response.data.data);
      }
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredVouchers = vouchers.filter(voucher => {
    const matchesSearch = voucher.code.toLowerCase().includes(searchQuery.toLowerCase());
    const expired = isExpired(voucher.expiresAt);
    
    if (filter === 'active') return matchesSearch && !expired && !voucher.isVoid;
    if (filter === 'expired') return matchesSearch && expired;
    if (filter === 'voided') return matchesSearch && voucher.isVoid;
    return matchesSearch;
  });

  const getVoucherValue = (voucher: Voucher) => {
    if (voucher.type === 'GC' && voucher.currentBalance) {
      return formatCurrency(Number(voucher.currentBalance));
    }
    if (voucher.discountType === 'PERCENTAGE' && voucher.percentageValue) {
      return `${voucher.percentageValue}% OFF`;
    }
    if (voucher.discountType === 'FIXED' && voucher.fixedValue) {
      return formatCurrency(Number(voucher.fixedValue));
    }
    if (voucher.discountType === 'FREE_ITEM') {
      return 'Free Item';
    }
    return '-';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Vouchers</h1>
          <p className="text-gray-600">View and manage customer gift cards and vouchers</p>
        </div>
        <Button onClick={() => loadVouchers()}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="input py-2"
        >
          <option value="all">All Vouchers</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filteredVouchers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Gift className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p>No vouchers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">Expires</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono font-medium">{voucher.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        voucher.type === 'GC'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {voucher.type === 'GC' ? 'Gift Card' : 'Promo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {getVoucherValue(voucher)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {voucher.expiresAt ? formatDateTime(voucher.expiresAt) : 'No expiration'}
                    </td>
                    <td className="px-6 py-4">
                      {voucher.isVoid ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Voided
                        </span>
                      ) : isExpired(voucher.expiresAt) ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedVoucher(voucher)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Voucher Details
              </h3>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Voucher Code</p>
                <p className="text-2xl font-mono font-bold text-primary-600">
                  {selectedVoucher.code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium">
                    {selectedVoucher.type === 'GC' ? 'Gift Card' : 'Promotional'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Value</p>
                  <p className="font-medium">{getVoucherValue(selectedVoucher)}</p>
                </div>
              </div>

              {selectedVoucher.type === 'GC' && selectedVoucher.currentBalance && (
                <div className="p-4 bg-primary-50 rounded-lg text-center">
                  <p className="text-sm text-primary-600">Current Balance</p>
                  <p className="text-3xl font-bold text-primary-700">
                    {formatCurrency(Number(selectedVoucher.currentBalance))}
                  </p>
                </div>
              )}

              {selectedVoucher.discountType && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Discount Details</p>
                  <p className="font-medium">
                    {selectedVoucher.discountType === 'PERCENTAGE'
                      ? `${selectedVoucher.percentageValue}% off`
                      : selectedVoucher.discountType === 'FIXED'
                      ? `${formatCurrency(Number(selectedVoucher.fixedValue))} off`
                      : 'Free Item'}
                  </p>
                  {selectedVoucher.scope && (
                    <p className="text-sm text-gray-500">
                      Scope: {selectedVoucher.scope.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  )}
                </div>
              )}

              {selectedVoucher.minPurchase && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Min Purchase</span>
                  <span>{formatCurrency(Number(selectedVoucher.minPurchase))}</span>
                </div>
              )}

              {selectedVoucher.maxDiscount && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Max Discount</span>
                  <span>{formatCurrency(Number(selectedVoucher.maxDiscount))}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created</span>
                <span>{formatDateTime(selectedVoucher.createdAt)}</span>
              </div>

              {selectedVoucher.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expires</span>
                  <span className={isExpired(selectedVoucher.expiresAt) ? 'text-red-600' : ''}>
                    {formatDateTime(selectedVoucher.expiresAt)}
                  </span>
                </div>
              )}

              {selectedVoucher.isVoid && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">This voucher has been voided</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedVoucher(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
