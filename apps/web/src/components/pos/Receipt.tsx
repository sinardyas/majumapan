import { forwardRef } from 'react';
import type { LocalTransaction } from '@/db';

interface ReceiptProps {
  transaction: LocalTransaction;
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  cashierName: string;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ transaction, storeName, storeAddress, storePhone, cashierName }, ref) => {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatTime = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    return (
      <div
        ref={ref}
        className="w-[80mm] bg-white p-4 font-mono text-xs"
        style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4' }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-lg font-bold uppercase">{storeName}</h1>
          {storeAddress && <p className="text-gray-600">{storeAddress}</p>}
          {storePhone && <p className="text-gray-600">Tel: {storePhone}</p>}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Transaction Info */}
        <div className="mb-4">
          <div className="flex justify-between">
            <span>Receipt #:</span>
            <span className="font-bold">{transaction.transactionNumber || transaction.clientId.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formatDate(transaction.clientTimestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{formatTime(transaction.clientTimestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{cashierName}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Items */}
        <div className="mb-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left pb-1">Item</th>
                <th className="text-center pb-1">Qty</th>
                <th className="text-right pb-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-1">
                    <div className="truncate max-w-[120px]">{item.productName}</div>
                    <div className="text-gray-500 text-xs">
                      @ {formatCurrency(item.unitPrice)}
                    </div>
                    {item.discountValue > 0 && (
                      <div className="text-green-600 text-xs">
                        Disc: -{formatCurrency(item.discountValue)}
                      </div>
                    )}
                  </td>
                  <td className="text-center align-top py-1">{item.quantity}</td>
                  <td className="text-right align-top py-1">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(transaction.subtotal)}</span>
          </div>
          
          {transaction.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>
                Discount
                {transaction.discountCode && ` (${transaction.discountCode})`}:
              </span>
              <span>-{formatCurrency(transaction.discountAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span>Tax (10%):</span>
            <span>{formatCurrency(transaction.taxAmount)}</span>
          </div>
          
          <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-1">
            <span>TOTAL:</span>
            <span>{formatCurrency(transaction.total)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Payment Info */}
        <div className="mb-4">
          <div className="flex justify-between">
            <span>Payment Method:</span>
            <span className="uppercase">{transaction.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount Paid:</span>
            <span>{formatCurrency(transaction.amountPaid)}</span>
          </div>
          {transaction.changeAmount > 0 && (
            <div className="flex justify-between font-bold">
              <span>Change:</span>
              <span>{formatCurrency(transaction.changeAmount)}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="font-bold">Thank you for your purchase!</p>
          <p className="text-gray-500 mt-2">Please keep this receipt for your records</p>
          
          {/* Offline indicator */}
          {transaction.syncStatus === 'pending' && (
            <p className="text-yellow-600 text-xs mt-2">
              * Transaction pending sync
            </p>
          )}
        </div>

        {/* Extra spacing for tear-off */}
        <div className="h-8" />
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
