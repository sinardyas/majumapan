import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@pos/ui';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';

interface ShiftReport {
  id: string;
  shiftNumber: string;
  cashierId: string;
  cashierName: string;
  storeId: string;
  storeName: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  openingFloat: number;
  openingNote: string | null;
  openingTimestamp: string;
  endingCash: number | null;
  endingNote: string | null;
  closingTimestamp: string | null;
  variance: number | null;
  varianceReason: string | null;
  varianceApprovedBy: string | null;
  varianceApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TransactionSummary {
  totalTransactions: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalDiscounts: number;
  averageTransaction: number;
}

export default function ShiftReport() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [shift, setShift] = useState<ShiftReport | null>(null);
  const [transactions, setTransactions] = useState<Array<{
    id: string;
    transactionNumber: string;
    total: number;
    paymentMethod: 'cash' | 'card';
    discountAmount: number;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);

  useEffect(() => {
    if (!shiftId) {
      setError('Shift ID is required');
      setLoading(false);
      return;
    }

    loadShiftData();
  }, [shiftId]);

  const loadShiftData = async () => {
    try {
      const shiftResponse = await api.getShiftById(shiftId!);

      if (!shiftResponse.success || !shiftResponse.data?.shift) {
        setError(shiftResponse.error || 'Failed to load shift');
        setLoading(false);
        return;
      }

      const shiftData = shiftResponse.data.shift;
      setShift({
        id: shiftData.id,
        shiftNumber: shiftData.shiftNumber,
        cashierId: shiftData.cashierId,
        cashierName: user?.name || 'Unknown',
        storeId: shiftData.storeId,
        storeName: 'Store',
        status: shiftData.status,
        openingFloat: Number(shiftData.openingFloat),
        openingNote: shiftData.openingNote ?? null,
        openingTimestamp: shiftData.openingTimestamp,
        endingCash: shiftData.endingCash ? Number(shiftData.endingCash) : null,
        endingNote: shiftData.endingNote ?? null,
        closingTimestamp: shiftData.closingTimestamp ?? null,
        variance: shiftData.variance ? Number(shiftData.variance) : null,
        varianceReason: shiftData.varianceReason ?? null,
        varianceApprovedBy: shiftData.varianceApprovedBy ?? null,
        varianceApprovedAt: shiftData.varianceApprovedAt ?? null,
        createdAt: shiftData.createdAt,
        updatedAt: shiftData.updatedAt,
      });

      const txnResponse = await api.get<{
        transactions: Array<{
          id: string;
          transactionNumber: string;
          total: number;
          paymentMethod: string;
          discountAmount: number;
          createdAt: string;
        }>;
      }>(`/transactions?startDate=${encodeURIComponent(shiftData.openingTimestamp)}`);

      if (txnResponse.success && txnResponse.data?.transactions) {
        const txns = txnResponse.data.transactions.map(t => ({
          id: t.id,
          transactionNumber: t.transactionNumber,
          total: Number(t.total),
          paymentMethod: t.paymentMethod as 'cash' | 'card',
          discountAmount: Number(t.discountAmount),
          createdAt: t.createdAt,
        }));

        setTransactions(txns);

        const totalSales = txns.reduce((sum, t) => sum + t.total, 0);
        const totalCash = txns.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.total, 0);
        const totalCard = txns.filter(t => t.paymentMethod === 'card').reduce((sum, t) => sum + t.total, 0);
        const totalDiscounts = txns.reduce((sum, t) => sum + t.discountAmount, 0);

        setSummary({
          totalTransactions: txns.length,
          totalSales,
          totalCash,
          totalCard,
          totalDiscounts,
          averageTransaction: txns.length > 0 ? totalSales / txns.length : 0,
        });
      }
    } catch (err) {
      console.error('Error loading shift data:', err);
      setError('Failed to load shift data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shift report...</p>
        </div>
      </div>
    );
  }

  if (error || !shift) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-gray-600 mb-4">{error || 'Shift not found'}</p>
          <Button onClick={() => navigate('/pos')}>Back to POS</Button>
        </div>
      </div>
    );
  }

  const opening = formatDateTime(shift.openingTimestamp);
  const closing = shift.closingTimestamp ? formatDateTime(shift.closingTimestamp) : null;
  const expectedCash = shift.openingFloat + (summary?.totalCash || 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg print:shadow-none print:max-w-none">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Report</h1>
            <p className="text-gray-600">{shift.shiftNumber}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/pos')}>
              Back to POS
            </Button>
            <Button onClick={handlePrint}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Shift Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Shift Number:</span>
                  <span className="font-medium">{shift.shiftNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cashier:</span>
                  <span className="font-medium">{shift.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${shift.status === 'CLOSED' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {shift.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Timing</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Opened:</span>
                  <span className="font-medium">{opening.date} {opening.time}</span>
                </div>
                {closing && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Closed:</span>
                    <span className="font-medium">{closing.date} {closing.time}</span>
                  </div>
                )}
                {closing && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">
                      {Math.round((new Date(shift.closingTimestamp!).getTime() - new Date(shift.openingTimestamp).getTime()) / 3600000)} hours
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Opening</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Opening Float:</span>
                  <span className="font-medium">{formatCurrency(shift.openingFloat)}</span>
                </div>
                {shift.openingNote && (
                  <div className="mt-2">
                    <span className="text-gray-600 text-sm">Note:</span>
                    <p className="text-sm text-gray-800 mt-1">{shift.openingNote}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Closing</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ending Cash:</span>
                  <span className="font-medium">{formatCurrency(shift.endingCash || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Cash:</span>
                  <span className="font-medium">{formatCurrency(expectedCash)}</span>
                </div>
                {shift.variance !== null && (
                  <div className={`flex justify-between ${shift.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="font-medium">Variance:</span>
                    <span className="font-bold">{shift.variance >= 0 ? '+' : ''}{formatCurrency(shift.variance)}</span>
                  </div>
                )}
                {shift.varianceReason && (
                  <div className="mt-2">
                    <span className="text-gray-600 text-sm">Reason:</span>
                    <p className="text-sm text-gray-800 mt-1">{shift.varianceReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {summary && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-sm font-medium text-blue-800 mb-3">Transaction Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{summary.totalTransactions}</div>
                  <div className="text-sm text-blue-700">Transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{formatCurrency(summary.totalSales)}</div>
                  <div className="text-sm text-blue-700">Total Sales</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{formatCurrency(summary.averageTransaction)}</div>
                  <div className="text-sm text-blue-700">Avg Transaction</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-200 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-900">{formatCurrency(summary.totalCash)}</div>
                  <div className="text-sm text-blue-700">Cash Sales</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-900">{formatCurrency(summary.totalCard)}</div>
                  <div className="text-sm text-blue-700">Card Sales</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">{formatCurrency(summary.totalDiscounts)}</div>
                  <div className="text-sm text-blue-700">Discounts</div>
                </div>
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Transactions ({transactions.length})</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Receipt #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Method</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Discount</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((txn) => {
                      const time = formatDateTime(txn.createdAt);
                      return (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{txn.transactionNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{time.time}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              txn.paymentMethod === 'cash' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {txn.paymentMethod.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {txn.discountAmount > 0 ? `-${formatCurrency(txn.discountAmount)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                            {formatCurrency(txn.total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
            <p>Report generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
