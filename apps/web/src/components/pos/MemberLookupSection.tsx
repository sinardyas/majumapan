import { useState } from 'react';
import { Search, X, Star } from 'lucide-react';
import { Button } from '@pos/ui';
import { customerLookupService, type CustomerWithGroup } from '@/services/customer-lookup';
import { useCartStore } from '@/stores/cartStore';

interface MemberLookupSectionProps {
  onCustomerFound?: (customer: CustomerWithGroup) => void;
}

export function MemberLookupSection({ onCustomerFound }: MemberLookupSectionProps) {
  const selectedCustomer = useCartStore(state => state.selectedCustomer);
  const setSelectedCustomer = useCartStore(state => state.setSelectedCustomer);
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!phone.trim()) {
      setError('Enter phone number');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await customerLookupService.findByPhone(phone);
      if (result) {
        setSelectedCustomer(result);
        onCustomerFound?.(result);
      } else {
        setError('Customer not found. Leave blank to skip.');
      }
    } catch (err) {
      setError('Failed to search. Try again.');
      console.error('Customer lookup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPhone('');
    setSelectedCustomer(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (selectedCustomer) {
    return (
      <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Star className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedCustomer.customer.name || 'Member'}
              </p>
              <p className="text-xs text-gray-600">
                {selectedCustomer.customer.phone}
                {selectedCustomer.group && (
                  <span className="ml-1 text-yellow-700">
                    • {selectedCustomer.group.name}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
            title="Remove customer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Member phone (optional)"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={isLoading || !phone.trim()}
        >
          {isLoading ? '...' : 'Lookup'}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
