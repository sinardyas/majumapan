import { useState, useEffect } from 'react';
import { Button, Input } from '@pos/ui';
import { X, RefreshCw, Gift, DollarSign } from 'lucide-react';
import { voucherApi } from '@/services/voucher';
import type { LocalTransaction } from '@/db';
import { useToast } from '@pos/ui';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: LocalTransaction | null;
  onRefundComplete: () => void;
}

interface RefundItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  selected: boolean;
}

export function RefundModal({ isOpen, onClose, transaction, onRefundComplete }: RefundModalProps) {
  const toast = useToast();
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'gift_card'>('cash');
  const [giftCardAmount, setGiftCardAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select' | 'method' | 'confirm'>('select');

  useEffect(() => {
    if (transaction && isOpen) {
      const items: RefundItem[] = transaction.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        selected: true,
      }));
      setRefundItems(items);
      setGiftCardAmount(transaction.total.toFixed(2));
      setStep('select');
    }
  }, [transaction, isOpen]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const selectedItems = refundItems.filter(item => item.selected);
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);

  const toggleItem = (productId: string) => {
    setRefundItems(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleAll = () => {
    const allSelected = refundItems.every(item => item.selected);
    setRefundItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleConfirmRefund = async () => {
    if (!transaction) return;

    setIsProcessing(true);
    try {
      if (refundMethod === 'gift_card') {
        const amount = parseFloat(giftCardAmount);
        if (isNaN(amount) || amount <= 0) {
          toast.error('Please enter a valid amount');
          setIsProcessing(false);
          return;
        }

        const response = await voucherApi.createFromRefund(
          transaction.clientId,
          amount
        );

        if (response.success && response.data?.data) {
          toast.success(`Gift card created: ${response.data.data.code}`);
          onRefundComplete();
          onClose();
        } else {
          toast.error('Failed to create gift card');
        }
      } else {
        toast.success(`Cash refund of ${formatCurrency(selectedSubtotal)} processed`);
        onRefundComplete();
        onClose();
      }
    } catch (error) {
      console.error('Refund error:', error);
      toast.error('Failed to process refund');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Process Refund
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 'select' && (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Transaction</p>
                <p className="font-mono font-medium">
                  {transaction.transactionNumber || transaction.clientId.slice(0, 8)}
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(transaction.total)}
                </p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={refundItems.every(item => item.selected)}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
                <span className="text-sm text-gray-500">
                  {selectedItems.length} items selected
                </span>
              </div>

              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {refundItems.map((item) => (
                  <div
                    key={item.productId}
                    className={`p-3 flex items-center gap-3 cursor-pointer ${
                      item.selected ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => toggleItem(item.productId)}
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItem(item.productId)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.unitPrice)} x {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              {selectedSubtotal > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Refund Amount</span>
                    <span>{formatCurrency(selectedSubtotal)}</span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep('method')}
                  disabled={selectedItems.length === 0}
                >
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 'method' && (
            <>
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">Refund Method</p>
                <div className="space-y-3">
                  <label
                    className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                      refundMethod === 'cash'
                        ? 'border-primary-500 bg-primary-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setRefundMethod('cash')}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={refundMethod === 'cash'}
                        onChange={() => setRefundMethod('cash')}
                        className="w-4 h-4"
                      />
                      <DollarSign className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">Cash Refund</p>
                        <p className="text-sm text-gray-500">
                          Refund {formatCurrency(selectedSubtotal)} in cash
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                      refundMethod === 'gift_card'
                        ? 'border-primary-500 bg-primary-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setRefundMethod('gift_card')}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={refundMethod === 'gift_card'}
                        onChange={() => setRefundMethod('gift_card')}
                        className="w-4 h-4"
                      />
                      <Gift className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">Gift Card</p>
                        <p className="text-sm text-gray-500">
                          Create a gift card for future purchases
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {refundMethod === 'gift_card' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gift Card Amount
                  </label>
                  <Input
                    type="number"
                    value={giftCardAmount}
                    onChange={(e) => setGiftCardAmount(e.target.value)}
                    placeholder="Enter amount"
                    prefix="Rp"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('select')}>
                  Back
                </Button>
                <Button className="flex-1" onClick={() => setStep('confirm')}>
                  Review
                </Button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-4">Refund Summary</p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items</span>
                    <span>{selectedItems.length} items</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-3">
                    <span>Total Refund</span>
                    <span>
                      {formatCurrency(
                        refundMethod === 'gift_card'
                          ? parseFloat(giftCardAmount) || 0
                          : selectedSubtotal
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Method</span>
                    <span className="capitalize">
                      {refundMethod === 'gift_card' ? 'Gift Card' : 'Cash'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('method')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmRefund}
                  isLoading={isProcessing}
                >
                  Confirm Refund
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
