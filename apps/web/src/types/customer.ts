export interface CustomerGroup {
  id: string;
  name: string;
  minSpend: string;
  minVisits: number;
  priority: number;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customerGroupId: string | null;
  totalSpend: string;
  visitCount: number;
  createdAt: string;
  updatedAt?: string;
  group?: CustomerGroup | null;
}

export interface CustomerVoucher {
  id: string;
  code: string;
  type: 'GC' | 'PR';
  discountType?: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  initialValue?: string;
  currentBalance?: string;
  percentageValue?: string;
  fixedValue?: string;
  scope?: 'ENTIRE_ORDER' | 'ITEMS_ONLY' | 'SUBTOTAL' | 'SPECIFIC_ITEMS';
  expiresAt?: string;
  isActive: boolean;
  isVoid: boolean;
  customerId?: string;
  createdAt: string;
}
