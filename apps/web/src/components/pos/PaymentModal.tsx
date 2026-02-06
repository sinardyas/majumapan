import { useState, useCallback } from 'react';
import { Button } from '@pos/ui';
import { X, Banknote, Landmark, CreditCard, Ticket } from 'lucide-react';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface PaymentEntry {
  id: string;
  type: 'cash' | 'debit' | 'credit' | 'voucher';
  amount: number;
  cardNumber?: string;
  voucherCode?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentEntry[]) => void;
  total: number;
}

export function PaymentModal({ isOpen, onClose, onConfirm, total }: PaymentModalProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedTab, setSelectedTab] = useState<'cash' | 'debit' | 'credit' | 'voucher'>('cash');
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [focusedField, setFocusedField] = useState<'amount' | 'card' | 'voucher' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymentTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const change = Math.max(0, paymentTotal - total);
  const remainingAmount = Math.max(0, total - paymentTotal);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(-4).padStart(4, '*').padStart(8, '*');
  };

  const handleKeypadClick = useCallback((value: string) => {
    setError(null);
    
    if (value === 'C') {
      setAmount('');
      setCardNumber('');
      setVoucherCode('');
      return;
    }

    if (value === 'backspace') {
      if (focusedField === 'voucher') {
        setVoucherCode(prev => prev.slice(0, -1));
      } else if (focusedField === 'card') {
        setCardNumber(prev => prev.slice(0, -1));
      } else if (focusedField === 'amount' || !focusedField) {
        setAmount(prev => prev.slice(0, -1));
      }
      return;
    }

    if (value === '.') {
      if ((focusedField === 'amount' || !focusedField) && !amount.includes('.')) {
        setAmount(prev => prev + '.');
      }
      return;
    }

    if (focusedField === 'voucher') {
      if (voucherCode.length < 20) {
        setVoucherCode(prev => prev + value.toUpperCase());
      }
    } else if (focusedField === 'card') {
      if (cardNumber.length < 16) {
        setCardNumber(prev => prev + value);
      }
    } else if (focusedField === 'amount' || !focusedField) {
      const currentAmount = focusedField === 'amount' ? amount : amount;
      const parts = currentAmount.split('.');
      if (parts[1]?.length >= 2) return;
      setAmount(prev => prev + value);
    }
  }, [amount, cardNumber, voucherCode, focusedField]);

  const handleAddPayment = useCallback(() => {
    setError(null);

    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if ((selectedTab === 'debit' || selectedTab === 'credit') && cardNumber.length > 0 && cardNumber.length < 4) {
      setError('Card number must be at least 4 digits');
      return;
    }

    if (selectedTab === 'voucher' && voucherCode.length > 0 && voucherCode.length < 4) {
      setError('Voucher code must be at least 4 characters');
      return;
    }

    const newPayment: PaymentEntry = {
      id: crypto.randomUUID(),
      type: selectedTab,
      amount: numericAmount,
      ...(selectedTab === 'voucher' && voucherCode.length > 0 && { voucherCode: voucherCode.toUpperCase() }),
      ...((selectedTab === 'debit' || selectedTab === 'credit') && cardNumber.length >= 4 && { cardNumber: formatCardNumber(cardNumber) }),
    };

    setPayments(prev => [...prev, newPayment]);
    setAmount('');
    setCardNumber('');
    setVoucherCode('');
    setFocusedField(null);
  }, [amount, cardNumber, voucherCode, selectedTab]);

  const handleRemovePayment = useCallback((id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleSave = useCallback(() => {
    if (paymentTotal < total) {
      setError(`Payment total must be at least ${formatCurrency(total)}`);
      return;
    }
    onConfirm(payments);
    setPayments([]);
    setAmount('');
    setCardNumber('');
    setVoucherCode('');
    setFocusedField(null);
    setError(null);
  }, [paymentTotal, total, payments, onConfirm]);

  const handleCancel = useCallback(() => {
    onClose();
    setPayments([]);
    setAmount('');
    setCardNumber('');
    setVoucherCode('');
    setFocusedField(null);
    setError(null);
  }, [onClose]);

  const handleTabChange = (tab: 'cash' | 'debit' | 'credit' | 'voucher') => {
    setSelectedTab(tab);
    setFocusedField('amount');
    setError(null);
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'cash': return <Banknote className="w-5 h-5" />;
      case 'debit': return <Landmark className="w-5 h-5" />;
      case 'credit': return <CreditCard className="w-5 h-5" />;
      case 'voucher': return <Ticket className="w-5 h-5" />;
      default: return null;
    }
  };

  const getPaymentLabel = (type: string) => {
    switch (type) {
      case 'cash': return 'Cash';
      case 'debit': return 'Debit Card';
      case 'credit': return 'Credit Card';
      case 'voucher': return 'Voucher';
      default: return '';
    }
  };

  const getInputBorderClass = (field: 'amount' | 'card' | 'voucher') => {
    const isFocused = focusedField === field;
    return isFocused 
      ? 'border-primary-600 ring-2 ring-primary-200' 
      : 'border-gray-300';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold">Payment</h2>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(total)}
            </p>
          </div>
          <button 
            onClick={handleCancel}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Payment Method Tabs */}
        <div className="px-6 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex gap-2">
            {[
              { key: 'cash' as const, label: 'Cash', icon: Banknote },
              { key: 'debit' as const, label: 'Debit Card', icon: Landmark },
              { key: 'credit' as const, label: 'Credit Card', icon: CreditCard },
              { key: 'voucher' as const, label: 'Voucher', icon: Ticket },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  selectedTab === tab.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Entry Form */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="text"
                value={amount}
                onFocus={() => setFocusedField('amount')}
                placeholder="0.00"
                className={`w-full px-4 py-3 border rounded-lg font-mono text-xl text-right bg-white ${getInputBorderClass('amount')}`}
              />
            </div>
            
            {(selectedTab === 'debit' || selectedTab === 'credit') && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onFocus={() => setFocusedField('card')}
                  placeholder="**** **** **** ****"
                  className={`w-full px-4 py-3 border rounded-lg font-mono text-xl bg-white ${getInputBorderClass('card')}`}
                />
              </div>
            )}

            {selectedTab === 'voucher' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Code
                </label>
                <input
                  type="text"
                  value={voucherCode}
                  onFocus={() => setFocusedField('voucher')}
                  placeholder="Enter voucher code"
                  className={`w-full px-4 py-3 border rounded-lg font-mono text-xl bg-white uppercase ${getInputBorderClass('voucher')}`}
                />
              </div>
            )}

            <div className="shrink-0 flex items-end">
              <Button
                onClick={handleAddPayment}
                className="px-8 py-3 text-lg font-medium"
              >
                ADD
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Main Content - Split Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Breakdown Table + Summary */}
          <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden">
            {/* Breakdown Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Card</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map(payment => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-medium">
                          {getPaymentIcon(payment.type)}
                          {getPaymentLabel(payment.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-500">
                        {payment.cardNumber || payment.voucherCode || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemovePayment(payment.id)}
                          className="text-red-500 hover:text-red-700 font-medium text-sm"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                        No payments added yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Remaining:</span>
                <span className={`text-xl font-bold ${remainingAmount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Change:</span>
                <span className={`text-xl font-bold ${change > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatCurrency(change)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Numeric Keypad */}
          <div className="w-72 bg-gray-100 flex flex-col flex-shrink-0">
            <div className="flex-1 p-4 flex flex-col justify-center">
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key => (
                  <button
                    key={key}
                    onClick={() => handleKeypadClick(key)}
                    className="py-4 rounded-lg font-medium text-xl bg-white hover:bg-gray-200 transition-colors shadow-sm"
                  >
                    {key}
                  </button>
                ))}
                {['.', '0', 'C'].map(key => (
                  <button
                    key={key}
                    onClick={() => handleKeypadClick(key)}
                    className={`py-4 rounded-lg font-medium text-xl transition-colors shadow-sm ${
                      key === 'C'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-white hover:bg-gray-200'
                    }`}
                  >
                    {key}
                  </button>
                ))}
                <button
                  onClick={() => handleKeypadClick('backspace')}
                  className="py-4 rounded-lg font-medium text-lg bg-white hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center"
                >
                  ⌫
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0 bg-gray-50">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 py-3 text-lg"
          >
            CANCEL
          </Button>
          <Button
            onClick={handleSave}
            disabled={payments.length === 0 || paymentTotal < total}
            className="flex-1 py-3 text-lg"
          >
            PAY
          </Button>
        </div>
      </div>
    </div>
  );
}
