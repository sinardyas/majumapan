import { useEffect, useRef, KeyboardEvent } from 'react';
import { Plus, Tag } from 'lucide-react';
import { Button } from '@pos/ui';
import { cn } from '@pos/ui';
import type { LocalProduct } from '@/db';

interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
}

function isPromoActive(product: LocalProduct): boolean {
  if (!product.hasPromo) return false;
  
  const now = new Date();
  
  if (product.promoStartDate && new Date(product.promoStartDate) > now) {
    return false;
  }
  
  if (product.promoEndDate && new Date(product.promoEndDate) < now) {
    return false;
  }
  
  return true;
}

function getPromoLabel(product: LocalProduct): string | null {
  if (!product.hasPromo || !product.promoType || product.promoValue === null) {
    return null;
  }
  
  if (!isPromoActive(product)) {
    return null;
  }
  
  if (product.promoType === 'percentage') {
    return `${product.promoValue}% OFF`;
  } else {
    return `$${product.promoValue} OFF`;
  }
}

interface ProductListProps {
  products: ProductWithStock[];
  selectedIndex: number;
  onSelect: (product: ProductWithStock) => void;
  onSelectIndex: (index: number) => void;
  className?: string;
}

function StockIndicator({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return <span className="text-red-500 font-medium">0</span>;
  }
  if (quantity < 10) {
    return <span className="text-yellow-600 font-medium">{quantity}</span>;
  }
  return <span className="text-green-600 font-medium">{quantity}</span>;
}

export function ProductList({
  products,
  selectedIndex,
  onSelect,
  onSelectIndex,
  className,
}: ProductListProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
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
      case 'Home':
        e.preventDefault();
        onSelectIndex(0);
        break;
      case 'End':
        e.preventDefault();
        onSelectIndex(products.length - 1);
        break;
    }
  };

  if (products.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-gray-500', className)}>
        No products found
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <table
        ref={tableRef}
        className="w-full"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label="Product list"
      >
        <thead>
          <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <th className="px-4 py-3 w-24">SKU</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3 w-24 text-right">Price</th>
            <th className="px-4 py-3 w-20 text-right">Stock</th>
            <th className="px-4 py-3 w-16 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((product, index) => (
            <tr
              key={product.id}
              ref={index === selectedIndex ? selectedRowRef : null}
              className={cn(
                'transition-colors cursor-pointer',
                index === selectedIndex
                  ? 'bg-primary-50'
                  : 'hover:bg-gray-50'
              )}
              onClick={() => {
                onSelectIndex(index);
                onSelect(product);
              }}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <td className="px-4 py-3 font-mono text-sm text-gray-600">
                {product.sku}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 truncate max-w-xs">
                  {product.name}
                </div>
                {getPromoLabel(product) && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Tag className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-500 font-medium">
                      {getPromoLabel(product)}
                      {product.promoMinQty > 1 && ` (Min ${product.promoMinQty})`}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                ${product.price.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                <StockIndicator quantity={product.stockQuantity} />
              </td>
              <td className="px-4 py-3 text-center">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={product.stockQuantity <= 0}
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(product);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
