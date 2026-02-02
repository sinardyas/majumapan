import { useEffect, useRef, KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
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

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return (
      <span className="text-xs text-red-500 font-medium">
        Out of stock
      </span>
    );
  }
  if (quantity < 10) {
    return (
      <span className="text-xs text-yellow-600">
        {quantity} left
      </span>
    );
  }
  return (
    <span className="text-xs text-green-600">
      In stock
    </span>
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
        maxWidth: 360,
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
        <>
          <div className="grid grid-cols-2 gap-2 p-2 max-h-64 overflow-y-auto">
            {products.map((product, index) => (
              <button
                key={product.id}
                ref={index === selectedIndex ? firstResultRef : null}
                className={cn(
                  'p-3 rounded-lg text-left transition-colors',
                  index === selectedIndex
                    ? 'bg-primary-100'
                    : 'hover:bg-gray-100'
                )}
                onClick={() => {
                  onSelect(product);
                  onClose();
                }}
                disabled={product.stockQuantity <= 0}
              >
                <div className="font-medium text-sm text-gray-900 truncate">
                  {product.name}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  SKU: {product.sku}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(product.price)}
                  </span>
                  <StockBadge quantity={product.stockQuantity} />
                </div>
              </button>
            ))}
          </div>
          {products.length >= 10 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-500">
              Showing 10 of {products.length} results
            </div>
          )}
        </>
      )}
    </div>
  );
}
