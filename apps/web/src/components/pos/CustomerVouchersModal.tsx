import { useState, useEffect } from 'react';
import { Modal, Button } from '@pos/ui';
import { customerApi } from '@/services/customer';
import type { Customer, CustomerVoucher } from '@/types/customer';
import { Gift, Tag, Clock } from 'lucide-react';

interface CustomerVouchersModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onApplyVoucher: (voucher: CustomerVoucher) => void;
}

export function CustomerVouchersModal({
  isOpen,
  onClose,
  customer,
  onApplyVoucher,
}: CustomerVouchersModalProps) {
  const [vouchers, setVouchers] = useState<CustomerVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      fetchVouchers();
    }
  }, [isOpen, customer]);

  const fetchVouchers = async () => {
    if (!customer) return;

    setIsLoading(true);
    try {
      const response = await customerApi.getVouchers(customer.id);
      if (response.success && response.data) {
        setVouchers(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch vouchers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyVoucher = (voucher: CustomerVoucher) => {
    onApplyVoucher(voucher);
    onClose();
  };

  const getVoucherIcon = (type: string) => {
    if (type === 'GC') return <Gift className="h-5 w-5 text-blue-600" />;
    return <Tag className="h-5 w-5 text-green-600" />;
  };

  const formatValue = (voucher: CustomerVoucher) => {
    if (voucher.type === 'GC') {
      return `Rp ${Number(voucher.currentBalance || voucher.initialValue || 0).toLocaleString('id-ID')}`;
    }
    if (voucher.discountType === 'PERCENTAGE') {
      return `${voucher.percentageValue}% off`;
    }
    if (voucher.discountType === 'FIXED') {
      return `Rp ${Number(voucher.fixedValue || 0).toLocaleString('id-ID')} off`;
    }
    return 'Free Item';
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${customer.name || 'Customer'}'s Vouchers`}
    >
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            Loading vouchers...
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No vouchers available
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((voucher) => {
              const expired = isExpired(voucher.expiresAt);
              const balance = Number(voucher.currentBalance || 0);
              const isZeroBalance = voucher.type === 'GC' && balance <= 0;

              if (expired || isZeroBalance || !voucher.isActive || voucher.isVoid) {
                return null;
              }

              return (
                <div
                  key={voucher.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {getVoucherIcon(voucher.type)}
                    <div>
                      <div className="font-medium text-gray-900">
                        {voucher.code}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatValue(voucher)}
                      </div>
                      {voucher.expiresAt && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Expires: {new Date(voucher.expiresAt).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleApplyVoucher(voucher)}
                  >
                    Apply
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
