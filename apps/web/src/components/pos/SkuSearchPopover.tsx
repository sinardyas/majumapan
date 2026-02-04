import { useEffect, useRef, KeyboardEvent } from 'react';
import { Search, Box } from 'lucide-react';
import { cn } from '@pos/ui';
import type { LocalProduct } from '@/db';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
}

interface SkuSearchPopoverProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  products: ProductWithStock[];
  selectedIndex: number;
  onSelect: (product: ProductWithStock) => void;
  onSelectIndex: (index: number) => void;
  anchorRef: React.RefObject<HTMLInputElement>;
}

function isPromoActive(product: ProductWithStock): boolean {
  if (!product.hasPromo) return false;
  const now = new Date();
  if (product.promoStartDate && new Date(product.promoStartDate) > now) return false;
  if (product.promoEndDate && new Date(product.promoEndDate) < now) return false;
  return true;
}

function getPromoLabel(product: ProductWithStock): string | null {
  if (!isPromoActive(product) || !product.promoType || !product.promoValue) {
    return null;
  }
  return product.promoType === 'percentage'
    ? `${product.promoValue}% OFF`
    : `${formatCurrency(product.promoValue)} OFF`;
}

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return (
      <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">
        Out of stock
      </span>
    );
  }
  if (quantity < 10) {
    return (
      <span className="text-xs text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded">
        {quantity} left
      </span>
    );
  }
  return (
    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
      {quantity} in stock
    </span>
  );
}

function ProductListItem({
  product,
  isSelected,
  onClick,
}: {
  product: ProductWithStock;
  isSelected: boolean;
  onClick: () => void;
}) {
  const promoLabel = getPromoLabel(product);
  const hasPromo = promoLabel !== null;
  const discountedPrice = hasPromo && product.promoValue
    ? product.price * (1 - product.promoValue / 100)
    : null;

  return (
    <button
      className={cn(
        'w-full text-left p-3 border-b border-gray-100 transition-colors flex gap-3',
        isSelected ? 'bg-primary-50' : 'hover:bg-gray-50',
        product.stockQuantity <= 0 && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={product.stockQuantity <= 0}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
        {product.imageBase64 ? (
          <img
            src={product.imageBase64}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="h-5 w-5 text-gray-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 truncate">
              {product.name}
            </h4>
            <p className="text-xs text-gray-500">
              SKU: {product.sku}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            {hasPromo && discountedPrice !== null ? (
              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-400 line-through">
                  {formatCurrency(product.price)}
                </span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(discountedPrice)}
                </span>
              </div>
            ) : (
              <span className="font-bold text-gray-900">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5">
          {hasPromo && (
            <span className="text-xs text-green-600 font-medium">
              {promoLabel}
              {product.promoMinQty > 1 && ` (min ${product.promoMinQty})`}
            </span>
          )}
          <StockBadge quantity={product.stockQuantity} />
        </div>
      </div>
    </button>
  );
}

export function SkuSearchPopover({
  query,
  isOpen,
  onClose,
  products,
  selectedIndex,
  onSelect,
  onSelectIndex,
  anchorRef,
}: SkuSearchPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const firstResultRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && products.length > 0) {
      firstResultRef.current?.focus();
    }
  }, [isOpen, products.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        event.stopPropagation();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        onSelectIndex(Math.max(0, selectedIndex - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        onSelectIndex(Math.min(products.length - 1, selectedIndex + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (products[selectedIndex]) {
          onSelect(products[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        anchorRef.current?.focus();
        break;
    }
  };

  if (!isOpen || !query.trim()) {
    return null;
  }

  const anchorRect = anchorRef.current?.getBoundingClientRect();
  const popoverStyle: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        width: anchorRect.width,
        maxWidth: 400,
        zIndex: 50,
      }
    : {};

  return (
    <div
      ref={popoverRef}
      className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
      style={popoverStyle}
      onKeyDown={handleKeyDown}
    >
      {products.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-500">
          <Search className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No products found for "{query}"</p>
        </div>
      ) : (
        <div className="flex flex-col max-h-[800px] overflow-y-auto">
          {products.map((product, index) => (
            <ProductListItem
              key={product.id}
              product={product}
              isSelected={index === selectedIndex}
              onClick={() => {
                onSelect(product);
              }}
            />
          ))}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-500">
            {products.length} result{products.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
