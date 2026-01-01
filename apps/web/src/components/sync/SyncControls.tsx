import { useSyncStore } from '@/stores/syncStore';
import { Button } from '@pos/ui';
import { RefreshCw, CheckSquare, Square } from 'lucide-react';

const entities = [
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'transactions', label: 'Transactions' },
] as const;

export function SyncControls() {
  const {
    selectedEntities,
    isSyncing,
    toggleEntity,
    selectAllEntities,
    clearEntitySelection,
    fullSync,
  } = useSyncStore();

  const handleForceSync = async () => {
    const entitiesToSync = Array.from(selectedEntities);
    if (entitiesToSync.length > 0) {
      await fullSync(entitiesToSync);
    }
  };

  const allSelected = entities.length === selectedEntities.size;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-3">Sync Options</h3>

      <div className="flex flex-wrap gap-2 mb-4">
        {entities.map(({ key, label }) => {
          const isSelected = selectedEntities.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleEntity(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="text-sm">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={allSelected ? clearEntitySelection : selectAllEntities}
          variant="outline"
          size="sm"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>

        <Button
          onClick={handleForceSync}
          isLoading={isSyncing}
          disabled={selectedEntities.size === 0 || isSyncing}
          className="flex-1"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Force Sync Selected
        </Button>
      </div>
    </div>
  );
}
