import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { ChevronDown, Building2 } from 'lucide-react';

interface Store {
  id: string;
  name: string;
  isActive: boolean;
}

interface StoresListData {
  items: Store[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function StoreSelector() {
  const { user, selectedStoreId, selectedStoreName, setSelectedStore } = useAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStores();
    } else {
      setIsLoading(false);
    }
  }, [user?.role]);

  const fetchStores = async () => {
    try {
      const response = await api.get<StoresListData>('/stores');
      if (response.success && response.data) {
        setStores(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (store: Store | { id: 'all'; name: string; isActive: boolean }) => {
    setSelectedStore(store.id, store.name);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="w-48 h-10 bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
    );
  }

  const options = [
    { id: 'all' as const, name: 'All Stores', isActive: true },
    ...stores,
  ];

  const currentLabel = selectedStoreId === 'all'
    ? 'All Stores'
    : selectedStoreName || stores.find(s => s.id === selectedStoreId)?.name || 'Select Store';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[160px]"
      >
        <Building2 className="h-4 w-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 truncate flex-1 text-left">
          {currentLabel}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
            {options.map((store) => (
              <button
                key={store.id}
                onClick={() => handleSelect(store)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                  selectedStoreId === store.id
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700'
                } ${!store.isActive && store.id !== 'all' ? 'opacity-50' : ''}`}
              >
                <span className="truncate">{store.name}</span>
                {store.id === 'all' && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    Global
                  </span>
                )}
                {!store.isActive && store.id !== 'all' && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
