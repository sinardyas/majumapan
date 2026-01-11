import { KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { SkuSearchPopover } from './SkuSearchPopover';
import type { LocalProduct } from '@/db';

interface ProductWithStock extends LocalProduct {
  stockQuantity: number;
}

interface POSSearchBarProps {
  viewMode: 'grid' | 'list';
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  skuSearchQuery: string;
  setSkuSearchQuery: (value: string) => void;
  skuInputRef: React.RefObject<HTMLInputElement>;
  handlePopoverKeyDown: (e: KeyboardEvent) => void;
  skuSearchOpen: boolean;
  setSkuSearchOpen: (open: boolean) => void;
  skuSearchResults: ProductWithStock[];
  popoverSelectedIndex: number;
  setPopoverSelectedIndex: (index: number) => void;
  onProductSelect: (product: ProductWithStock) => void;
}

export function POSSearchBar({
  viewMode,
  searchQuery,
  setSearchQuery,
  skuSearchQuery,
  setSkuSearchQuery,
  skuInputRef,
  handlePopoverKeyDown,
  skuSearchOpen,
  setSkuSearchOpen,
  skuSearchResults,
  popoverSelectedIndex,
  setPopoverSelectedIndex,
  onProductSelect,
}: POSSearchBarProps) {
  return (
    <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      {viewMode === 'grid' && (
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search products or scan barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg shadow-sm"
            autoFocus
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
      )}

      {viewMode === 'list' && (
        <div className="relative w-full">
          <input
            ref={skuInputRef}
            type="text"
            placeholder="Enter SKU or barcode..."
            value={skuSearchQuery}
            onChange={(e) => setSkuSearchQuery(e.target.value)}
            onKeyDown={handlePopoverKeyDown}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg shadow-sm"
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
            onSelect={onProductSelect}
            onSelectIndex={setPopoverSelectedIndex}
            anchorRef={skuInputRef}
          />
        </div>
      )}
    </div>
  );
}
