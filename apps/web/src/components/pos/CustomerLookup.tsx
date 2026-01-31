import { useState, useCallback } from 'react';
import { Button, Input } from '@pos/ui';
import { Search, X, User, Users, Gift } from 'lucide-react';
import { customerApi, type Customer } from '@/services/customer';
import type { Voucher } from '@/services/voucher';

interface CustomerLookupProps {
  onCustomerSelect: (customer: Customer) => void;
  onVoucherSelect: (voucher: Voucher) => void;
  onSkip: () => void;
}

interface CustomerWithVouchers extends Customer {
  vouchers?: Voucher[];
}

export function CustomerLookup({ onCustomerSelect, onVoucherSelect, onSkip }: CustomerLookupProps) {
  const [phone, setPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [customer, setCustomer] = useState<CustomerWithVouchers | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [showVouchers, setShowVouchers] = useState(false);

  const formatCurrency = (amount: string | number | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'IDR',
    }).format(num);
  };

  const handleSearch = useCallback(async () => {
    if (!phone.trim()) return;

    setIsSearching(true);
    setNotFound(false);
    setIsCreating(false);
    setCustomer(null);

    try {
      const response = await customerApi.getByPhone(phone.trim());
      
      if (response.success && response.data) {
        setCustomer(response.data);
        
        // Load customer vouchers
        const vouchersResponse = await customerApi.getVouchers(response.data.id);
        if (vouchersResponse.success && vouchersResponse.data) {
          setCustomer(prev => prev ? { ...prev, vouchers: vouchersResponse.data } : null);
        }
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Error searching customer:', err);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  }, [phone]);

  const handleCreateCustomer = async () => {
    if (!phone.trim()) return;

    setIsCreating(true);
    try {
      const response = await customerApi.create({
        phone: phone.trim(),
        name: newCustomerName || undefined,
        email: newCustomerEmail || undefined,
      });

      if (response.success && response.data) {
        setCustomer(response.data);
        setNotFound(false);
        setIsCreating(false);
      } else {
        // Phone might already exist, try searching again
        handleSearch();
      }
    } catch (err) {
      console.error('Error creating customer:', err);
      setIsCreating(false);
    }
  };

  const handleSelectCustomer = () => {
    if (customer) {
      onCustomerSelect(customer);
    }
  };

  const handleApplyVoucher = (voucher: Voucher) => {
    onVoucherSelect(voucher);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Lookup
          </h3>
          <button onClick={onSkip} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Search Section */}
          {!customer && !notFound && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-3456-7890"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                    autoFocus
                  />
                  <Button onClick={handleSearch} isLoading={isSearching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isCreating && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 mb-3">
                    Customer not found. Create new customer?
                  </p>
                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Customer name (optional)"
                    />
                    <Input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="Email (optional)"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsCreating(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={handleCreateCustomer} isLoading={isCreating} className="flex-1">
                        Create & Apply
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 text-center">
                <Button variant="outline" onClick={onSkip}>
                  Skip (No Customer)
                </Button>
              </div>
            </>
          )}

          {/* Not Found Section */}
          {notFound && !customer && (
            <>
              <div className="text-center py-6">
                <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 mb-4">Customer not found</p>
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(true)}
                  className="mb-4"
                >
                  Create New Customer
                </Button>
                <div>
                  <Button variant="ghost" onClick={onSkip}>
                    Skip
                  </Button>
                </div>
              </div>

              {isCreating && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 mb-3">
                    Create new customer for {phone}
                  </p>
                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Customer name (optional)"
                    />
                    <Input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="Email (optional)"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsCreating(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={handleCreateCustomer} isLoading={isCreating} className="flex-1">
                        Create
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Customer Found Section */}
          {customer && (
            <>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-lg">
                      {customer.name || 'Customer'}
                    </p>
                    <p className="text-gray-600">{customer.phone}</p>
                    {customer.group && (
                      <span className={`inline-flex mt-2 px-2 py-1 rounded-full text-xs font-medium ${getGroupBadgeClass(customer.group.name)}`}>
                        {customer.group.name}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p>{customer.visitCount} visits</p>
                    <p className="font-medium">{formatCurrency(customer.totalSpend)} spent</p>
                  </div>
                </div>
              </div>

              {/* Vouchers Section */}
              {customer.vouchers && customer.vouchers.length > 0 && (
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowVouchers(!showVouchers)}
                    className="w-full justify-between mb-2"
                  >
                    <span className="flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      Customer's Vouchers ({customer.vouchers.length})
                    </span>
                    <span>{showVouchers ? '▲' : '▼'}</span>
                  </Button>
                  
                  {showVouchers && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customer.vouchers.map((voucher) => (
                        <div
                          key={voucher.id}
                          className="p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 cursor-pointer"
                          onClick={() => handleApplyVoucher(voucher)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono font-medium text-primary-600">
                                {voucher.code}
                              </p>
                              <p className="text-sm text-gray-600">
                                {voucher.type === 'GC' 
                                  ? `Balance: ${formatCurrency(voucher.currentBalance)}`
                                  : voucher.discountType === 'PERCENTAGE'
                                    ? `${voucher.percentageValue}% OFF`
                                    : `${formatCurrency(voucher.fixedValue)} OFF`
                                }
                              </p>
                            </div>
                            <Button size="sm" variant="outline">
                              Apply
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={onSkip} className="flex-1">
                  Skip
                </Button>
                <Button onClick={handleSelectCustomer} className="flex-1">
                  Apply Customer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
