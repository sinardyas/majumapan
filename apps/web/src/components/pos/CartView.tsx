import { KeyboardEvent } from 'react';
import { Search, X, Trash2, Plus, Minus } from 'lucide-react';
import type { LocalProduct } from '@/db';
import type { CartItem } from '@/stores/cartStore';
import { SkuSearchPopover } from './SkuSearchPopover';

interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
}

interface CartViewProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  skuSearchQuery: string;
  setSkuSearchQuery: (query: string) => void;
  skuSearchOpen: boolean;
  setSkuSearchOpen: (open: boolean) => void;
  skuSearchResults: ProductWithStock[];
  popoverSelectedIndex: number;
  setPopoverSelectedIndex: (index: number) => void;
  onProductSelect: (product: ProductWithStock) => void;
  skuInputRef: React.RefObject<HTMLInputElement>;
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
          {hasPromo ? (
            <div className="flex items-center gap-1 text-sm flex-nowrap">
              <span className="text-gray-500 line-through flex-shrink-0">
                {formatCurrency(item.unitPrice)}
              </span>
              <span className="text-gray-900 flex-shrink-0">→</span>
              <span className="text-green-600 font-medium flex-shrink-0">
                {formatCurrency(item.promoValue ? item.unitPrice * (1 - item.promoValue / 100) : item.unitPrice)}
              </span>
              {promoLabel && (
                <span className="text-xs text-green-600 flex-shrink-0">({promoLabel})</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {formatCurrency(item.unitPrice)} each
            </p>
          )}
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
        <span className="font-bold text-gray-900">
          {formatCurrency(item.subtotal)}
        </span>
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function CartView({
  items,
  onUpdateQuantity,
  onRemoveItem,
  skuSearchQuery,
  setSkuSearchQuery,
  skuSearchOpen,
  setSkuSearchOpen,
  skuSearchResults,
  popoverSelectedIndex,
  setPopoverSelectedIndex,
  onProductSelect,
  skuInputRef,
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
    <div className="flex-1 flex flex-col bg-gray-50">
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

      <div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-210px)]">
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
  );
}
