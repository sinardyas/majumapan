import { useShiftStore } from '@/stores/shiftStore';
import { ViewToggle } from './ViewToggle';
import { Button } from '@pos/ui';
import { Wifi, Monitor, Calendar } from 'lucide-react';

interface POSHeaderProps {
  viewMode: 'grid' | 'list' | 'cart';
  setViewMode: (mode: 'grid' | 'list' | 'cart') => void;
  isOnline: boolean;
  activeShift: ReturnType<typeof useShiftStore.getState>['activeShift'];
  onOpenShiftModal: () => void;
}

export function POSHeader({ viewMode, setViewMode, isOnline, activeShift, onOpenShiftModal }: POSHeaderProps) {
  const shiftTitle = activeShift ? `Shift ${activeShift.shiftNumber}` : 'Open Shift';

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <ViewToggle value={viewMode} onChange={setViewMode} />

        <div className="flex items-center gap-2">
          {/* Online Status Icon */}
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-lg cursor-help ${
              isOnline ? 'bg-green-100' : 'bg-yellow-100'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          >
            <Wifi className={`h-5 w-5 ${isOnline ? 'text-green-600' : 'text-yellow-600'}`} />
          </div>

          {/* Customer Display Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open('/customer-display', '_blank', 'width=1024,height=768')}
            title="Customer Display"
            className="w-10 h-10"
          >
            <Monitor className="h-5 w-5" />
          </Button>

          {/* Shift Button */}
          <button
            onClick={onOpenShiftModal}
            title={shiftTitle}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
              activeShift
                ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
            }`}
          >
            <Calendar className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
