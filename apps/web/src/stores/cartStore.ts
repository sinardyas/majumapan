import { create } from 'zustand';
import { TAX_RATE } from '@pos/shared';
import { 
  saveHeldOrder, 
  getHeldOrder, 
  deleteHeldOrder as deleteHeldOrderFromDb,
  type HeldOrder,
} from '@/db';

const CART_SYNC_CHANNEL = 'pos-cart-sync';
const channel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel(CART_SYNC_CHANNEL) 
  : null;

export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountId?: string;
  discountName?: string;
  discountValue: number;
  promoType?: 'percentage' | 'fixed' | null;
  promoValue?: number;
  promoMinQty?: number;
  promoDiscount?: number;
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
  totalPromoDiscount: number;

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

interface CartSyncMessage {
  type: 'CART_SYNC';
  payload: {
    items: CartItem[];
    cartDiscount: CartDiscount | null;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    totalPromoDiscount: number;
  };
}

const calculatePromoDiscount = (
  quantity: number,
  unitPrice: number,
  promoType: 'percentage' | 'fixed' | undefined | null,
  promoValue: number | undefined | null,
  promoMinQty: number | undefined
): number => {
  if (!promoType || !promoValue || !promoMinQty) {
    return 0;
  }
  
  if (quantity < promoMinQty) {
    return 0;
  }
  
  const basePrice = unitPrice * quantity;
  
  if (promoType === 'percentage') {
    return Math.round((basePrice * promoValue) / 100 * 100) / 100;
  } else {
    return promoValue;
  }
};

const calculateItemSubtotal = (item: Omit<CartItem, 'subtotal'>): number => {
  const basePrice = item.unitPrice * item.quantity;
  const promoDiscount = calculatePromoDiscount(
    item.quantity,
    item.unitPrice,
    item.promoType,
    item.promoValue,
    item.promoMinQty
  );
  const cartDiscount = item.discountValue || 0;
  const totalDiscount = promoDiscount + cartDiscount;
  return Math.round((basePrice - totalDiscount) * 100) / 100;
};

function broadcastCartState(state: CartState) {
  if (!channel) return;
  
  const message: CartSyncMessage = {
    type: 'CART_SYNC',
    payload: {
      items: state.items,
      cartDiscount: state.cartDiscount,
      subtotal: state.subtotal,
      discountAmount: state.discountAmount,
      taxAmount: state.taxAmount,
      total: state.total,
      totalPromoDiscount: state.totalPromoDiscount,
    },
  };
  
  channel.postMessage(message);
}

if (channel) {
  channel.onmessage = (event: MessageEvent<CartSyncMessage>) => {
    if (event.data.type === 'CART_SYNC') {
      const { payload } = event.data;
      useCartStore.setState({
        items: payload.items,
        cartDiscount: payload.cartDiscount,
        subtotal: payload.subtotal,
        discountAmount: payload.discountAmount,
        taxAmount: payload.taxAmount,
        total: payload.total,
        totalPromoDiscount: payload.totalPromoDiscount,
      });
    }
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cartDiscount: null,
  subtotal: 0,
  discountAmount: 0,
  taxAmount: 0,
  total: 0,
  totalPromoDiscount: 0,
  resumedOrderInfo: null,

  addItem: (newItem) => {
    const items = get().items;
    const existingIndex = items.findIndex(item => item.productId === newItem.productId);

    if (existingIndex >= 0) {
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
      const subtotal = calculateItemSubtotal(newItem);
      set({ items: [...items, { ...newItem, subtotal }] });
    }

    get().calculateTotals();
    broadcastCartState(get());
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
    broadcastCartState(get());
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(item => item.productId !== productId) });
    get().calculateTotals();
    broadcastCartState(get());
  },

  applyDiscount: (discount) => {
    set({ cartDiscount: discount });
    get().calculateTotals();
    broadcastCartState(get());
  },

  removeDiscount: () => {
    set({ cartDiscount: null });
    get().calculateTotals();
    broadcastCartState(get());
  },

  clearCart: () => {
    set({
      items: [],
      cartDiscount: null,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
      totalPromoDiscount: 0,
      resumedOrderInfo: null,
    });
    broadcastCartState(get());
  },

  calculateTotals: () => {
    const { items, cartDiscount } = get();
    
    const baseSubtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalPromoDiscount = items.reduce((sum, item) => {
      const promoDiscount = calculatePromoDiscount(
        item.quantity,
        item.unitPrice,
        item.promoType,
        item.promoValue,
        item.promoMinQty
      );
      return sum + promoDiscount;
    }, 0);
    const cartDiscountAmount = cartDiscount?.amount ?? 0;
    
    // subtotal = base price minus product-level promos
    const subtotal = baseSubtotal - totalPromoDiscount;
    
    // discountAmount = only cart-level discount codes
    const discountAmount = cartDiscountAmount;
    
    // tax and total calculated from (subtotal - cart discount)
    const taxableAmount = subtotal - cartDiscountAmount;
    const taxAmount = Math.round(taxableAmount * TAX_RATE * 100) / 100;
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    set({
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount,
      total,
      totalPromoDiscount: Math.round(totalPromoDiscount * 100) / 100,
    });
  },

  holdOrder: async (storeId, cashierId, customerName, note) => {
    const { items, cartDiscount, subtotal, discountAmount, taxAmount, total } = get();
    
    if (items.length === 0) {
      throw new Error('Cannot hold an empty cart');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
        promoType: item.promoType,
        promoValue: item.promoValue,
        promoMinQty: item.promoMinQty,
        promoDiscount: item.promoDiscount,
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

    await saveHeldOrder(heldOrder);
    get().clearCart();

    return heldOrder.id;
  },

  resumeOrder: async (heldOrderId, revalidateDiscount) => {
    const heldOrder = await getHeldOrder(heldOrderId);
    
    if (!heldOrder) {
      return { success: false, error: 'Held order not found' };
    }

    if (new Date(heldOrder.expiresAt) < new Date()) {
      await deleteHeldOrderFromDb(heldOrderId);
      return { success: false, error: 'Held order has expired' };
    }

    let discountRemoved = false;
    let discountName: string | undefined;
    let validatedDiscount: CartDiscount | null = null;

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

    const items: CartItem[] = heldOrder.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      promoType: item.promoType,
      promoValue: item.promoValue,
      promoMinQty: item.promoMinQty,
      promoDiscount: item.promoDiscount,
      discountId: item.discountId,
      discountName: item.discountName,
      discountValue: item.discountValue,
      subtotal: item.subtotal,
    }));

    set({
      items,
      cartDiscount: validatedDiscount,
      resumedOrderInfo: {
        id: heldOrder.id,
        customerName: heldOrder.customerName,
      },
    });

    get().calculateTotals();
    broadcastCartState(get());
    await deleteHeldOrderFromDb(heldOrderId);

    return {
      success: true,
      discountRemoved,
      discountName,
    };
  },

  clearResumedOrderInfo: () => {
    set({ resumedOrderInfo: null });
    broadcastCartState(get());
  },
}));
