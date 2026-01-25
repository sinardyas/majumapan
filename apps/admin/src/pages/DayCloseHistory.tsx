import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { Calendar, ChevronLeft, ChevronRight, Eye, Download, Mail } from 'lucide-react';
import { DayCloseHistoryItem } from '@pos/shared';

export default function DayCloseHistory() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<DayCloseHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    if (user?.storeId) {
      fetchHistory();
    }
  }, [user?.storeId, page]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ dayCloses: DayCloseHistoryItem[]; total: number }>(
        '/day-close/history',
        {
          queryParams: {
            storeId: user?.storeId || '',
            page,
            pageSize,
          },
        }
      );

      if (response.success && response.data) {
        setHistory(response.data.dayCloses || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleViewDetail = (dayClose: DayCloseHistoryItem) => {
    window.location.href = `/admin/day-close/${dayClose.id}`;
  };

  const handleDownloadCSV = async (dayClose: DayCloseHistoryItem) => {
    try {
      const response = await api.get<string>(`/day-close/${dayClose.id}/export/csv/all`, {
        responseType: 'text',
      });

      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eod-report-${dayClose.operationalDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const handleEmailReport = async (dayClose: DayCloseHistoryItem) => {
    const email = prompt('Enter email address to send report:');
    if (email) {
      try {
        const response = await api.post(
          `/day-close/${dayClose.id}/email`,
          { recipients: [email] }
        );

        if (response.success) {
          alert('Report sent successfully!');
        } else {
          alert('Failed to send report: ' + response.error);
        }
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }
  };

  if (isLoading && history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Day Close History</h1>
        <p className="text-gray-600">View historical day close records</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No day close records</h3>
          <p className="mt-1 text-sm text-gray-500">
            Day close records will appear here after EOD is executed.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Day Close #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Closed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((dayClose) => (
                  <tr key={dayClose.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(dayClose.operationalDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">
                        {dayClose.dayCloseNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {dayClose.totalTransactions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(dayClose.totalSales)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {dayClose.closedByUserName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        dayClose.syncStatus === 'clean' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {dayClose.syncStatus === 'clean' ? 'Synced' : 'Pending Sync'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetail(dayClose)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadCSV(dayClose)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Download CSV"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEmailReport(dayClose)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Email Report"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} records
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
