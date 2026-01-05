import { Grid3X3, ShoppingCart } from 'lucide-react';
import { cn } from '@pos/ui';

interface ViewToggleProps {
  value: 'grid' | 'list' | 'cart';
  onChange: (value: 'grid' | 'list' | 'cart') => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn('flex rounded-lg border border-gray-200 p-1 bg-white', className)}>
      <button
        type="button"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'grid'
            ? 'bg-primary-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        )}
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
      >
        <Grid3X3 className="h-4 w-4" />
        <span className="hidden sm:inline">Grid</span>
      </button>
      {/* <button */}
      {/*   type="button" */}
      {/*   className={cn( */}
      {/*     'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', */}
      {/*     value === 'list' */}
      {/*       ? 'bg-primary-600 text-white' */}
      {/*       : 'text-gray-600 hover:bg-gray-100' */}
      {/*   )} */}
      {/*   onClick={() => onChange('list')} */}
      {/*   aria-pressed={value === 'list'} */}
      {/* > */}
      {/*   <List className="h-4 w-4" /> */}
      {/*   <span className="hidden sm:inline">List</span> */}
      {/* </button> */}
      <button
        type="button"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'cart'
            ? 'bg-primary-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        )}
        onClick={() => onChange('cart')}
        aria-pressed={value === 'cart'}
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="hidden sm:inline">Cart</span>
      </button>
    </div>
  );
}
