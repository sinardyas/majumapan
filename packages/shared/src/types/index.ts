export * from './models';

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface PinLoginRequest {
  pin: string;
  storeId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  storeId: string | null;
  iat: number;
  exp: number;
}

// Sync types
export interface SyncPullResponse {
  changes: {
    categories: {
      created: import('./models').Category[];
      updated: import('./models').Category[];
      deleted: string[];
    };
    products: {
      created: import('./models').Product[];
      updated: import('./models').Product[];
      deleted: string[];
    };
    stock: {
      updated: import('./models').Stock[];
    };
    discounts: {
      created: import('./models').Discount[];
      updated: import('./models').Discount[];
      deleted: string[];
    };
  };
  lastSyncTimestamp: string;
}

export interface SyncPushRequest {
  transactions: Array<{
    clientId: string;
    clientTimestamp: string;
    items: Array<{
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      discountId?: string;
      discountName?: string;
      discountValue?: number;
      subtotal: number;
    }>;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    discountId?: string;
    discountCode?: string;
    discountName?: string;
    total: number;
    paymentMethod: 'cash' | 'card';
    amountPaid: number;
    changeAmount: number;
  }>;
}

export interface SyncPushResponse {
  synced: Array<{
    clientId: string;
    serverId: string;
    transactionNumber: string;
  }>;
  rejected: Array<{
    clientId: string;
    reason: string;
    stockIssues?: Array<{
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }>;
  }>;
  stockUpdates: Array<{
    productId: string;
    newQuantity: number;
  }>;
}

export interface FullSyncResponse {
  store: import('./models').Store;
  categories: import('./models').Category[];
  products: import('./models').Product[];
  stock: import('./models').Stock[];
  discounts: import('./models').Discount[];
  lastSyncTimestamp: string;
}
