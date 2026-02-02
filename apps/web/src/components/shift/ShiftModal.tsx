import { useState, useEffect } from 'react';
import { Button, Input } from '@pos/ui';
import { useToast } from '@pos/ui';
import { useShiftStore } from '@/stores/shiftStore';
import { useAuthStore } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatCurrency } from '@/hooks/useCurrencyConfig';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'open' | 'close';
  onOpenSuccess?: () => void;
}

export function ShiftModal({ isOpen, onClose, mode, onOpenSuccess }: ShiftModalProps) {
  const { activeShift, openShift, closeShift, verifySupervisorAndClose, isOpening, isClosing, error, clearError, requiresSupervisorApproval, pendingVariance } = useShiftStore();
  const { user } = useAuthStore();
  const { isOnline } = useOnlineStatus();
  const toast = useToast();

  const [floatAmount, setFloatAmount] = useState<string>('');
  const [openingNote, setOpeningNote] = useState<string>('');
  const [endingCash, setEndingCash] = useState<string>('');
  const [closingNote, setClosingNote] = useState<string>('');
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [localError, setLocalError] = useState<string>('');

  useEffect(() => {
    if (isOpen && mode === 'open') {
      setFloatAmount('');
      setOpeningNote('');
      setLocalError('');
      clearError();
    } else if (isOpen && mode === 'close' && activeShift) {
      setEndingCash(activeShift.openingFloat.toFixed(2));
      setClosingNote('');
      setVarianceReason('');
      setSupervisorPin('');
      setLocalError('');
      clearError();
    }
  }, [isOpen, mode, activeShift, clearError]);

  const handleOpenShift = async () => {
    const float = parseFloat(floatAmount);
    if (isNaN(float) || float < 0) {
      setLocalError('Please enter a valid float amount');
      return;
    }

    const result = await openShift(user?.storeId ?? '', {
      floatAmount: float,
      note: openingNote || undefined,
    });

    if (result.success) {
      toast.success('Shift opened successfully');
      onClose();
      onOpenSuccess?.();
    } else {
      setLocalError(result.error || 'Failed to open shift');
    }
  };

  const handleCloseShift = async () => {
    const ending = parseFloat(endingCash);
    if (isNaN(ending) || ending < 0) {
      setLocalError('Please enter a valid ending cash amount');
      return;
    }

    if (requiresSupervisorApproval && pendingVariance !== null && pendingVariance >= 5) {
      if (!supervisorPin || supervisorPin.length !== 4) {
        setLocalError('Please enter supervisor PIN');
        return;
      }

      const result = await verifySupervisorAndClose(supervisorPin, {
        endingCash: ending,
        note: closingNote || undefined,
        varianceReason: varianceReason || undefined,
      });

      if (result.success) {
        toast.success('Shift closed successfully');
        onClose();
      } else {
        setLocalError(result.error || 'Failed to close shift');
      }
    } else {
      const result = await closeShift({
        endingCash: ending,
        note: closingNote || undefined,
        varianceReason: varianceReason || undefined,
      });

      if (result.success) {
        onClose();
      } else {
        setLocalError(result.error || 'Failed to close shift');
      }
    }
  };

  const calculateVariance = () => {
    if (!activeShift) return 0;
    const ending = parseFloat(endingCash) || 0;
    return ending - activeShift.openingFloat;
  };

  if (!isOpen) return null;

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">
              {mode === 'open' ? 'Open Shift' : 'Close Shift'}
            </h2>
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Offline - Will sync when online
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {mode === 'open' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Float Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={floatAmount}
                  onChange={(e) => setFloatAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-2xl font-semibold"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter the starting cash float for your shift
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <textarea
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  placeholder="Any notes about the shift..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shift Number:</span>
                  <span className="font-medium">{activeShift?.shiftNumber}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Opening Float:</span>
                  <span className="font-medium">{formatCurrency(activeShift?.openingFloat ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Opened at:</span>
                  <span className="font-medium">
                    {activeShift?.openingTimestamp
                      ? new Date(activeShift.openingTimestamp).toLocaleTimeString()
                      : '-'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ending Cash Count
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={endingCash}
                  onChange={(e) => setEndingCash(e.target.value)}
                  placeholder="0.00"
                  className="text-2xl font-semibold"
                />
              </div>

              {activeShift && (
                <div className={`p-4 rounded-lg ${
                  calculateVariance() >= 5 ? 'bg-red-50 border border-red-200' :
                  calculateVariance() >= 1 ? 'bg-yellow-50 border border-yellow-200' :
                  calculateVariance() >= -1 ? 'bg-green-50 border border-green-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Variance:</span>
                    <span className={`text-lg font-semibold ${
                      calculateVariance() >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {calculateVariance() >= 0 ? '+' : ''}{formatCurrency(calculateVariance())}
                    </span>
                  </div>

                  {calculateVariance() >= 1 && calculateVariance() < 5 && (
                    <p className="text-xs text-yellow-700 mt-2">
                      Variance {formatCurrency(1)}-{formatCurrency(5)} requires a note
                    </p>
                  )}

                  {calculateVariance() >= 5 && (
                    <>
                      <p className="text-xs text-red-700 mt-2">
                        Variance ≥{formatCurrency(5)} requires supervisor approval
                      </p>

                      {requiresSupervisorApproval && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Supervisor PIN
                            </label>
                            <Input
                              type="password"
                              maxLength={4}
                              value={supervisorPin}
                              onChange={(e) => setSupervisorPin(e.target.value)}
                              placeholder="Enter PIN"
                              className="text-center tracking-widest"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Variance Reason
                            </label>
                            <textarea
                              value={varianceReason}
                              onChange={(e) => setVarianceReason(e.target.value)}
                              placeholder="Explain the variance..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {calculateVariance() < 1 && calculateVariance() >= -1 && (
                    <p className="text-xs text-green-700 mt-2">
                      Variance &lt;{formatCurrency(1)} is automatically forgiven
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Closing Note (optional)
                </label>
                <textarea
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="Any notes about the shift..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {displayError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{displayError}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isOpening || isClosing}>
            Cancel
          </Button>
          {mode === 'open' ? (
            <Button
              onClick={handleOpenShift}
              disabled={isOpening || !floatAmount}
              isLoading={isOpening}
            >
              Open Shift
            </Button>
          ) : (
            <Button
              onClick={handleCloseShift}
              disabled={isClosing || !endingCash}
              isLoading={isClosing}
            >
              Close Shift
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
