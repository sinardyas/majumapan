import { useState } from 'react';
import { customerApi } from '@/services/customer';
import { Button, Input } from '@pos/ui';
import type { Customer } from '@/types/customer';
import { Search, User, X, CreditCard } from 'lucide-react';

interface CustomerLookupProps {
  onCustomerSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
  onViewVouchers: () => void;
}

export function CustomerLookup({
  onCustomerSelect,
  selectedCustomer,
  onViewVouchers,
}: CustomerLookupProps) {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateOption, setShowCreateOption] = useState(false);

  const handleSearch = async () => {
    if (!phone.trim()) return;

    setIsLoading(true);
    setError(null);
    setShowCreateOption(false);

    try {
      const response = await customerApi.getByPhone(phone.trim());
      
      if (response.success && response.data) {
        onCustomerSelect(response.data);
        setPhone('');
      } else {
        setError('Customer not found');
        setShowCreateOption(true);
      }
    } catch (err) {
      setError('Failed to search customer');
      setShowCreateOption(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCustomer = () => {
    onCustomerSelect(null);
  };

  const handleSkip = () => {
    onCustomerSelect(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (selectedCustomer) {
    return (
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {selectedCustomer.name || 'Customer'}
              </div>
              <div className="text-sm text-gray-500">
                {selectedCustomer.phone} • {selectedCustomer.group?.name || 'No Group'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {selectedCustomer.visitCount} visits • Rp {Number(selectedCustomer.totalSpend).toLocaleString('id-ID')} total
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onViewVouchers}>
              <CreditCard className="h-4 w-4 mr-1" />
              View Vouchers
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearCustomer}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm font-medium text-gray-700 mb-3">
        Customer (Optional)
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            placeholder="Enter phone number..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10"
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        <Button onClick={handleSearch} isLoading={isLoading}>
          Search
        </Button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-700 mb-2">{error}</div>
          
          {showCreateOption && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Open create customer modal - for now just create with phone
                  customerApi.create({ phone: phone.trim() })
                    .then((response) => {
                      if (response.success && response.data) {
                        onCustomerSelect(response.data);
                        setPhone('');
                        setError(null);
                        setShowCreateOption(false);
                      }
                    })
                    .catch(() => {
                      setError('Failed to create customer');
                    });
                }}
              >
                Create New Customer
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip
              </Button>
            </div>
          )}
          
          {!showCreateOption && (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip
            </Button>
          )}
        </div>
      )}

      {!error && (
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}
