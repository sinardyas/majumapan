import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { getHeldOrdersForCashier, type HeldOrder } from '@/db';

interface HeldOrdersListProps {
  isOpen: boolean;
  onClose: () => void;
  onResume: (heldOrderId: string) => void;
  onDelete: (heldOrderId: string) => void;
  storeId: string;
  cashierId: string;
}

export function HeldOrdersList({
  isOpen,
  onClose,
  onResume,
  onDelete,
  storeId,
  cashierId,
}: HeldOrdersListProps) {
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch held orders when modal opens
  useEffect(() => {
    const fetchHeldOrders = async () => {
      if (!isOpen || !storeId || !cashierId) return;
      
      setIsLoading(true);
      try {
        const orders = await getHeldOrdersForCashier(storeId, cashierId);
        setHeldOrders(orders);
      } catch (error) {
        console.error('Error fetching held orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeldOrders();
  }, [isOpen, storeId, cashierId]);

  // Reset delete confirmation when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatOrderTitle = (order: HeldOrder): string => {
    if (order.customerName) {
      return order.customerName;
    }
    return `Order at ${format(new Date(order.heldAt), 'h:mm a')}`;
  };

  const handleDeleteClick = (orderId: string) => {
    setDeleteConfirmId(orderId);
  };

  const handleConfirmDelete = (orderId: string) => {
    onDelete(orderId);
    setHeldOrders(prev => prev.filter(o => o.id !== orderId));
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleResume = (orderId: string) => {
    onResume(orderId);
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold">Held Orders</h2>
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
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : heldOrders.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12">
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No held orders</h3>
              <p className="text-gray-500 text-sm">
                Hold an order to serve other customers and resume later
              </p>
            </div>
          ) : (
            /* Orders List */
            <div className="space-y-3">
              {heldOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                >
                  {/* Order Info */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {formatOrderTitle(order)}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'} - {formatCurrency(order.total)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {formatDistanceToNow(new Date(order.heldAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Note */}
                  {order.note && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      Note: {order.note}
                    </p>
                  )}

                  {/* Actions */}
                  {deleteConfirmId === order.id ? (
                    /* Delete Confirmation */
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700 mb-3">
                        Delete this held order? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleCancelDelete}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-red-600 hover:bg-red-700"
                          onClick={() => handleConfirmDelete(order.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Actions */
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleResume(order.id)}
                      >
                        Resume
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteClick(order.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Orders automatically expire after 24 hours
          </p>
        </div>
      </div>
    </div>
  );
}
