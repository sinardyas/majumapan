import type {
  UserRole,
  PaymentMethod,
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
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  status: TransactionStatus;
  syncStatus: SyncStatus;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  clientTimestamp: Date;
  createdAt: Date;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
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
