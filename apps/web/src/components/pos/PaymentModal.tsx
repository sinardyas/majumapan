import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { PAYMENT_METHODS, type PaymentMethod } from '@pos/shared';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, amountPaid: number) => void;
  total: number;
}

export function PaymentModal({ isOpen, onClose, onConfirm, total }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [error, setError] = useState<string>('');

  const numericAmount = parseFloat(amountPaid) || 0;
  const changeAmount = numericAmount - total;
  const isValidPayment = paymentMethod === 'card' ? true : numericAmount >= total;

  // Quick cash buttons
  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
    Math.ceil(total / 50) * 50,
    100,
  ].filter((amount, index, self) => 
    amount >= total && self.indexOf(amount) === index
  ).slice(0, 4);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setAmountPaid('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-fill exact amount for card payments
    if (paymentMethod === 'card') {
      setAmountPaid(total.toFixed(2));
    } else {
      setAmountPaid('');
    }
  }, [paymentMethod, total]);

  const handleConfirm = () => {
    if (!isValidPayment) {
      setError('Insufficient amount');
      return;
    }

    const finalAmount = paymentMethod === 'card' ? total : numericAmount;
    onConfirm(paymentMethod, finalAmount);
  };

  const handleKeypadClick = (value: string) => {
    if (value === 'C') {
      setAmountPaid('');
    } else if (value === 'backspace') {
      setAmountPaid((prev) => prev.slice(0, -1));
    } else if (value === '.') {
      if (!amountPaid.includes('.')) {
        setAmountPaid((prev) => prev + '.');
      }
    } else {
      // Limit decimal places to 2
      const parts = amountPaid.split('.');
      if (parts[1]?.length >= 2) return;
      setAmountPaid((prev) => prev + value);
    }
    setError('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Payment</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Total */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(total)}</p>
          </div>

          {/* Payment Method Tabs */}
          <div className="flex gap-2 mb-6">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  paymentMethod === method
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {method === 'cash' ? (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Cash
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Card
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Cash Payment */}
          {paymentMethod === 'cash' && (
            <div className="space-y-4">
              {/* Amount Display */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="text-sm text-gray-500">Amount Tendered</label>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  ${amountPaid || '0.00'}
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setAmountPaid(amount.toString());
                      setError('');
                    }}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeypadClick(key)}
                    className="py-4 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-xl transition-colors"
                  >
                    {key === 'backspace' ? (
                      <svg className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                      </svg>
                    ) : (
                      key
                    )}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              {numericAmount > 0 && (
                <div className={`rounded-lg p-4 ${changeAmount >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${changeAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {changeAmount >= 0 ? 'Change' : 'Remaining'}
                    </span>
                    <span className={`text-2xl font-bold ${changeAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(Math.abs(changeAmount))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card Payment */}
          {paymentMethod === 'card' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center h-16 w-16 bg-primary-100 rounded-full mb-4">
                <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-gray-600">
                Process card payment of <span className="font-bold">{formatCurrency(total)}</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Use external card terminal to complete payment
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm text-center mt-4">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!isValidPayment}
          >
            {paymentMethod === 'cash' 
              ? `Confirm Payment (Change: ${formatCurrency(Math.max(0, changeAmount))})`
              : 'Confirm Card Payment'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
