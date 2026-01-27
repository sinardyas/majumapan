import { TransactionSummary } from '@pos/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TransactionRowProps {
  transaction: TransactionSummary;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TransactionRow({ transaction, isExpanded, onToggle }: TransactionRowProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-gray-50 ${
          transaction.status === 'voided' ? 'bg-red-50 hover:bg-red-100' : ''
        }`}
        onClick={onToggle}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">#{transaction.transactionNumber}</span>
            {transaction.status === 'voided' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                VOIDED
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatTime(transaction.createdAt)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {transaction.cashierName}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {transaction.itemCount}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {formatCurrency(transaction.total)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            transaction.paymentMethod === 'cash'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {transaction.paymentMethod}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            transaction.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : transaction.status === 'voided'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {transaction.status}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 mx-auto inline" />
          ) : (
            <ChevronDown className="h-4 w-4 mx-auto inline" />
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-6 py-4">
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="ml-2 font-medium">{formatCurrency(transaction.subtotal)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Tax:</span>
                  <span className="ml-2 font-medium">{formatCurrency(transaction.taxAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Discount:</span>
                  <span className="ml-2 font-medium">{formatCurrency(transaction.discountAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-2 font-bold text-lg">{formatCurrency(transaction.total)}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
