import { useState, useEffect } from 'react';
import { Button } from '@pos/ui';
import { X, Plus, Minus, ClipboardList, User, Clock } from 'lucide-react';
import type { CartItem, CartDiscount } from '@/stores/cartStore';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

interface CartItemsListProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
}

function CartItemsList({ items, onUpdateQuantity, onRemoveItem }: CartItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-gray-500">
        <p className="text-sm">Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto border-t border-gray-200 max-h-[calc(100vh-400px)]">
      {items.map((item) => {
        const hasPromo = item.promoType && item.promoValue && item.promoMinQty && item.quantity >= item.promoMinQty;
        const promoLabel = hasPromo && item.promoType && item.promoValue
          ? item.promoType === 'percentage'
            ? `${item.promoValue}% OFF`
            : `${formatCurrency(item.promoValue)} OFF`
          : null;

        return (
          <div key={item.productId} className="px-4 py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-3">
                <p className="font-medium text-gray-900 text-sm truncate">{item.productName}</p>
                {hasPromo && promoLabel && (
                  <p className="text-xs text-green-600">{promoLabel}</p>
                )}
                <p className="text-xs text-gray-500">{formatCurrency(item.subtotal)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRemoveItem(item.productId)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="Remove item"
                >
                  <X className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                  className="h-6 w-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                  className="h-6 w-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DiscountSectionProps {
  cartDiscount: CartDiscount | null;
  onApplyDiscount: (code: string) => void;
  onRemoveDiscount: () => void;
  discountError: string;
  setDiscountError: (error: string) => void;
  externalIsApplyingDiscount?: boolean;
}

function DiscountSection({
  cartDiscount,
  onApplyDiscount,
  onRemoveDiscount,
  discountError,
  setDiscountError,
  externalIsApplyingDiscount,
}: DiscountSectionProps) {
  const [discountCode, setDiscountCode] = useState('');
  const isApplying = externalIsApplyingDiscount ?? false;

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    await onApplyDiscount(discountCode);
    setDiscountCode('');
  };

  if (!cartDiscount) {
    return (
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-1">
            <input
              type="text"
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value.toUpperCase());
                setDiscountError('');
              }}
              className="input flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyDiscount();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyDiscount}
              disabled={isApplying || !discountCode.trim()}
            >
              {isApplying ? '...' : 'Apply'}
            </Button>
          </div>
          {discountError && (
            <p className="text-red-500 text-xs">{discountError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200">
      <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-green-800 text-sm font-medium">
            {cartDiscount.code}: -{formatCurrency(cartDiscount.amount)}
          </span>
        </div>
        <button
          onClick={onRemoveDiscount}
          className="text-green-600 hover:text-green-800 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface TotalsSectionProps {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;
}

function TotalsSection({ subtotal, discountAmount, taxAmount, total, cartDiscount }: TotalsSectionProps) {
  return (
    <div className="border-t border-gray-200 p-4 space-y-2">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {cartDiscount && discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{cartDiscount.name}</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Tax (10%)</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

interface ActionButtonsProps {
  onHoldOrder: () => void;
  onClearCart: () => void;
  onPay: () => void;
  total: number;
  hasItems: boolean;
}

function ActionButtons({ onHoldOrder, onClearCart, onPay, total, hasItems }: ActionButtonsProps) {
  const isDisabled = !hasItems;

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
      <Button
        size="lg"
        onClick={onPay}
        disabled={isDisabled}
        className="w-full font-semibold"
      >
        Pay {formatCurrency(total)}
      </Button>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onHoldOrder}
          disabled={isDisabled}
          className="flex-1"
        >
          Hold
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onClearCart}
          disabled={isDisabled}
          className="flex-1"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export interface CurrentOrderProps {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;
  onApplyDiscount: (code: string) => void;
  onRemoveDiscount: () => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onPay: () => void;
  cashierName?: string;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  discountError: string;
  setDiscountError: (error: string) => void;
  isApplyingDiscount?: boolean;
  showDiscountAndTotals?: boolean;
  showItemsList?: boolean;
  items?: CartItem[];
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  onRemoveItem?: (productId: string) => void;
}

export function CurrentOrder({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  cartDiscount,
  onApplyDiscount,
  onRemoveDiscount,
  onClearCart,
  onHoldOrder,
  onPay,
  cashierName,
  heldOrdersCount,
  onOpenHeldOrders,
  discountError,
  setDiscountError,
  isApplyingDiscount,
  showDiscountAndTotals = true,
  showItemsList = true,
  items = [],
  onUpdateQuantity,
  onRemoveItem,
}: CurrentOrderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasItems = subtotal > 0;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Current Order</h2>
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
            <User className="h-3 w-3" />
            <span>{cashierName || 'Unknown'}</span>
            <span className="text-gray-300">|</span>
            <Clock className="h-3 w-3" />
            <span>{formatDateTime(currentTime)}</span>
          </div>
        </div>
        <button
          onClick={onOpenHeldOrders}
          className="relative p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          title="Held Orders"
        >
          <ClipboardList className="h-4 w-4 text-gray-600" />
          {heldOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
              {heldOrdersCount}
            </span>
          )}
        </button>
      </div>

      {showItemsList && (
        <div className="flex-1 min-h-0">
          {items.length > 0 ? (
            <CartItemsList
              items={items}
              onUpdateQuantity={onUpdateQuantity || (() => {})}
              onRemoveItem={onRemoveItem || (() => {})}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-sm">No items currently in the cart</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto bg-white border-t border-gray-200">
        {showDiscountAndTotals && (
          <DiscountSection
            cartDiscount={cartDiscount}
            onApplyDiscount={onApplyDiscount}
            onRemoveDiscount={onRemoveDiscount}
            discountError={discountError}
            setDiscountError={setDiscountError}
            externalIsApplyingDiscount={isApplyingDiscount}
          />
        )}

        {showDiscountAndTotals && (
          <TotalsSection
            subtotal={subtotal}
            discountAmount={discountAmount}
            taxAmount={taxAmount}
            total={total}
            cartDiscount={cartDiscount}
          />
        )}

        <ActionButtons
          onHoldOrder={onHoldOrder}
          onClearCart={onClearCart}
          onPay={onPay}
          total={total}
          hasItems={hasItems}
        />
      </div>
    </div>
  );
}

export type OrderSummaryProps = CurrentOrderProps;
export { CurrentOrder as OrderSummary };
