import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface HoldOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHold: (customerName?: string, note?: string) => void;
  isLoading?: boolean;
}

export function HoldOrderModal({ isOpen, onClose, onHold, isLoading = false }: HoldOrderModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomerName('');
      setNote('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onHold(
      customerName.trim() || undefined,
      note.trim() || undefined
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Hold Order</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isLoading}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Info text */}
            <p className="text-sm text-gray-600">
              Save this order to serve other customers. You can resume it later.
            </p>

            {/* Customer Name */}
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name or reference"
                className="input w-full"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Note */}
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                Note <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="input w-full resize-none"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isLoading}
            >
              Hold Order
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
