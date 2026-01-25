import type { DayClose } from '@pos/shared';
import { Button } from '@pos/ui';
import { CheckCircle, FileText, Download, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEODStore } from '@/stores/eodStore';

interface DayClosedOverlayProps {
  dayClose: DayClose;
}

export function DayClosedOverlay({ dayClose }: DayClosedOverlayProps) {
  const navigate = useNavigate();
  const { clearCurrentDayClose } = useEODStore();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleDone = () => {
    clearCurrentDayClose();
    navigate('/dashboard');
  };

  const handleViewReports = () => {
    window.location.href = `/admin/day-close/${dayClose.id}`;
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/v1/day-close/${dayClose.id}/export/pdf`);
      const data = await response.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleEmailReports = async () => {
    const email = prompt('Enter email address to send reports:');
    if (email) {
      try {
        const response = await fetch(`/api/v1/day-close/${dayClose.id}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: [email] }),
        });
        const data = await response.json();
        if (data.success) {
          alert('Report sent successfully!');
        } else {
          alert('Failed to send report: ' + data.error);
        }
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-100">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="bg-green-600 px-6 py-8 text-center rounded-t-lg">
            <CheckCircle className="h-16 w-16 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Day Closed Successfully</h2>
            <p className="text-green-100 mt-2">
              {new Date(dayClose.operationalDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500">Day Close Number</p>
              <p className="text-xl font-mono font-bold text-gray-900">
                {dayClose.dayCloseNumber}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-xl font-bold text-gray-900">
                  {dayClose.completedTransactions}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(Number(dayClose.totalSales))}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Cash</p>
                <p className="text-lg font-medium text-gray-900">
                  {formatCurrency(Number(dayClose.cashRevenue))}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Card</p>
                <p className="text-lg font-medium text-gray-900">
                  {formatCurrency(Number(dayClose.cardRevenue))}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Closed By</span>
                <span className="font-medium">{dayClose.closedByUserName || 'N/A'}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Closed At</span>
                <span className="font-medium">
                  {dayClose.closedAt 
                    ? new Date(dayClose.closedAt).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${
                  dayClose.syncStatus === 'clean' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {dayClose.syncStatus === 'clean' ? 'All Synced' : 'Pending Sync'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" onClick={handleViewReports} className="w-full">
                <FileText className="h-4 w-4 mr-1" />
                Reports
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF} className="w-full">
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" onClick={handleEmailReports} className="w-full">
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
            </div>
            <Button 
              variant="default" 
              onClick={handleDone}
              className="w-full mt-3"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
