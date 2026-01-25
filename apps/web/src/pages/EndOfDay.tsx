import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useEODStore } from '@/stores/eodStore';
import { Button } from '@pos/ui';
import { 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { PreEODSummary } from '@/components/eod/PreEODSummary';
import { EODConfirmationModal } from '@/components/eod/EODConfirmationModal';
import { DayClosedOverlay } from '@/components/eod/DayClosedOverlay';

export default function EndOfDay() {
  const { user } = useAuthStore();
  const { 
    preEODSummary, 
    fetchPreEODSummary, 
    executeEOD, 
    currentDayClose,
    isLoading,
    error,
    clearError
  } = useEODStore();
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDayClosed, setIsDayClosed] = useState(false);

  const operationalDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user?.storeId) {
      fetchPreEODSummary(user.storeId);
    }
  }, [user?.storeId, fetchPreEODSummary]);

  useEffect(() => {
    if (currentDayClose) {
      setIsDayClosed(true);
    }
  }, [currentDayClose]);

  const handlePrepareEOD = () => {
    if (preEODSummary) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmEOD = async () => {
    if (user?.storeId) {
      await executeEOD(user.storeId, operationalDate);
      setShowConfirmation(false);
      setIsDayClosed(true);
    }
  };

  if (isDayClosed && currentDayClose) {
    return <DayClosedOverlay dayClose={currentDayClose} />;
  }

  if (isLoading && !preEODSummary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">End of Day</h1>
        <p className="text-gray-600">
          Review today's summary and close the operational day
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {!preEODSummary ? (
        <div className="text-center py-12">
          <Button onClick={() => fetchPreEODSummary(user?.storeId || '')}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Load Pre-EOD Summary
          </Button>
        </div>
      ) : (
        <>
          <PreEODSummary summary={preEODSummary} />

          <div className="mt-6 flex justify-end space-x-4">
            <Button variant="outline" onClick={() => fetchPreEODSummary(user?.storeId || '')}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handlePrepareEOD}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm End of Day
            </Button>
          </div>
        </>
      )}

      {showConfirmation && preEODSummary && (
        <EODConfirmationModal
          summary={preEODSummary}
          onConfirm={handleConfirmEOD}
          onCancel={() => setShowConfirmation(false)}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
