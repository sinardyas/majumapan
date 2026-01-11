import type { CartItem, CartDiscount } from '@/stores/cartStore';
import { CurrentOrder } from './CurrentOrder';

export interface CartSidebarProps {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cartDiscount: CartDiscount | null;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyDiscount: (code: string) => void;
  onRemoveDiscount: () => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  onPay: () => void;
  cashierName?: string;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  discountError: string;
  setDiscountError: (error: string) => void;
  isApplyingDiscount?: boolean;
}

export function CartSidebar({
  items,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  cartDiscount,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onRemoveDiscount,
  onClearCart,
  onHoldOrder,
  onPay,
  cashierName,
  heldOrdersCount,
  onOpenHeldOrders,
  discountError,
  setDiscountError,
  isApplyingDiscount,
}: CartSidebarProps) {
  return (
    <div className="w-96 max-w-md bg-white border-l border-gray-200 flex flex-col h-full">
      <CurrentOrder
        items={items}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        subtotal={subtotal}
        discountAmount={discountAmount}
        taxAmount={taxAmount}
        total={total}
        cartDiscount={cartDiscount}
        onApplyDiscount={onApplyDiscount}
        onRemoveDiscount={onRemoveDiscount}
        onClearCart={onClearCart}
        onHoldOrder={onHoldOrder}
        onPay={onPay}
        cashierName={cashierName}
        heldOrdersCount={heldOrdersCount}
        onOpenHeldOrders={onOpenHeldOrders}
        discountError={discountError}
        setDiscountError={setDiscountError}
        isApplyingDiscount={isApplyingDiscount}
      />
    </div>
  );
}

export { CartSidebar as OrderSummary };
