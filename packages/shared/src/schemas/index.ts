export * from './auth';
export * from './store';

import { z } from 'zod';

// User schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(255),
  role: z.enum(['admin', 'manager', 'cashier']),
  storeId: z.string().uuid().optional(),
  pin: z.string().length(6).regex(/^\d+$/).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['admin', 'manager', 'cashier']).optional(),
  storeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  description: z.string().max(500).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// Product schemas
export const createProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional(),
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().max(1000).optional(),
  price: z.number().positive('Price must be positive'),
  costPrice: z.number().positive().optional(),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  hasPromo: z.boolean().default(false),
  promoType: z.enum(['percentage', 'fixed']).nullable().optional(),
  promoValue: z.number().positive().nullable().optional(),
  promoMinQty: z.number().int().positive().default(1),
  promoStartDate: z.string().datetime().nullable().optional(),
  promoEndDate: z.string().datetime().nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Stock schemas
export const updateStockSchema = z.object({
  quantity: z.number().int('Quantity must be an integer'),
  lowStockThreshold: z.number().int().positive().optional(),
});

export const adjustStockSchema = z.object({
  adjustments: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int(),
    reason: z.string().optional(),
  })),
});

export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// Discount schemas
export const createDiscountSchema = z.object({
  code: z.string().max(50).optional(),
  name: z.string().min(1, 'Discount name is required').max(255),
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountScope: z.enum(['product', 'cart']),
  value: z.number().positive('Discount value must be positive'),
  minPurchaseAmount: z.number().positive().optional(),
  maxDiscountAmount: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

export const updateDiscountSchema = createDiscountSchema.partial();

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;

// Transaction schemas
export const createTransactionSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    productSku: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    discountId: z.string().uuid().optional(),
    discountName: z.string().optional(),
    discountValue: z.number().optional(),
    subtotal: z.number(),
  })).min(1, 'At least one item is required'),
  subtotal: z.number().positive(),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0),
  discountId: z.string().uuid().optional(),
  discountCode: z.string().optional(),
  discountName: z.string().optional(),
  total: z.number().positive(),
  paymentMethod: z.enum(['cash', 'card']),
  amountPaid: z.number().positive(),
  changeAmount: z.number().min(0),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// Split transaction schema (for transactions with multiple payment methods)
export const createSplitTransactionSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    productSku: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    discountId: z.string().uuid().optional(),
    discountName: z.string().optional(),
    discountValue: z.number().optional(),
    subtotal: z.number(),
  })).min(1, 'At least one item is required'),
  subtotal: z.number().positive(),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0),
  discountId: z.string().uuid().optional(),
  discountCode: z.string().optional(),
  discountName: z.string().optional(),
  total: z.number().positive(),
  isSplitPayment: z.boolean().default(false),
  payments: z.array(z.object({
    paymentMethod: z.enum(['cash', 'card']),
    amount: z.number().positive(),
    changeAmount: z.number().min(0).default(0),
  })).min(1, 'At least one payment is required'),
});

export type CreateSplitTransactionInput = z.infer<typeof createSplitTransactionSchema>;

// Sync schemas
export const syncPushSchema = z.object({
  transactions: z.array(z.object({
    clientId: z.string().uuid(),
    clientTimestamp: z.string().datetime(),
    items: z.array(z.object({
      productId: z.string().uuid(),
      productName: z.string(),
      productSku: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      discountId: z.string().uuid().optional(),
      discountName: z.string().optional(),
      discountValue: z.number().optional(),
      subtotal: z.number(),
    })),
    subtotal: z.number(),
    taxAmount: z.number(),
    discountAmount: z.number(),
    discountId: z.string().uuid().optional(),
    discountCode: z.string().optional(),
    discountName: z.string().optional(),
    total: z.number(),
    isSplitPayment: z.boolean().optional().default(false),
    paymentMethod: z.enum(['cash', 'card']).optional(),
    amountPaid: z.number().optional(),
    changeAmount: z.number().optional(),
    payments: z.array(z.object({
      paymentMethod: z.enum(['cash', 'card']),
      amount: z.number(),
      changeAmount: z.number().optional().default(0),
    })).optional(),
    vouchers: z.array(z.object({
      id: z.string().uuid(),
      code: z.string(),
      type: z.enum(['GC', 'PR']),
      amountApplied: z.number(),
    })).optional(),
  })),
});

export type SyncPushInput = z.infer<typeof syncPushSchema>;

// Query params schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
