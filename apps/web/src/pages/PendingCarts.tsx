import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useEODStore } from '@/stores/eodStore';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@pos/ui';
import { Clock, RotateCcw, Trash2, ShoppingCart, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface PendingCartItem {
  cartId: string;
  storeId: string;
  customerName?: string;
  items: Array<{
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
}

export default function PendingCarts() {
  const { user } = useAuthStore();
  const { pendingCarts, fetchPendingCarts, restorePendingCart, voidPendingCart } = useEODStore();
  const { restoreCartFromPending } = useCartStore();
  const [isLoading, setIsLoading] = useState(true);
  const [restoringCart, setRestoringCart] = useState<string | null>(null);

  const operationalDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user?.storeId) {
      fetchPendingCarts(user.storeId, operationalDate).then(() => {
        setIsLoading(false);
      });
    }
  }, [user?.storeId, fetchPendingCarts, operationalDate]);

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRestore = async (cart: typeof pendingCarts[0]) => {
    setRestoringCart(cart.cartId);
    const success = await restorePendingCart(cart.cartId);
    if (success && cart.cartData) {
      await restoreCartFromPending(cart.cartData);
    }
    setRestoringCart(null);
  };

  const handleVoid = async (cartId: string) => {
    if (window.confirm('Are you sure you want to void this cart? This action cannot be undone.')) {
      await voidPendingCart(cartId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Carts</h1>
        <p className="text-gray-600">
          Carts left incomplete from the previous operational day
        </p>
      </div>

      {pendingCarts.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending carts</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no incomplete carts from previous days.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingCarts.map((cart) => {
            try {
              const cartData = JSON.parse(cart.cartData) as PendingCartItem;
              
              return (
                <div
                  key={cart.cartId}
                  className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {formatDateTime(cart.createdAt.toString())}
                      </span>
                      {cartData.customerName && (
                        <span className="text-sm text-gray-500">
                          • {cartData.customerName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(cart)}
                        disabled={restoringCart === cart.cartId}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {restoringCart === cart.cartId ? 'Restoring...' : 'Restore'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVoid(cart.cartId)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Void
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="space-y-2">
                      {cartData.items.map((item, index) => (
                        <div
                          key={`${item.productSku}-${index}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">×{item.quantity}</span>
                            <span className="font-medium">{item.productName}</span>
                          </div>
                          <span className="text-gray-600">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>{cartData.items.length} items</span>
                      </div>
                      <span className="text-lg font-semibold">
                        {formatCurrency(cartData.total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            } catch (error) {
              return (
                <div
                  key={cart.cartId}
                  className="bg-red-50 rounded-lg border border-red-200 p-4"
                >
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <span>Error parsing cart data</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleVoid(cart.cartId)}
                  >
                    Remove invalid cart
                  </Button>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
