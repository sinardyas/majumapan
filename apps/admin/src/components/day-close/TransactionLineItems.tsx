import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { TransactionItem } from '@pos/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@pos/ui';

interface TransactionLineItemsProps {
  transactionId: string;
  dayCloseId: string;
}

interface ItemsResponse {
  items: TransactionItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function TransactionLineItems({ transactionId, dayCloseId }: TransactionLineItemsProps) {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems(1);
  }, [transactionId]);

  const loadItems = async (page: number) => {
    setLoading(true);
    try {
      const response = await api.get<ItemsResponse>(
        `/day-close/${dayCloseId}/transactions/${transactionId}/items`,
        { queryParams: { page, pageSize: 20 } }
      );

      if (response.success && response.data) {
        setItems(response.data.items);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading line items:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No line items found
      </div>
    );
  }

  const startItem = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1;
  const endItem = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : items.length;

  return (
    <div>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Qty
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit Price
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Discount
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {item.productName}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-xs font-mono text-gray-500">
                {item.productSku}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                {item.quantity}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-red-500 text-right">
                {item.discountValue > 0 ? `-${formatCurrency(item.discountValue)}` : '-'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                {formatCurrency(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-3 flex justify-between items-center text-sm text-gray-500">
          <span>Items {startItem}-{endItem} of {pagination.total}</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page === 1}
              onClick={() => loadItems(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => loadItems(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
