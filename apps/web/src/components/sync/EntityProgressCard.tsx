import { RefreshCw } from 'lucide-react';

interface EntityProgressCardProps {
  entity: 'products' | 'categories' | 'transactions' | 'stock';
  synced: number;
  pending: number;
  rejected?: number;
  isLoading?: boolean;
}

const entityLabels: Record<string, string> = {
  products: 'Products',
  categories: 'Categories',
  transactions: 'Transactions',
  stock: 'Stock'
};

const entityColors: Record<string, string> = {
  products: 'bg-blue-500',
  categories: 'bg-green-500',
  transactions: 'bg-purple-500',
  stock: 'bg-amber-500'
};

export function EntityProgressCard({
  entity,
  synced,
  pending,
  rejected = 0,
  isLoading = false,
}: EntityProgressCardProps) {
  const total = synced + pending;
  const percentage = total > 0 ? Math.round((synced / total) * 100) : 100;
  const hasPending = pending > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{entityLabels[entity]}</h3>
        {isLoading && (
          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${entityColors[entity]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-sm">
        <span className="text-gray-600">
          {synced.toLocaleString()} synced
        </span>
        {hasPending && (
          <span className="text-amber-600 font-medium">
            {pending.toLocaleString()} pending
          </span>
        )}
        {!hasPending && (
          <span className="text-green-600 font-medium">All synced</span>
        )}
      </div>

      {entity === 'transactions' && rejected > 0 && (
        <div className="mt-2 text-sm text-red-600">
          {rejected.toLocaleString()} rejected
        </div>
      )}
    </div>
  );
}
