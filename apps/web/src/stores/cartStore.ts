import { create } from 'zustand';
import { TAX_RATE } from '@pos/shared';

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

interface CartDiscount {
  id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  amount: number;
}

interface CartState {
  items: CartItem[];
  cartDiscount: CartDiscount | null;
  
  // Computed (will be calculated from items)
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Actions
  addItem: (item: Omit<CartItem, 'subtotal'>) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  applyDiscount: (discount: CartDiscount) => void;
  removeDiscount: () => void;
  clearCart: () => void;
  calculateTotals: () => void;
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
}));
