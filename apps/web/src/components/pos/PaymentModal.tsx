import { useState, useEffect, useCallback } from 'react';
import { Button } from '@pos/ui';
import { PAYMENT_METHODS, type PaymentMethod } from '@pos/shared';
import { Banknote, CreditCard } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, amountPaid: number, isSplitPayment: boolean, payments?: LocalPayment[]) => void;
  total: number;
}

interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

export function PaymentModal({ isOpen, onClose, onConfirm, total }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [payments, setPayments] = useState<LocalPayment[]>([]);

  const numericAmount = parseFloat(amountPaid) || 0;
  const changeAmount = numericAmount - total;
  const isValidPayment = paymentMethod === 'card' ? true : numericAmount >= total;

  // Quick cash buttons
  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    100,
  ].filter((amount, index, self) => 
    amount >= total && self.indexOf(amount) === index
  ).slice(0, 4);

  // Calculate remaining amount for split payment
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = Math.max(0, total - totalPaid);
  const totalChange = payments.reduce((sum, p) => sum + p.changeAmount, 0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setAmountPaid('');
      setError('');
      setIsSplitMode(false);
      setPayments([]);
    }
  }, [isOpen]);

  // Auto-fill exact amount for card payments (single mode)
  useEffect(() => {
    if (!isSplitMode && paymentMethod === 'card') {
      setAmountPaid(total.toFixed(2));
    } else if (!isSplitMode && paymentMethod === 'cash') {
      setAmountPaid('');
    }
  }, [paymentMethod, total, isSplitMode]);

  // Add a payment method to split
  const addPayment = useCallback((method: 'cash' | 'card') => {
    const existingCash = payments.find(p => p.paymentMethod === 'cash');
    const existingCard = payments.find(p => p.paymentMethod === 'card');

    if (method === 'cash' && existingCash) {
      setError('Cash payment already added');
      return;
    }
    if (method === 'card' && existingCard) {
      setError('Card payment already added');
      return;
    }

    const newPayment: LocalPayment = {
      id: crypto.randomUUID(),
      paymentMethod: method,
      amount: method === 'card' ? remainingAmount : 0,
      changeAmount: 0,
    };

    setPayments(prev => [...prev, newPayment]);
    setError('');
  }, [payments, remainingAmount]);

  // Remove a payment from split
  const removePayment = useCallback((id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    setError('');
  }, []);

  // Update payment amount
  const updatePaymentAmount = useCallback((id: string, amount: number) => {
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        if (p.paymentMethod === 'cash') {
          const change = Math.max(0, amount - remainingAmount);
          return { ...p, amount, changeAmount: change };
        }
        return { ...p, amount };
      }
      return p;
    }));
    setError('');
  }, [remainingAmount]);

  const handleConfirm = useCallback(() => {
    if (isSplitMode) {
      // Validate split payments
      if (payments.length === 0) {
        setError('Please add at least one payment');
        return;
      }

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid < total) {
        setError(`Remaining amount: ${formatCurrency(remainingAmount)}`);
        return;
      }

      // Validate max 1 cash + 1 card
      const hasCash = payments.some(p => p.paymentMethod === 'cash');
      const hasCard = payments.some(p => p.paymentMethod === 'card');
      if ((hasCash ? 1 : 0) + (hasCard ? 1 : 0) !== payments.length) {
        setError('Maximum 1 cash and 1 card payment allowed');
        return;
      }

      onConfirm('cash', totalPaid, true, payments);
    } else {
      // Single payment
      if (!isValidPayment) {
        setError('Insufficient amount');
        return;
      }

      const finalAmount = paymentMethod === 'card' ? total : numericAmount;
      onConfirm(paymentMethod, finalAmount, false);
    }
  }, [isSplitMode, payments, total, isValidPayment, paymentMethod, numericAmount, remainingAmount, onConfirm]);

  const handleKeypadClick = useCallback((value: string) => {
    if (value === 'C') {
      setAmountPaid('');
    } else if (value === 'backspace') {
      setAmountPaid((prev) => prev.slice(0, -1));
    } else if (value === '.') {
      if (!amountPaid.includes('.')) {
        setAmountPaid((prev) => prev + '.');
      }
    } else {
      const parts = amountPaid.split('.');
      if (parts[1]?.length >= 2) return;
      setAmountPaid((prev) => prev + value);
    }
    setError('');
  }, [amountPaid]);

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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
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

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Total */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(total)}</p>
          </div>

          {/* Split Payment Toggle */}
          <div className="flex items-center justify-center mb-6">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isSplitMode}
                  onChange={(e) => {
                    setIsSplitMode(e.target.checked);
                    setPayments([]);
                    setAmountPaid('');
                    setError('');
                  }}
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${isSplitMode ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isSplitMode ? 'transform translate-x-6' : ''}`}></div>
              </div>
              <div className="ml-3 text-sm font-medium text-gray-700">Split Payment</div>
            </label>
          </div>

          {isSplitMode ? (
            /* Split Payment Mode */
            <div className="space-y-4">
              {/* Remaining Amount */}
              <div className={`text-center p-3 rounded-lg ${remainingAmount > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <span className="text-sm text-gray-600">Remaining: </span>
                <span className={`text-2xl font-bold ${remainingAmount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {formatCurrency(remainingAmount)}
                </span>
              </div>

              {/* Add Payment Buttons */}
              <div className="flex gap-2">
                {!payments.some(p => p.paymentMethod === 'cash') && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => addPayment('cash')}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Add Cash
                  </Button>
                )}
                {!payments.some(p => p.paymentMethod === 'card') && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => addPayment('card')}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Card
                  </Button>
                )}
              </div>

              {/* Payment Entries */}
              {payments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex items-center gap-2">
                      {payment.paymentMethod === 'cash' ? (
                        <>
                          <Banknote className="h-4 w-4" />
                          Cash
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          Card
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => removePayment(payment.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {payment.paymentMethod === 'cash' ? (
                    /* Cash Payment Input */
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={payment.amount || ''}
                        onChange={(e) => updatePaymentAmount(payment.id, parseFloat(e.target.value) || 0)}
                        placeholder="Enter amount"
                        className="w-full p-2 border rounded-lg text-right font-mono text-xl"
                      />
                      {/* Quick Amount Buttons for Cash */}
                      <div className="grid grid-cols-4 gap-2">
                        {quickAmounts.map((amount) => (
                          <button
                            key={amount}
                            onClick={() => updatePaymentAmount(payment.id, amount)}
                            className="py-1 px-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                          >
                            {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>
                      {payment.changeAmount > 0 && (
                        <div className="text-green-600 text-sm font-medium">
                          Change: {formatCurrency(payment.changeAmount)}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Card Payment Input (auto-filled) */
                    <div>
                      <input
                        type="number"
                        value={payment.amount || ''}
                        onChange={(e) => updatePaymentAmount(payment.id, parseFloat(e.target.value) || 0)}
                        placeholder="Card amount"
                        className="w-full p-2 border rounded-lg text-right font-mono text-xl"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Payment Summary */}
              {payments.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Payments:</span>
                  </div>
                  {payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        {p.paymentMethod === 'cash' ? (
                          <>
                            <Banknote className="h-3 w-3" />
                            Cash
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3 w-3" />
                            Card
                          </>
                        )}:
                      </span>
                      <span>
                        {formatCurrency(p.amount)}
                        {p.changeAmount > 0 && ` (Change: ${formatCurrency(p.changeAmount)})`}
                      </span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                    <span>Total Paid:</span>
                    <span>{formatCurrency(totalPaid)}</span>
                  </div>
                  {totalChange > 0 && (
                    <div className="flex justify-between text-green-600 text-sm">
                      <span>Total Change:</span>
                      <span>{formatCurrency(totalChange)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Single Payment Mode */
            <>
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
                        <Banknote className="h-4 w-4" />
			Cash
                      </>
                    ) : (
                      <>
			<CreditCard className="h-4 w-4" />
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
            </>
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
            disabled={isSplitMode ? remainingAmount > 0 : !isValidPayment}
          >
            {isSplitMode 
              ? `Complete Payment`
              : paymentMethod === 'cash' 
                ? `Confirm Payment (Change: ${formatCurrency(Math.max(0, changeAmount))})`
                : 'Confirm Card Payment'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
