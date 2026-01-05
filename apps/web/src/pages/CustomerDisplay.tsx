import { useAuthStore } from '@/stores/authStore';
import { useCartStore, type CartItem } from '@/stores/cartStore';
import { TAX_RATE, CURRENCY } from '@pos/shared';
import { PromotionCarousel } from '@/components/promotions';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
  }).format(amount);
}

function CartItemRow({ item }: { item: CartItem }) {
  const hasDiscount = item.discountValue > 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="bg-primary-100 text-primary-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shrink-0">
          {item.quantity}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-gray-900 truncate">
            {item.productName}
          </p>
          {hasDiscount && item.discountName && (
            <p className="text-xs text-green-600 truncate">
              {item.discountName}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-lg font-bold text-gray-900">
          {formatCurrency(item.subtotal)}
        </p>
        {hasDiscount && (
          <p className="text-xs text-green-600">
            -{formatCurrency(item.discountValue)}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyCartState() {
  return (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      <p className="text-xl">Your cart is empty</p>
    </div>
  );
}

export default function CustomerDisplay() {
  const { user } = useAuthStore();
  const { items, subtotal, discountAmount, taxAmount, total } =
    useCartStore();

  return (
    <div className="h-screen flex flex-row">
      {/* Left Side - Promotion Banner (66.6% width) */}
      <div className="w-[66.6%] h-full">
        <PromotionCarousel />
      </div>

      {/* Right Side - Cart Area (33.4% width) */}
      <div className="w-[33.4%] h-full bg-white flex flex-col">
        {/* Cashier Name */}
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-right text-sm text-gray-500">
            Cashier: <span className="font-medium text-gray-700">{user?.name || 'Staff'}</span>
          </p>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <EmptyCartState />
          ) : (
            <div className="py-4">
              {items.map((item) => (
                <CartItemRow key={item.productId} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="px-6 py-6 border-t border-gray-200 bg-gray-50">
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-300">
              <span className="text-xl font-bold text-gray-900">TOTAL</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
