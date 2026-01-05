import { useState, useEffect, KeyboardEvent } from 'react';
import { Search, X, Trash2, Plus, Minus, Check, Clock, User, ClipboardList } from 'lucide-react';
import { Button } from '@pos/ui';
import type { LocalProduct } from '@/db';
import type { CartItem, CartDiscount } from '@/stores/cartStore';
import { SkuSearchPopover } from './SkuSearchPopover';

interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
}

interface CartViewProps {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyDiscount: (code: string) => void;
  onRemoveDiscount: () => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onPay: () => void;
  skuSearchQuery: string;
  setSkuSearchQuery: (query: string) => void;
  skuSearchOpen: boolean;
  setSkuSearchOpen: (open: boolean) => void;
  skuSearchResults: ProductWithStock[];
  popoverSelectedIndex: number;
  setPopoverSelectedIndex: (index: number) => void;
  onProductSelect: (product: ProductWithStock) => void;
  skuInputRef: React.RefObject<HTMLInputElement>;
  cashierName: string;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  totalPromoDiscount: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

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

function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  const hasPromo = item.promoType && item.promoValue && item.promoMinQty && item.quantity >= item.promoMinQty;
  const promoLabel = hasPromo && item.promoType && item.promoValue
    ? item.promoType === 'percentage'
      ? `${item.promoValue}% OFF`
      : `${formatCurrency(item.promoValue)} OFF`
    : null;

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="font-medium text-gray-900 truncate">{item.productName}</h4>
          <p className="text-sm text-gray-500">
            {formatCurrency(item.unitPrice)} each
            {promoLabel && (
              <span className="ml-2 text-green-600 font-medium">({promoLabel})</span>
            )}
          </p>
        </div>
        <button
          onClick={() => onRemove(item.productId)}
          className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
          title="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="text-right">
          <span className="font-bold text-gray-900">
            {formatCurrency(item.subtotal)}
          </span>
          {hasPromo && item.promoDiscount && item.promoDiscount > 0 && (
            <p className="text-xs text-green-600">
              Save {formatCurrency(item.promoDiscount)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderSummary({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  cartDiscount,
  cashierName,
  onRemoveDiscount,
  onApplyDiscount,
  onHoldOrder,
  onClearCart,
  onPay,
  items,
  heldOrdersCount,
  onOpenHeldOrders,
  totalPromoDiscount,
}: {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;
  cashierName?: string;
  onRemoveDiscount: () => void;
  onApplyDiscount: (code: string) => void;
  onHoldOrder: () => void;
  onClearCart: () => void;
  onPay: () => void;
  items: CartItem[];
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  totalPromoDiscount: number;
}) {
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setIsApplyingDiscount(true);
    try {
      await onApplyDiscount(discountCode);
      setDiscountCode('');
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Summary Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Order Summary</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>{cashierName || 'Unknown Cashier'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
            <Clock className="h-4 w-4" />
            <span>{formatDateTime(currentTime)}</span>
          </div>
        </div>
        
        {/* Held Orders Button */}
        <button
          onClick={onOpenHeldOrders}
          className="relative p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Held Orders"
        >
          <ClipboardList className="h-5 w-5 text-gray-600" />
          {heldOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {heldOrdersCount}
            </span>
          )}
        </button>
      </div>

      {/* Discount Section */}
      <div className="p-4 border-b border-gray-200">
        {!cartDiscount ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyDiscount}
              disabled={!discountCode.trim() || isApplyingDiscount}
            >
              Apply
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-800 text-sm font-medium">
                {cartDiscount.code}: -{formatCurrency(discountAmount)}
              </span>
            </div>
            <button
              onClick={onRemoveDiscount}
              className="text-green-600 hover:text-green-800 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex-1 p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {totalPromoDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Promo Savings</span>
              <span>-{formatCurrency(totalPromoDiscount)}</span>
            </div>
          )}
          {cartDiscount && discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>{cartDiscount.name}</span>
              <span>-{formatCurrency(discountAmount - totalPromoDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Tax (10%)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t border-gray-200 mt-2">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex gap-2">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              size="lg"
              onClick={onHoldOrder}
              disabled={items.length === 0}
              className="flex-1"
            >
              Hold
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onClearCart}
              disabled={items.length === 0}
              className="flex-1"
            >
              Clear
            </Button>
          </div>
          <Button
            size="lg"
            onClick={onPay}
            disabled={items.length === 0}
            className="flex-1 font-semibold"
          >
            Pay {formatCurrency(total)}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CartView({
  items,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  cartDiscount,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onRemoveDiscount,
  onClearCart,
  onHoldOrder,
  onPay,
  skuSearchQuery,
  setSkuSearchQuery,
  skuSearchOpen,
  setSkuSearchOpen,
  skuSearchResults,
  popoverSelectedIndex,
  setPopoverSelectedIndex,
  onProductSelect,
  skuInputRef,
  cashierName,
  heldOrdersCount,
  onOpenHeldOrders,
  totalPromoDiscount,
}: CartViewProps) {
  const handlePopoverKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setPopoverSelectedIndex(Math.max(0, popoverSelectedIndex - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPopoverSelectedIndex(
          Math.min(skuSearchResults.length - 1, popoverSelectedIndex + 1)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (skuSearchResults[popoverSelectedIndex]) {
          onProductSelect(skuSearchResults[popoverSelectedIndex]);
          setSkuSearchOpen(false);
          setSkuSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSkuSearchOpen(false);
        skuInputRef.current?.focus();
        break;
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Cart Items (65%) */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* SKU Search Input */}
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <div className="relative w-full">
            <input
              ref={skuInputRef}
              type="text"
              placeholder="Enter SKU or barcode to add items..."
              value={skuSearchQuery}
              onChange={(e) => setSkuSearchQuery(e.target.value)}
              onKeyDown={handlePopoverKeyDown}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg shadow-sm"
              autoFocus
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            {skuSearchQuery && (
              <button
                onClick={() => {
                  setSkuSearchQuery('');
                  setSkuSearchOpen(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <SkuSearchPopover
              query={skuSearchQuery}
              isOpen={skuSearchOpen}
              onClose={() => {
                setSkuSearchOpen(false);
                skuInputRef.current?.focus();
              }}
              products={skuSearchResults}
              selectedIndex={popoverSelectedIndex}
              onSelect={(product) => {
                onProductSelect(product);
                setSkuSearchOpen(false);
                setSkuSearchQuery('');
              }}
              onSelectIndex={setPopoverSelectedIndex}
              anchorRef={skuInputRef}
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                <Search className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-lg text-gray-500">Cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Enter a SKU above to add items</p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {items.map((item) => (
                <CartItemCard
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Order Summary (35%) */}
      <div className="w-[35%] min-w-[300px] max-w-[400px] h-full flex-shrink-0">
        <OrderSummary
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          total={total}
          cartDiscount={cartDiscount}
          cashierName={cashierName}
          onRemoveDiscount={onRemoveDiscount}
          onApplyDiscount={onApplyDiscount}
          onHoldOrder={onHoldOrder}
          onClearCart={onClearCart}
          onPay={onPay}
          items={items}
          heldOrdersCount={heldOrdersCount}
          onOpenHeldOrders={onOpenHeldOrders}
          totalPromoDiscount={totalPromoDiscount}
        />
      </div>
    </div>
  );
}
