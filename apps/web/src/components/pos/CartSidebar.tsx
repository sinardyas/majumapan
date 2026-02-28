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
  isMobile?: boolean;
  onCloseMobile?: () => void;
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
  isMobile,
  onCloseMobile,
}: CartSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile header with close button */}
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Cart</h2>
          <button
            onClick={onCloseMobile}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
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
