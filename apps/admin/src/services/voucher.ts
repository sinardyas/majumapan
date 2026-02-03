import { api } from '@/services/api';
import type { ApiResponse } from '@pos/api-client';

export interface Voucher {
  id: string;
  code: string;
  type: 'GC' | 'PR';
  discountType?: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  initialValue?: string;
  currentBalance?: string;
  currency?: string;
  percentageValue?: string;
  fixedValue?: string;
  scope?: 'ENTIRE_ORDER' | 'ITEMS_ONLY' | 'SUBTOTAL' | 'SPECIFIC_ITEMS';
  freeItemId?: string;
  freeItemMode?: 'AUTO_ADD' | 'QUALIFY_FIRST';
  minPurchase?: string;
  maxDiscount?: string;
  expiresAt?: string;
  isActive: boolean;
  isVoid: boolean;
  customerId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  totalUsageLimit?: number;
  currentUsageCount?: number;
  perCustomerLimit?: number;
  dailyLimit?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  categoryId?: string;
  price: number;
  quantity: number;
}

export interface ValidateVoucherRequest {
  code: string;
  cartItems?: CartItem[];
  subtotal?: number;
  customerId?: string;
}

export interface ValidateVoucherResponse {
  valid: boolean;
  error?: string;
  voucher?: Voucher;
  applicableItems?: Array<{ itemType: string; itemId: string }>;
  qualifierItems?: Array<{ itemType: string; itemId: string }>;
  discountPreview?: {
    calculatedDiscount: number;
    finalDiscount: number;
    message: string;
  };
}

export interface CreateGiftCardRequest {
  initialValue: number;
  currency?: string;
  expiresAt?: string;
  customerId?: string;
  notes?: string;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  dailyLimit?: number;
}

export interface CreatePromoRequest {
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  percentageValue?: number;
  fixedValue?: number;
  scope?: 'ENTIRE_ORDER' | 'ITEMS_ONLY' | 'SUBTOTAL' | 'SPECIFIC_ITEMS';
  freeItemId?: string;
  freeItemMode?: 'AUTO_ADD' | 'QUALIFY_FIRST';
  minPurchase?: number;
  maxDiscount?: number;
  expiresAt: string;
  applicableCategories?: string[];
  applicableProducts?: string[];
  qualifierCategories?: string[];
  qualifierProducts?: string[];
  notes?: string;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  dailyLimit?: number;
}

export interface UseVoucherRequest {
  orderId: string;
  cartItems?: CartItem[];
  amountApplied?: number;
}

export interface OrderVoucher {
  id: string;
  orderId: string;
  voucherId: string;
  amountApplied: string;
  discountDetails?: {
    discountType?: string;
    scope?: string;
    percentageValue?: string;
    fixedValue?: string;
    freeItemId?: string;
    freeItemMode?: string;
    calculatedDiscount: number;
  };
  type: 'GC' | 'PR';
  createdAt: string;
}

export interface UseVoucherResponse {
  success: boolean;
  error?: string;
  orderVoucher?: OrderVoucher;
  voucher?: Voucher;
  freeItems?: Array<{ productId: string; quantity: number }>;
}

export interface VoidVoucherRequest {
  reason?: string;
}

class VoucherApiService {
  async validateVoucher(data: ValidateVoucherRequest): Promise<ApiResponse<ValidateVoucherResponse>> {
    return api.post('/vouchers/validate', data);
  }

  async getAllVouchers(options?: { type?: 'GC' | 'PR'; isActive?: boolean; limit?: number; offset?: number }): Promise<ApiResponse<{ data: Voucher[] }>> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (typeof options?.isActive === 'boolean') params.append('active', String(options.isActive));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    return api.get(`/vouchers?${params.toString()}`);
  }

  async getByCode(code: string): Promise<ApiResponse<{ data: Voucher }>> {
    return api.get(`/vouchers/code/${encodeURIComponent(code)}`);
  }

  async getBalance(code: string): Promise<ApiResponse<{ data: { code: string; type: string; balance?: string; isActive: boolean; isVoid: boolean; expiresAt?: string } }>> {
    return api.get(`/vouchers/code/${encodeURIComponent(code)}/balance`);
  }

  async getCustomerVouchers(customerId: string): Promise<ApiResponse<{ data: Voucher[] }>> {
    return api.get(`/vouchers/customer/${customerId}`);
  }

  async createGiftCard(data: CreateGiftCardRequest): Promise<ApiResponse<Voucher>> {
    return api.post('/vouchers/gift-card', data);
  }

  async createPromo(data: CreatePromoRequest): Promise<ApiResponse<Voucher>> {
    return api.post('/vouchers/promo', data);
  }

  async useVoucher(code: string, data: UseVoucherRequest): Promise<ApiResponse<UseVoucherResponse>> {
    return api.post(`/vouchers/code/${encodeURIComponent(code)}/use`, data);
  }

  async voidVoucher(code: string, data: VoidVoucherRequest): Promise<ApiResponse<{ success: boolean }>> {
    return api.post(`/vouchers/code/${encodeURIComponent(code)}/void`, data);
  }

  async createFromRefund(orderId: string, refundAmount: number, customerId?: string): Promise<ApiResponse<{ data: Voucher }>> {
    return api.post('/vouchers/refund', { orderId, refundAmount, customerId });
  }

  async getTransactions(voucherId: string): Promise<ApiResponse<{ data: Array<{ id: string; type: string; amount: string; orderId?: string; createdAt: string }> }>> {
    return api.get(`/vouchers/${voucherId}/transactions`);
  }
}

export const voucherApi = new VoucherApiService();
