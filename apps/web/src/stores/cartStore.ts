import { create } from 'zustand';
import { TAX_RATE } from '@pos/shared';
import { 
  saveHeldOrder, 
  getHeldOrder, 
  deleteHeldOrder as deleteHeldOrderFromDb,
  type HeldOrder,
  type HeldOrderDiscount,
} from '@/db';

export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountId?: string;
  discountName?: string;
  discountValue: number;
  subtotal: number;
}

export interface CartDiscount {
  id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  amount: number;
}

export interface ResumedOrderInfo {
  id: string;
  customerName?: string;
}

export interface ResumeOrderResult {
  success: boolean;
  discountRemoved?: boolean;
  discountName?: string;
  error?: string;
}

interface CartState {
  items: CartItem[];
  cartDiscount: CartDiscount | null;
  
  // Computed (will be calculated from items)
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Hold Order state
  resumedOrderInfo: ResumedOrderInfo | null;

  // Actions
  addItem: (item: Omit<CartItem, 'subtotal'>) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  applyDiscount: (discount: CartDiscount) => void;
  removeDiscount: () => void;
  clearCart: () => void;
  calculateTotals: () => void;

  // Hold Order actions
  holdOrder: (
    storeId: string,
    cashierId: string,
    customerName?: string,
    note?: string
  ) => Promise<string>;
  resumeOrder: (
    heldOrderId: string,
    revalidateDiscount: (discount: CartDiscount) => Promise<boolean>
  ) => Promise<ResumeOrderResult>;
  clearResumedOrderInfo: () => void;
}

const calculateItemSubtotal = (item: Omit<CartItem, 'subtotal'>): number => {
  return (item.unitPrice * item.quantity) - item.discountValue;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cartDiscount: null,
  subtotal: 0,
  discountAmount: 0,
  taxAmount: 0,
  total: 0,
  resumedOrderInfo: null,

  addItem: (newItem) => {
    const items = get().items;
    const existingIndex = items.findIndex(item => item.productId === newItem.productId);

    if (existingIndex >= 0) {
      // Update quantity if item exists
      const updatedItems = [...items];
      const existingItem = updatedItems[existingIndex];
      const updatedQuantity = existingItem.quantity + newItem.quantity;
      updatedItems[existingIndex] = {
        ...existingItem,
        quantity: updatedQuantity,
        subtotal: calculateItemSubtotal({ ...existingItem, quantity: updatedQuantity }),
      };
      set({ items: updatedItems });
    } else {
      // Add new item
      const subtotal = calculateItemSubtotal(newItem);
      set({ items: [...items, { ...newItem, subtotal }] });
    }

    get().calculateTotals();
  },

  updateItemQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    const items = get().items.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          quantity,
          subtotal: calculateItemSubtotal({ ...item, quantity }),
        };
      }
      return item;
    });

    set({ items });
    get().calculateTotals();
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(item => item.productId !== productId) });
    get().calculateTotals();
  },

  applyDiscount: (discount) => {
    set({ cartDiscount: discount });
    get().calculateTotals();
  },

  removeDiscount: () => {
    set({ cartDiscount: null });
    get().calculateTotals();
  },

  clearCart: () => {
    set({
      items: [],
      cartDiscount: null,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
      resumedOrderInfo: null,
    });
  },

  calculateTotals: () => {
    const { items, cartDiscount } = get();
    
    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Calculate cart discount amount
    const discountAmount = cartDiscount?.amount ?? 0;
    
    // Calculate tax on discounted subtotal
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = Math.round(taxableAmount * TAX_RATE * 100) / 100;
    
    // Calculate total
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    set({
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount,
      total,
    });
  },

  // ==========================================================================
  // Hold Order Actions
  // See docs/features/hold-order.md and ADR-0004
  // ==========================================================================

  holdOrder: async (storeId, cashierId, customerName, note) => {
    const { items, cartDiscount, subtotal, discountAmount, taxAmount, total } = get();
    
    if (items.length === 0) {
      throw new Error('Cannot hold an empty cart');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const heldOrder: HeldOrder = {
      id: crypto.randomUUID(),
      storeId,
      cashierId,
      customerName,
      note,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountId: item.discountId,
        discountName: item.discountName,
        discountValue: item.discountValue,
        subtotal: item.subtotal,
      })),
      cartDiscount: cartDiscount ? {
        id: cartDiscount.id,
        code: cartDiscount.code,
        name: cartDiscount.name,
        discountType: cartDiscount.discountType,
        value: cartDiscount.value,
        amount: cartDiscount.amount,
      } : null,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      heldAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Save to IndexedDB
    await saveHeldOrder(heldOrder);

    // Clear the cart
    get().clearCart();

    return heldOrder.id;
  },

  resumeOrder: async (heldOrderId, revalidateDiscount) => {
    const heldOrder = await getHeldOrder(heldOrderId);
    
    if (!heldOrder) {
      return { success: false, error: 'Held order not found' };
    }

    // Check if order has expired
    if (new Date(heldOrder.expiresAt) < new Date()) {
      await deleteHeldOrderFromDb(heldOrderId);
      return { success: false, error: 'Held order has expired' };
    }

    let discountRemoved = false;
    let discountName: string | undefined;
    let validatedDiscount: CartDiscount | null = null;

    // Re-validate discount if one was applied
    if (heldOrder.cartDiscount) {
      const cartDiscount: CartDiscount = {
        id: heldOrder.cartDiscount.id,
        code: heldOrder.cartDiscount.code,
        name: heldOrder.cartDiscount.name,
        discountType: heldOrder.cartDiscount.discountType,
        value: heldOrder.cartDiscount.value,
        amount: heldOrder.cartDiscount.amount,
      };

      const isValid = await revalidateDiscount(cartDiscount);
      
      if (isValid) {
        validatedDiscount = cartDiscount;
      } else {
        discountRemoved = true;
        discountName = heldOrder.cartDiscount.name;
      }
    }

    // Load items into cart
    const items: CartItem[] = heldOrder.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountId: item.discountId,
      discountName: item.discountName,
      discountValue: item.discountValue,
      subtotal: item.subtotal,
    }));

    // Set cart state
    set({
      items,
      cartDiscount: validatedDiscount,
      resumedOrderInfo: {
        id: heldOrder.id,
        customerName: heldOrder.customerName,
      },
    });

    // Recalculate totals (especially if discount was removed)
    get().calculateTotals();

    // Delete held order from IndexedDB
    await deleteHeldOrderFromDb(heldOrderId);

    return {
      success: true,
      discountRemoved,
      discountName,
    };
  },

  clearResumedOrderInfo: () => {
    set({ resumedOrderInfo: null });
  },
}));
