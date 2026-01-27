import { db } from '../db';
import {
  vouchers,
  voucherApplicableItems,
  voucherQualifierItems,
  voucherTransactions,
  orderVouchers,
} from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}

export function generateVoucherCode(type: 'GC' | 'PR'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomPart = Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');

  const checkDigits = generateCheckDigits(type + randomPart);
  const result = type + randomPart + checkDigits;

  const formatted = [result.slice(0, 4), result.slice(4, 8), result.slice(8, 12), result.slice(12, 16)];
  return formatted.join('-');
}

export function generateCheckDigits(prefix: string): string {
  let sum = 0;
  for (let i = 0; i < prefix.length; i++) {
    sum += (i + 1) * prefix.charCodeAt(i);
  }
  const check1 = (sum % 36).toString(36).toUpperCase();
  const check2 = ((sum * 7) % 36).toString(36).toUpperCase();
  return check1 + check2;
}

export function validateCheckDigits(code: string): boolean {
  const normalized = code.replace(/-/g, '');
  const prefix = normalized.slice(0, 14);
  const expectedCheck = generateCheckDigits(prefix);
  const actualCheck = normalized.slice(14, 16);
  return expectedCheck === actualCheck;
}

export function parseVoucherCode(code: string): { type: string; randomPart: string; valid: boolean } {
  const normalized = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  if (normalized.length !== 16) {
    return { type: '', randomPart: '', valid: false };
  }
  const type = normalized.slice(0, 2);
  const randomPart = normalized.slice(2, 14);
  const valid = validateCheckDigits(normalized);
  return { type, randomPart, valid };
}

interface CreateGiftCardInput {
  initialValue: number;
  currency?: string;
  expiresAt?: Date | null;
  customerId?: string;
  createdBy?: string;
  notes?: string;
}

interface CreatePromoInput {
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  percentageValue?: number;
  fixedValue?: number;
  scope?: 'ENTIRE_ORDER' | 'ITEMS_ONLY' | 'SUBTOTAL' | 'SPECIFIC_ITEMS';
  freeItemId?: string;
  freeItemMode?: 'AUTO_ADD' | 'QUALIFY_FIRST';
  minPurchase?: number;
  maxDiscount?: number;
  expiresAt: Date;
  applicableCategories?: string[];
  applicableProducts?: string[];
  qualifierCategories?: string[];
  qualifierProducts?: string[];
  createdBy?: string;
  notes?: string;
}

interface CartItem {
  id: string;
  productId: string;
  categoryId?: string;
  price: number;
  quantity: number;
}

export const voucherService = {
  generateVoucherCode: (type: 'GC' | 'PR') => generateVoucherCode(type),

  parseVoucherCode: (code: string) => parseVoucherCode(code),

  validateCheckDigits: (code: string) => validateCheckDigits(code),

  async createGiftCard(input: CreateGiftCardInput) {
    const code = generateVoucherCode('GC');
    const now = new Date();
    const initialValue = String(input.initialValue);

    const [voucher] = await db.insert(vouchers).values({
      code,
      type: 'GC',
      initialValue,
      currentBalance: initialValue,
      currency: input.currency || 'IDR',
      expiresAt: input.expiresAt || null,
      customerId: input.customerId || null,
      createdBy: input.createdBy || null,
      notes: input.notes || null,
      isActive: true,
      isVoid: false,
      createdAt: now,
      updatedAt: now,
    }).returning();

    await db.insert(voucherTransactions).values({
      voucherId: voucher.id,
      type: 'create',
      amount: initialValue,
      balanceBefore: '0',
      balanceAfter: initialValue,
      createdBy: input.createdBy || null,
      notes: input.notes || `Gift Card created with initial value: ${input.initialValue}`,
      createdAt: now,
    });

    return voucher;
  },

  async createPromotional(input: CreatePromoInput) {
    const code = generateVoucherCode('PR');
    const now = new Date();

    const [voucher] = await db.insert(vouchers).values({
      code,
      type: 'PR',
      discountType: input.discountType,
      percentageValue: input.percentageValue ? String(input.percentageValue) : null,
      fixedValue: input.fixedValue ? String(input.fixedValue) : null,
      scope: input.scope || 'ENTIRE_ORDER',
      freeItemId: input.freeItemId || null,
      freeItemMode: input.freeItemMode || null,
      minPurchase: input.minPurchase ? String(input.minPurchase) : null,
      maxDiscount: input.maxDiscount ? String(input.maxDiscount) : null,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy || null,
      notes: input.notes || null,
      isActive: true,
      isVoid: false,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const applicableItems: Array<{ voucherId: string; itemType: 'CATEGORY' | 'PRODUCT'; itemId: string }> = [];

    input.applicableCategories?.forEach((catId) => {
      applicableItems.push({ voucherId: voucher.id, itemType: 'CATEGORY', itemId: catId });
    });
    input.applicableProducts?.forEach((prodId) => {
      applicableItems.push({ voucherId: voucher.id, itemType: 'PRODUCT', itemId: prodId });
    });

    if (applicableItems.length > 0) {
      await db.insert(voucherApplicableItems).values(applicableItems);
    }

    if (input.freeItemMode === 'QUALIFY_FIRST' && (input.qualifierCategories?.length || input.qualifierProducts?.length)) {
      const qualifierType: 'CATEGORY' | 'PRODUCT' | 'BOTH' = 
        input.qualifierCategories?.length && input.qualifierProducts?.length ? 'BOTH' :
        input.qualifierCategories?.length ? 'CATEGORY' : 'PRODUCT';

      const qualifierItems: Array<{ voucherId: string; qualifierType: 'CATEGORY' | 'PRODUCT' | 'BOTH'; itemType: 'CATEGORY' | 'PRODUCT'; itemId: string }> = [];

      input.qualifierCategories?.forEach((catId) => {
        qualifierItems.push({ voucherId: voucher.id, qualifierType, itemType: 'CATEGORY', itemId: catId });
      });
      input.qualifierProducts?.forEach((prodId) => {
        qualifierItems.push({ voucherId: voucher.id, qualifierType, itemType: 'PRODUCT', itemId: prodId });
      });

      if (qualifierItems.length > 0) {
        await db.insert(voucherQualifierItems).values(qualifierItems);
      }
    }

    return voucher;
  },

  async getByCode(code: string) {
    const normalized = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    const voucher = await db.query.vouchers.findFirst({
      where: eq(vouchers.code, normalized),
    });
    return voucher || null;
  },

  async getById(id: string) {
    const voucher = await db.query.vouchers.findFirst({
      where: eq(vouchers.id, id),
    });
    return voucher || null;
  },

  async getApplicableItems(voucherId: string) {
    const items = await db.query.voucherApplicableItems.findMany({
      where: eq(voucherApplicableItems.voucherId, voucherId),
    });
    return items;
  },

  async getQualifierItems(voucherId: string) {
    const items = await db.query.voucherQualifierItems.findMany({
      where: eq(voucherQualifierItems.voucherId, voucherId),
    });
    return items;
  },

  async validateVoucher(code: string, cartItems?: CartItem[], subtotal?: number) {
    const normalized = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    const parsed = parseVoucherCode(normalized);

    if (!parsed.valid) {
      return { valid: false, error: 'Invalid voucher code format' };
    }

    const voucher = await this.getByCode(normalized);
    if (!voucher) {
      return { valid: false, error: 'Voucher not found' };
    }

    if (voucher.isVoid) {
      return { valid: false, error: 'Voucher has been voided' };
    }

    if (!voucher.isActive) {
      return { valid: false, error: 'Voucher is not active' };
    }

    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
      return { valid: false, error: `Voucher expired on ${voucher.expiresAt}` };
    }

    if (voucher.type === 'GC') {
      if (voucher.currentBalance && toNumber(voucher.currentBalance) <= 0) {
        return { valid: false, error: 'Gift Card has zero balance', voucher };
      }
      return { valid: true, voucher };
    }

    const applicableItems = await this.getApplicableItems(voucher.id);
    const qualifierItems = await this.getQualifierItems(voucher.id);

    if (voucher.type === 'PR' && voucher.discountType === 'FREE_ITEM' && voucher.freeItemMode === 'QUALIFY_FIRST') {
      if (!cartItems || cartItems.length === 0) {
        return { 
          valid: false, 
          error: 'Cart is empty - add qualifying items to use this voucher',
          voucher,
          qualifierItems 
        };
      }

      const hasQualifier = this.checkHasQualifyingItems(cartItems, qualifierItems);
      if (!hasQualifier) {
        const qualifier = qualifierItems[0];
        const qualifierTypeText = qualifier?.qualifierType === 'CATEGORY' ? 'category' : 
                                  qualifier?.qualifierType === 'PRODUCT' ? 'product' : 'category or product';
        return { 
          valid: false, 
          error: `Add items from the qualifying ${qualifierTypeText} to use this voucher`,
          voucher,
          qualifierItems 
        };
      }
    }

    if (voucher.type === 'PR' && voucher.discountType !== 'FREE_ITEM') {
      if (voucher.minPurchase && subtotal !== undefined) {
        if (subtotal < toNumber(voucher.minPurchase)) {
          return { 
            valid: false, 
            error: `Minimum purchase of ${voucher.minPurchase} required. Current: ${subtotal}`,
            voucher,
            applicableItems 
          };
        }
      }

      if (cartItems && subtotal !== undefined) {
        const discountPreview = this.calculateDiscount(voucher, cartItems, subtotal, applicableItems);
        return { 
          valid: true, 
          voucher,
          applicableItems,
          discountPreview 
        };
      }
    }

    return { valid: true, voucher, applicableItems, qualifierItems };
  },

  checkHasQualifyingItems(cartItems: CartItem[], qualifierItems: Array<{ itemType: string; itemId: string }>): boolean {
    const qualifierCategoryIds = qualifierItems
      .filter(q => q.itemType === 'CATEGORY')
      .map(q => q.itemId);
    const qualifierProductIds = qualifierItems
      .filter(q => q.itemType === 'PRODUCT')
      .map(q => q.itemId);

    return cartItems.some(item => {
      if (qualifierCategoryIds.length && item.categoryId && qualifierCategoryIds.includes(item.categoryId)) {
        return true;
      }
      if (qualifierProductIds.length && qualifierProductIds.includes(item.productId)) {
        return true;
      }
      return false;
    });
  },

  calculateDiscount(
    voucher: typeof vouchers.$inferSelect,
    cartItems: CartItem[],
    subtotal: number,
    applicableItems?: Array<{ itemType: string; itemId: string }>
  ) {
    let calculatedDiscount = 0;
    const scope = voucher.scope || 'ENTIRE_ORDER';
    const discountType = voucher.discountType;

    if (scope === 'SPECIFIC_ITEMS' && applicableItems?.length) {
      const applicableCategoryIds = applicableItems
        .filter(a => a.itemType === 'CATEGORY')
        .map(a => a.itemId);
      const applicableProductIds = applicableItems
        .filter(a => a.itemType === 'PRODUCT')
        .map(a => a.itemId);

      const applicableCartItems = cartItems.filter(item => {
        if (applicableCategoryIds.length && item.categoryId && applicableCategoryIds.includes(item.categoryId)) {
          return true;
        }
        if (applicableProductIds.length && applicableProductIds.includes(item.productId)) {
          return true;
        }
        return false;
      });

      const applicableSubtotal = applicableCartItems.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0);

      if (discountType === 'PERCENTAGE') {
        calculatedDiscount = applicableSubtotal * (toNumber(voucher.percentageValue) / 100);
      } else if (discountType === 'FIXED') {
        calculatedDiscount = toNumber(voucher.fixedValue) || 0;
      }
    } else {
      if (discountType === 'PERCENTAGE') {
        calculatedDiscount = subtotal * (toNumber(voucher.percentageValue) / 100);
      } else if (discountType === 'FIXED') {
        calculatedDiscount = toNumber(voucher.fixedValue) || 0;
      }
    }

    let finalDiscount = calculatedDiscount;
    if (voucher.maxDiscount && calculatedDiscount > toNumber(voucher.maxDiscount)) {
      finalDiscount = toNumber(voucher.maxDiscount);
    }

    let message = '';
    if (discountType === 'PERCENTAGE') {
      message = `${voucher.percentageValue}% off`;
      if (scope === 'SPECIFIC_ITEMS') {
        message += ' (specific items)';
      }
    } else if (discountType === 'FIXED') {
      message = `Fixed discount: ${voucher.fixedValue}`;
    }

    if (voucher.maxDiscount && calculatedDiscount > toNumber(voucher.maxDiscount)) {
      message += ` (capped at ${voucher.maxDiscount})`;
    }

    return { calculatedDiscount, finalDiscount, message };
  },

  async useVoucher(code: string, orderId: string, cartItems?: CartItem[], amountApplied?: number) {
    const normalized = code.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    const validation = await this.validateVoucher(code, cartItems);

    if (!validation.valid || !validation.voucher) {
      return { success: false, error: validation.error || 'Voucher validation failed' };
    }

    const voucher = validation.voucher;
    const now = new Date();

    if (voucher.type === 'GC') {
      const balance = toNumber(voucher.currentBalance);
      const applyAmount = amountApplied || balance;

      if (applyAmount > balance) {
        return { success: false, error: 'Insufficient Gift Card balance' };
      }

      const newBalance = balance - applyAmount;

      await db.transaction(async (tx) => {
        await tx.update(vouchers)
          .set({ currentBalance: String(newBalance), updatedAt: now })
          .where(eq(vouchers.id, voucher.id));

        await tx.insert(voucherTransactions).values({
          voucherId: voucher.id,
          type: 'usage',
          amount: String(applyAmount),
          orderId,
          balanceBefore: String(balance),
          balanceAfter: String(newBalance),
          createdAt: now,
        });

        await tx.insert(orderVouchers).values({
          orderId,
          voucherId: voucher.id,
          amountApplied: String(applyAmount),
          type: 'GC',
          createdAt: now,
        });
      });

      const updatedVoucher = await this.getById(voucher.id);
      return { success: true, voucher: updatedVoucher! };
    }

    if (voucher.type === 'PR') {
      const applicableItems = validation.applicableItems;
      let discountAmount = 0;
      let freeItems: Array<{ productId: string; quantity: number }> = [];

      if (voucher.discountType === 'FREE_ITEM' && voucher.freeItemId) {
        freeItems = [{ productId: voucher.freeItemId, quantity: 1 }];
      } else if (cartItems) {
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = this.calculateDiscount(voucher, cartItems, subtotal, applicableItems);
        discountAmount = discount.finalDiscount;
      }

      await db.transaction(async (tx) => {
        await tx.update(vouchers)
          .set({ isActive: false, updatedAt: now })
          .where(eq(vouchers.id, voucher.id));

        await tx.insert(voucherTransactions).values({
          voucherId: voucher.id,
          type: 'usage',
          amount: String(discountAmount),
          orderId,
          createdAt: now,
        });

        await tx.insert(orderVouchers).values({
          orderId,
          voucherId: voucher.id,
          amountApplied: String(discountAmount),
          discountDetails: {
            discountType: voucher.discountType,
            scope: voucher.scope,
            percentageValue: voucher.percentageValue,
            fixedValue: voucher.fixedValue,
            freeItemId: voucher.freeItemId,
            freeItemMode: voucher.freeItemMode,
            calculatedDiscount: discountAmount,
          },
          type: 'PR',
          createdAt: now,
        });
      });

      return { success: true, freeItems };
    }

    return { success: false, error: 'Unknown voucher type' };
  },

  async voidVoucher(code: string, voidedBy: string, reason?: string) {
    const voucher = await this.getByCode(code);
    if (!voucher) {
      return { success: false, error: 'Voucher not found' };
    }

    if (voucher.isVoid) {
      return { success: false, error: 'Voucher is already voided' };
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(vouchers)
        .set({ isVoid: true, isActive: false, voidedAt: now, voidedBy, voidReason: reason || null, updatedAt: now })
        .where(eq(vouchers.id, voucher.id));

      await tx.insert(voucherTransactions).values({
        voucherId: voucher.id,
        type: 'void',
        amount: '0',
        balanceBefore: voucher.currentBalance || '0',
        balanceAfter: '0',
        createdBy: voidedBy,
        notes: reason || 'Voucher voided',
        createdAt: now,
      });
    });

    return { success: true };
  },

  async getCustomerVouchers(customerId: string) {
    const customerVouchers = await db.query.vouchers.findMany({
      where: and(
        eq(vouchers.customerId, customerId),
        eq(vouchers.isVoid, false)
      ),
      orderBy: [desc(vouchers.createdAt)],
    });
    return customerVouchers;
  },

  async createFromRefund(orderId: string, refundAmount: number, customerId?: string, refundedBy?: string) {
    const code = generateVoucherCode('GC');
    const now = new Date();
    const amount = String(refundAmount);

    const [voucher] = await db.insert(vouchers).values({
      code,
      type: 'GC',
      initialValue: amount,
      currentBalance: amount,
      currency: 'IDR',
      expiresAt: null,
      customerId: customerId || null,
      createdBy: refundedBy || null,
      notes: `Refund Gift Card from order ${orderId}`,
      isActive: true,
      isVoid: false,
      createdAt: now,
      updatedAt: now,
    }).returning();

    await db.insert(voucherTransactions).values({
      voucherId: voucher.id,
      type: 'refund',
      amount,
      orderId,
      balanceBefore: '0',
      balanceAfter: amount,
      createdBy: refundedBy || null,
      notes: `Gift Card created from refund`,
      createdAt: now,
    });

    return voucher;
  },

  async getVoucherTransactions(voucherId: string) {
    const transactions = await db.query.voucherTransactions.findMany({
      where: eq(voucherTransactions.voucherId, voucherId),
      orderBy: [desc(voucherTransactions.createdAt)],
    });
    return transactions;
  },

  async getBalance(code: string) {
    const voucher = await this.getByCode(code);
    if (!voucher) {
      return null;
    }
    return {
      code: voucher.code,
      type: voucher.type,
      balance: voucher.currentBalance,
      isActive: voucher.isActive,
      isVoid: voucher.isVoid,
      expiresAt: voucher.expiresAt,
    };
  },
};
