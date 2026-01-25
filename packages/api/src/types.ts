export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  skipAuth?: boolean;
  skipAuthHandling?: boolean;
  queryParams?: Record<string, string | number | boolean | undefined>;
  responseType?: 'json' | 'text';
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AuthActions {
  setTokens?: (accessToken: string, refreshToken?: string) => void;
  logout?: () => void;
}

export interface Shift {
  id: string;
  shiftNumber: string;
  cashierId: string;
  storeId: string;
  status: 'ACTIVE' | 'CLOSED';
  openingFloat: number;
  openingNote: string | null;
  openingImageUrl: string | null;
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
  serverId: string | null;
}

// =============================================================================
// END OF DAY TYPES
// =============================================================================

export interface PreEODSummaryResponse {
  success: boolean;
  data: {
    storeId: string;
    storeName: string;
    operationalDate: string;
    periodStart: string;
    periodEnd: string;
    transactions: { total: number; completed: number; voided: number };
    revenue: { totalSales: number; cashRevenue: number; cardRevenue: number; refunds: number; discounts: number };
    shifts: { activeCount: number; totalVariance: number; shifts: Array<{ shiftId: string; cashierId: string; cashierName: string; status: string }> };
    syncStatus: { pendingTransactions: number; pendingCarts: number };
  };
  error?: string;
}

export interface ExecuteEODRequest {
  storeId: string;
  operationalDate: string;
}

export interface ExecuteEODResponse {
  success: boolean;
  data: {
    dayCloseId: string;
    dayCloseNumber: string;
    operationalDate: string;
    closedAt: string;
  };
  error?: string;
}

export interface GetDayCloseResponse {
  success: boolean;
  data: {
    dayClose: {
      id: string;
      storeId: string;
      operationalDayId: string;
      operationalDate: string;
      dayCloseNumber: string;
      totalTransactions: number;
      totalSales: number;
      cashRevenue: number;
      cardRevenue: number;
      totalRefunds: number;
      totalDiscounts: number;
      totalVariance: number;
      syncStatus: 'clean' | 'warning';
      closedByUserName: string;
      closedAt: string;
    };
    shifts: Array<{
      id: string;
      dayCloseId: string;
      shiftId: string;
      cashierId: string;
      cashierName: string;
      openingFloat: number;
      closingCash: number;
      variance: number;
    }>;
  };
}

export interface GetDayCloseHistoryResponse {
  success: boolean;
  data: {
    dayCloses: Array<{
      id: string;
      dayCloseNumber: string;
      operationalDate: string;
      closedAt: string;
      closedByUserName: string;
      totalTransactions: number;
      totalSales: number;
      syncStatus: 'clean' | 'warning';
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface EODSettingsResponse {
  success: boolean;
  data: {
    storeId: string;
    operationalDayStartHour: number;
    allowAutoDayTransition: boolean;
    eodNotificationEmails: string[];
  };
}

export interface UpdateEODSettingsRequest {
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  eodNotificationEmails: string[];
}

export interface MasterTerminalResponse {
  success: boolean;
  data: {
    id: string;
    storeId: string;
    deviceName: string | null;
    deviceIdentifier: string;
    isMasterTerminal: boolean;
    masterTerminalName: string | null;
  };
}

export interface UpdateMasterTerminalRequest {
  isMasterTerminal: boolean;
  masterTerminalName?: string;
}

export interface SyncStatusResponse {
  success: boolean;
  data: {
    pendingTransactions: number;
    lastSyncAt: string | null;
  };
}

export interface DailySalesReportResponse {
  success: boolean;
  data: {
    dayCloseId: string;
    operationalDate: string;
    overview: { totalTransactions: number; completedTransactions: number; voidedTransactions: number };
    revenue: { grossSales: number; refunds: number; discounts: number; netRevenue: number };
    paymentMethods: { cash: number; cashPercentage: number; card: number; cardPercentage: number };
    salesByHour: Array<{ period: string; amount: number }>;
    topProducts: Array<{ productName: string; quantitySold: number }>;
  };
}

export interface CashReconReportResponse {
  success: boolean;
  data: {
    dayCloseId: string;
    operationalDate: string;
    cashHandling: { openingFloat: number; cashSales: number; cashRefunds: number; paidOuts: number; expectedCash: number };
    shifts: Array<{ shiftId: string; cashierName: string; openedAt: string; closedAt: string; sales: number; transactions: number; openingFloat: number; closingCash: number; variance: number; status: string }>;
    summary: { totalExpected: number; totalActual: number; totalVariance: number; status: string };
  };
}

export interface InventoryMovementReportResponse {
  success: boolean;
  data: {
    dayCloseId: string;
    operationalDate: string;
    itemsSold: Array<{ productId: string; productName: string; quantitySold: number }>;
    lowStockAlerts: Array<{ productId: string; productName: string; currentStock: number; threshold: number }>;
    reorderRecommendations: Array<{ productId: string; productName: string; recommendedQuantity: number; reason: string }>;
  };
}

export interface TransactionAuditLogReportResponse {
  success: boolean;
  data: {
    dayCloseId: string;
    operationalDate: string;
    transactions: Array<{ transactionNumber: string; timestamp: string; amount: number; paymentMethod: string; cashierName: string; status: string }>;
    summary: { totalTransactions: number; totalVolume: number; voidCount: number; voidTransactionNumbers: string[] };
  };
}

export interface ShiftAggregationReportResponse {
  success: boolean;
  data: {
    dayCloseId: string;
    operationalDate: string;
    shifts: Array<{ shiftId: string; cashierId: string; cashierName: string; openedAt: string; closedAt: string; sales: number; transactions: number; openingFloat: number; closingCash: number; variance: number; status: string }>;
    dailyTotals: { totalSales: number; totalTransactions: number; totalOpeningFloat: number; totalClosingCash: number; combinedVariance: number; status: string };
  };
}

export interface GetPendingCartsResponse {
  success: boolean;
  data: Array<{
    id: string;
    storeId: string;
    cartId: string;
    cartData: string;
    operationalDate: string;
    createdAt: string;
    expiresAt: string;
  }>;
}

export interface RestorePendingCartResponse {
  success: boolean;
  data: { cartId: string; restored: boolean };
}

export interface EmailReportRequest {
  dayCloseId: string;
  reportTypes: ('sales' | 'cash' | 'inventory' | 'audit' | 'shifts')[];
  recipients: string[];
}

export interface EmailReportResponse {
  success: boolean;
  message: string;
}
