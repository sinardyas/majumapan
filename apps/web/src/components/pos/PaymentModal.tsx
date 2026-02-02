import { useState, useEffect, useCallback } from 'react';
import { Button } from '@pos/ui';
import { PAYMENT_METHODS, type PaymentMethod } from '@pos/shared';
import { Banknote, CreditCard, Gift, X } from 'lucide-react';
import { VoucherEntryModal } from './VoucherEntryModal';
import type { Voucher } from '@/services/voucher';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, amountPaid: number, isSplitPayment: boolean, payments?: LocalPayment[], vouchers?: Array<{ voucher: Voucher; amount: number }>) => void;
  total: number;
  cartItems?: Array<{ id: string; productId: string; categoryId?: string; price: number; quantity: number }>;
}

interface LocalPayment {
  id: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

interface AppliedVoucher {
  voucher: Voucher;
  amount: number;
}

export function PaymentModal({ isOpen, onClose, onConfirm, total, cartItems = [] }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [payments, setPayments] = useState<LocalPayment[]>([]);
  const [appliedVouchers, setAppliedVouchers] = useState<AppliedVoucher[]>([]);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const voucherDiscount = appliedVouchers.reduce((sum, v) => sum + v.amount, 0);
  const finalTotal = Math.max(0, total - voucherDiscount);

  const numericAmount = parseFloat(amountPaid) || 0;
  const changeAmount = numericAmount - finalTotal;
  const isValidPayment = paymentMethod === 'card' ? true : numericAmount >= finalTotal;

  const quickAmounts = [
    Math.ceil(finalTotal),
    Math.ceil(finalTotal / 5) * 5,
    Math.ceil(finalTotal / 10) * 10,
    Math.ceil(finalTotal / 50) * 50,
    100,
  ].filter((amount, index, self) => 
    amount >= finalTotal && self.indexOf(amount) === index
  ).slice(0, 4);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = Math.max(0, finalTotal - totalPaid);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setAmountPaid('');
      setError('');
      setIsSplitMode(false);
      setPayments([]);
      setAppliedVouchers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isSplitMode && paymentMethod === 'card') {
      setAmountPaid(finalTotal.toFixed(2));
    } else if (!isSplitMode && paymentMethod === 'cash') {
      setAmountPaid('');
    }
  }, [paymentMethod, finalTotal, isSplitMode]);

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

  const removePayment = useCallback((id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    setError('');
  }, []);

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
      if (payments.length === 0) {
        setError('Please add at least one payment');
        return;
      }

      const totalPaidSplit = payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaidSplit < finalTotal) {
        setError(`Remaining amount: ${formatCurrency(remainingAmount)}`);
        return;
      }

      const hasCash = payments.some(p => p.paymentMethod === 'cash');
      const hasCard = payments.some(p => p.paymentMethod === 'card');
      if ((hasCash ? 1 : 0) + (hasCard ? 1 : 0) !== payments.length) {
        setError('Maximum 1 cash and 1 card payment allowed');
        return;
      }

      onConfirm('cash', totalPaidSplit, true, payments, appliedVouchers);
    } else {
      if (!isValidPayment) {
        setError('Insufficient amount');
        return;
      }

      const finalAmount = paymentMethod === 'card' ? finalTotal : numericAmount;
      onConfirm(paymentMethod, finalAmount, false, undefined, appliedVouchers);
    }
  }, [isSplitMode, payments, finalTotal, isValidPayment, paymentMethod, numericAmount, remainingAmount, onConfirm, appliedVouchers]);

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

  const handleApplyVoucher = useCallback((voucher: Voucher, discountAmount: number) => {
    setAppliedVouchers(prev => [...prev, { voucher, amount: discountAmount }]);
  }, []);

  const handleRemoveVoucher = useCallback((code: string) => {
    setAppliedVouchers(prev => prev.filter(v => v.voucher.code !== code));
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/50" 
          onClick={onClose}
        />
        
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-xl font-semibold">Payment</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-4xl font-bold text-gray-900">{formatCurrency(total)}</p>
            </div>

            {voucherDiscount > 0 && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-700 font-medium">Vouchers Applied:</span>
                  <span className="text-green-700 font-bold">-{formatCurrency(voucherDiscount)}</span>
                </div>
                {appliedVouchers.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm text-green-600">
                    <span className="font-mono">{v.voucher.code}</span>
                    <span>{formatCurrency(v.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-green-200 mt-2 pt-2 flex justify-between font-bold">
                  <span>Final Total:</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center mb-6">
              <Button
                variant="outline"
                onClick={() => setIsVoucherModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Gift className="h-4 w-4" />
                Add Voucher
              </Button>
            </div>

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
              <div className="space-y-4">
                <div className={`text-center p-3 rounded-lg ${remainingAmount > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <span className="text-sm text-gray-600">Remaining: </span>
                  <span className={`text-2xl font-bold ${remainingAmount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>

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

                {payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        {payment.paymentMethod === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                        {payment.paymentMethod === 'cash' ? 'Cash' : 'Card'}
                      </span>
                      <button onClick={() => removePayment(payment.id)} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                    
                    {payment.paymentMethod === 'cash' ? (
                      <div className="space-y-2">
                        <input
                          type="number"
                          value={payment.amount || ''}
                          onChange={(e) => updatePaymentAmount(payment.id, parseFloat(e.target.value) || 0)}
                          placeholder="Enter amount"
                          className="w-full p-2 border rounded-lg text-right font-mono text-xl"
                        />
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
                      <input
                        type="number"
                        value={payment.amount || ''}
                        onChange={(e) => updatePaymentAmount(payment.id, parseFloat(e.target.value) || 0)}
                        placeholder="Card amount"
                        className="w-full p-2 border rounded-lg text-right font-mono text-xl"
                      />
                    )}
                  </div>
                ))}

                {payments.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    {payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          {p.paymentMethod === 'cash' ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                          {p.paymentMethod}:
                        </span>
                        <span>{formatCurrency(p.amount)}{p.changeAmount > 0 && ` (Change: ${formatCurrency(p.changeAmount)})`}</span>
                      </div>
                    ))}
                    <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                      <span>Total Paid:</span>
                      <span>{formatCurrency(totalPaid)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-6">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        paymentMethod === method ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                      {method === 'cash' ? 'Cash' : 'Card'}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="text-sm text-gray-500">Amount Tendered</label>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        ${amountPaid || '0.00'}
                      </div>
                    </div>

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

                    <div className="grid grid-cols-4 gap-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'C', '⌫'].map((key) => (
                        <button
                          key={key}
                          onClick={() => handleKeypadClick(key)}
                          className={`py-3 rounded-lg font-medium text-lg transition-colors ${
                            key === 'C' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                            key === '⌫' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' :
                            'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>

                    {changeAmount > 0 && (
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <span className="text-green-700">Change: </span>
                        <span className="text-2xl font-bold text-green-700">{formatCurrency(changeAmount)}</span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Card payment of {formatCurrency(finalTotal)}</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={isSplitMode ? payments.length === 0 : !isValidPayment}
            >
              {isSplitMode ? `Pay ${formatCurrency(totalPaid)}` : `Pay ${formatCurrency(finalTotal)}`}
            </Button>
          </div>
        </div>
      </div>

      <VoucherEntryModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        onApply={handleApplyVoucher}
        cartItems={cartItems}
        subtotal={subtotal}
        appliedVouchers={appliedVouchers}
        onRemoveVoucher={handleRemoveVoucher}
      />
    </>
  );
}
