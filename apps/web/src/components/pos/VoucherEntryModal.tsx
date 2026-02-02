import { useState, useCallback, useEffect } from 'react';
import { Button, Input } from '@pos/ui';
import { voucherApi, type Voucher, type CartItem } from '@/services/voucher';
import { QrCode, Keyboard, User, Gift, Tag, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface VoucherEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (voucher: Voucher, discountAmount: number, freeItems?: Array<{ productId: string; quantity: number }>) => void;
  cartItems?: CartItem[];
  subtotal: number;
  appliedVouchers?: Array<{ voucher: Voucher; amount: number }>;
  onRemoveVoucher?: (voucherCode: string) => void;
}

type EntryTab = 'scan' | 'manual' | 'customer';

export function VoucherEntryModal({
  isOpen,
  onClose,
  onApply,
  cartItems = [],
  subtotal,
  appliedVouchers = [],
  onRemoveVoucher,
}: VoucherEntryModalProps) {
  const [activeTab, setActiveTab] = useState<EntryTab>('manual');
  const [manualCode, setManualCode] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerVouchers, setCustomerVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    voucher?: Voucher;
    discountPreview?: {
      calculatedDiscount: number;
      finalDiscount: number;
      message: string;
    };
    error?: string;
  } | null>(null);

  const handleScan = useCallback(() => {
    setActiveTab('scan');
    // In a real implementation, this would trigger barcode scanner
    alert('Barcode scanner integration - use manual entry for now');
  }, []);

  const validateVoucher = useCallback(async (code: string) => {
    setValidating(true);
    setError(null);
    setSuccessMessage(null);
    setValidationResult(null);

    const response = await voucherApi.validateVoucher({
      code,
      cartItems,
      subtotal,
    });

    if (response.success && response.data) {
      const result = response.data;
      setValidationResult({
        valid: result.valid,
        voucher: result.voucher,
        discountPreview: result.discountPreview,
        error: result.error,
      });

      if (result.valid) {
        setSuccessMessage('Voucher valid! Click Apply to use.');
      } else {
        setError(result.error || 'Invalid voucher');
      }
    } else {
      setError(response.error || 'Failed to validate voucher');
    }

    setValidating(false);
  }, [cartItems, subtotal]);

  const handleManualSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      validateVoucher(manualCode.trim());
    }
  }, [manualCode, validateVoucher]);

  const handleApply = useCallback(() => {
    if (validationResult?.valid && validationResult.voucher) {
      const discountAmount = validationResult.discountPreview?.finalDiscount || 0;
      onApply(validationResult.voucher, discountAmount);
      setManualCode('');
      setValidationResult(null);
      setSuccessMessage(null);
      onClose();
    }
  }, [validationResult, onApply, onClose]);

  const handleCustomerSelect = useCallback(async (voucher: Voucher) => {
    setValidating(true);
    setError(null);
    setSuccessMessage(null);

    const response = await voucherApi.validateVoucher({
      code: voucher.code,
      cartItems,
      subtotal,
    });

    if (response.success && response.data) {
      const result = response.data;
      if (result.valid) {
        setValidationResult({
          valid: true,
          voucher,
          discountPreview: result.discountPreview,
        });
        setSuccessMessage('Voucher valid! Click Apply to use.');
      } else {
        setError(result.error || 'Voucher cannot be used');
      }
    } else {
      setError(response.error || 'Failed to validate voucher');
    }

    setValidating(false);
  }, [cartItems, subtotal]);

  const loadCustomerVouchers = useCallback(async (customerId: string) => {
    if (!customerId) {
      setCustomerVouchers([]);
      return;
    }

    setLoading(true);
    const response = await voucherApi.getCustomerVouchers(customerId);
    if (response.success && response.data) {
      setCustomerVouchers(Array.isArray(response.data) ? response.data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'customer') {
      loadCustomerVouchers(selectedCustomerId);
    }
  }, [activeTab, selectedCustomerId, loadCustomerVouchers]);

  const isVoucherApplied = useCallback((code: string) => {
    return appliedVouchers.some(v => v.voucher.code === code);
  }, [appliedVouchers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold">Apply Voucher</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Applied Vouchers */}
        {appliedVouchers.length > 0 && (
          <div className="px-6 py-3 bg-green-50 border-b border-green-100">
            <p className="text-sm font-medium text-green-700 mb-2">Applied Vouchers:</p>
            <div className="space-y-1">
              {appliedVouchers.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-green-800">
                    {v.voucher.code} (-{formatCurrency(v.amount)})
                  </span>
                  {onRemoveVoucher && (
                    <button
                      onClick={() => onRemoveVoucher(v.voucher.code)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'scan'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <QrCode className="h-4 w-4" />
            Scan
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            Manual
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'customer'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="h-4 w-4" />
            Customer
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'scan' && (
            <div className="text-center py-8">
              <QrCode className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Scan voucher barcode or QR code</p>
              <Button variant="outline" onClick={handleScan}>
                Open Scanner
              </Button>
            </div>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Voucher Code
                </label>
                <Input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="font-mono text-lg tracking-wider"
                  maxLength={19}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: XXXX-XXXX-XXXX-XXXX
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!manualCode.trim() || validating}
                isLoading={validating}
              >
                Validate Voucher
              </Button>
            </form>
          )}

          {activeTab === 'customer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Phone or ID
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    placeholder="Enter customer ID"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => loadCustomerVouchers(selectedCustomerId)}
                    disabled={!selectedCustomerId || loading}
                  >
                    Load
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-4 text-gray-500">
                  Loading vouchers...
                </div>
              ) : customerVouchers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Available Vouchers:</p>
                  {customerVouchers.map((voucher) => {
                    const applied = isVoucherApplied(voucher.code);
                    return (
                      <button
                        key={voucher.id}
                        onClick={() => !applied && handleCustomerSelect(voucher)}
                        disabled={applied}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          applied
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary-600" />
                            <span className="font-mono font-medium">{voucher.code}</span>
                          </div>
                          {applied && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {voucher.type === 'GC' ? (
                            <span>Balance: {formatCurrency(Number(voucher.currentBalance) || 0)}</span>
                          ) : (
                            <span>{voucher.discountType} Discount</span>
                          )}
                          {voucher.expiresAt && (
                            <span className="ml-2 text-xs">
                              Exp: {new Date(voucher.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  {selectedCustomerId ? 'No vouchers found for this customer' : 'Enter customer ID to load vouchers'}
                </p>
              )}
            </div>
          )}

          {/* Validation Result */}
          {validationResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              validationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {validationResult.valid ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Voucher Valid</span>
                  </div>
                  <div className="text-sm text-green-600">
                    <p>Code: {validationResult.voucher?.code}</p>
                    <p>Type: {validationResult.voucher?.type}</p>
                    {validationResult.discountPreview && (
                      <p className="font-medium mt-1">
                        Discount: {validationResult.discountPreview.message} ({formatCurrency(validationResult.discountPreview.finalDiscount)})
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Invalid Voucher</p>
                    <p className="text-sm">{validationResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && !validationResult && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && !validationResult && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">{successMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!validationResult?.valid}
            onClick={handleApply}
          >
            Apply Voucher
          </Button>
        </div>
      </div>
    </div>
  );
}
