import type {
  UserRole,
  TransactionStatus,
  SyncStatus,
  DiscountType,
  DiscountScope,
} from '../constants';

export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  storeId: string | null;
  email: string;
  name: string;
  role: UserRole;
  pin: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  costPrice: number | null;
  imageUrl: string | null;
  imageBase64: string | null;
  isActive: boolean;
  hasPromo: boolean;
  promoType: 'percentage' | 'fixed' | null;
  promoValue: number | null;
  promoMinQty: number;
  promoStartDate: Date | null;
  promoEndDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stock {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: Date;
}

export interface Discount {
  id: string;
  storeId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountScope: DiscountScope;
  value: number;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  startDate: Date | null;
  endDate: Date | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDiscount {
  id: string;
  discountId: string;
  productId: string;
}

export interface TransactionPayment {
  id: string;
  transactionId: string;
  paymentMethod: 'cash' | 'card';
  amount: number;
  changeAmount: number;
}

export interface Transaction {
  id: string;
  clientId: string;
  storeId: string;
  cashierId: string;
  transactionNumber: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountId: string | null;
  discountCode: string | null;
  discountName: string | null;
  total: number;
  isSplitPayment: boolean;
  paymentMethod: 'cash' | 'card' | null;
  amountPaid: number | null;
  changeAmount: number | null;
  status: TransactionStatus;
  syncStatus: SyncStatus;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  clientTimestamp: Date;
  createdAt: Date;
  payments?: TransactionPayment[];
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  promoType?: 'percentage' | 'fixed' | null;
  promoValue?: number;
  promoDiscount?: number;
  discountId: string | null;
  discountName: string | null;
  discountValue: number;
  subtotal: number;
  createdAt: Date;
}

export interface SyncLog {
  id: string;
  storeId: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: Date;
}

// =============================================================================
// END OF DAY TYPES
// =============================================================================

export type OperationalDayStatus = 'OPEN' | 'CLOSED';
export type DayCloseSyncStatus = 'clean' | 'warning';

export interface OperationalDay {
  id: string;
  storeId: string;
  operationalDate: string;
  periodStart: Date;
  periodEnd: Date;
  status: OperationalDayStatus;
  closedByUserId: string | null;
  closedByUserName: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DayClose {
  id: string;
  storeId: string;
  storeName?: string;
  operationalDayId: string;
  operationalDate: string;
  dayCloseNumber: string;
  periodStart: Date;
  periodEnd: Date;
  totalTransactions: number;
  completedTransactions: number;
  voidedTransactions: number;
  totalSales: number;
  cashRevenue: number;
  cardRevenue: number;
  totalRefunds: number;
  totalDiscounts: number;
  totalVariance: number;
  pendingTransactionsAtClose: number;
  syncStatus: DayCloseSyncStatus;
  closedByUserId: string;
  closedByUserName: string;
  closedAt: Date;
  createdAt: Date;
  shifts?: DayCloseShift[];
}

export interface DayCloseShift {
  id: string;
  dayCloseId: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  openingFloat: number;
  closingCash: number;
  variance: number;
}

export interface PendingCartQueueItem {
  id: string;
  storeId: string;
  cartId: string;
  cartData: string;
  operationalDate: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface EODSettings {
  storeId: string;
  operationalDayStartHour: number;
  allowAutoDayTransition: boolean;
  eodNotificationEmails: string[];
}

export interface MasterTerminal {
  id: string;
  storeId: string;
  deviceName: string | null;
  deviceIdentifier: string;
  isMasterTerminal: boolean;
  masterTerminalName: string | null;
}

export interface PreEODSummary {
  storeId: string;
  storeName: string;
  operationalDate: string;
  periodStart: string;
  periodEnd: string;
  transactions: {
    total: number;
    completed: number;
    voided: number;
  };
  revenue: {
    totalSales: number;
    cashRevenue: number;
    cardRevenue: number;
    refunds: number;
    discounts: number;
  };
  shifts: {
    activeCount: number;
    totalVariance: number;
    shifts: Array<{
      shiftId: string;
      cashierId: string;
      cashierName: string;
      status: string;
    }>;
  };
  syncStatus: {
    pendingTransactions: number;
    pendingCarts: number;
  };
}

export interface DailySalesReport {
  dayCloseId: string;
  operationalDate: string;
  periodStart: string;
  periodEnd: string;
  overview: {
    totalTransactions: number;
    completedTransactions: number;
    voidedTransactions: number;
  };
  revenue: {
    grossSales: number;
    refunds: number;
    discounts: number;
    netRevenue: number;
  };
  paymentMethods: {
    cash: number;
    cashPercentage: number;
    card: number;
    cardPercentage: number;
  };
  salesByHour: Array<{
    period: string;
    amount: number;
  }>;
  topProducts: Array<{
    productName: string;
    quantitySold: number;
  }>;
}

export interface CashReconReport {
  dayCloseId: string;
  operationalDate: string;
  cashHandling: {
    openingFloat: number;
    cashSales: number;
    cashRefunds: number;
    paidOuts: number;
    expectedCash: number;
  };
  shifts: Array<{
    shiftId: string;
    cashierName: string;
    openedAt: string;
    closedAt: string;
    sales: number;
    transactions: number;
    openingFloat: number;
    closingCash: number;
    variance: number;
    status: string;
  }>;
  summary: {
    totalExpected: number;
    totalActual: number;
    totalVariance: number;
    status: string;
  };
}

export interface InventoryMovementReport {
  dayCloseId: string;
  operationalDate: string;
  itemsSold: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
  }>;
  lowStockAlerts: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    threshold: number;
  }>;
  reorderRecommendations: Array<{
    productId: string;
    productName: string;
    recommendedQuantity: number;
    reason: string;
  }>;
}

export interface TransactionAuditLogReport {
  dayCloseId: string;
  operationalDate: string;
  transactions: Array<{
    transactionNumber: string;
    timestamp: string;
    amount: number;
    paymentMethod: string;
    cashierName: string;
    status: string;
  }>;
  summary: {
    totalTransactions: number;
    totalVolume: number;
    voidCount: number;
    voidTransactionNumbers: string[];
  };
}

export interface ShiftAggregationReport {
  dayCloseId: string;
  operationalDate: string;
  shifts: Array<{
    shiftId: string;
    cashierId: string;
    cashierName: string;
    openedAt: string;
    closedAt: string;
    sales: number;
    transactions: number;
    openingFloat: number;
    closingCash: number;
    variance: number;
    status: string;
  }>;
  dailyTotals: {
    totalSales: number;
    totalTransactions: number;
    totalOpeningFloat: number;
    totalClosingCash: number;
    combinedVariance: number;
    status: string;
  };
}

export interface DayCloseHistoryItem {
  id: string;
  storeId: string;
  storeName?: string;
  dayCloseNumber: string;
  operationalDate: string;
  closedAt: string;
  closedByUserName: string;
  totalTransactions: number;
  totalSales: number;
  syncStatus: DayCloseSyncStatus;
}
