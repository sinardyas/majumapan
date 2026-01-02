import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore, type CartItem } from '@/stores/cartStore';
import { db } from '@/db';
import { TAX_RATE, CURRENCY } from '@pos/shared';
import { Tag } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  value: number;
  priority?: 'high' | 'normal';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
  }).format(amount);
}

function PromotionBanner({ promotions }: { promotions: Promotion[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (promotions.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [promotions.length]);

  if (promotions.length === 0) {
    return (
      <div className="h-full bg-gradient-to-r from-primary-600 to-primary-700 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-4xl font-bold mb-4">Welcome!</p>
          <p className="text-xl opacity-90">Start adding items to your order</p>
        </div>
      </div>
    );
  }

  const currentPromotion = promotions[currentIndex];

  return (
    <div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 flex flex-col">
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="whitespace-nowrap px-4">
          {promotions.map((p) => (
            <span key={p.id} className="inline-block mx-8 text-3xl font-bold text-white">
              {p.name}
            </span>
          ))}
        </div>
      </div>
      <div className="py-12 px-8 text-center text-white">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Tag className="h-8 w-8" />
          <span className="text-5xl font-bold">
            {currentPromotion.name}
          </span>
	</div>
        {currentPromotion.description && (
          <p className="text-2xl opacity-90 mb-4">{currentPromotion.description}</p>
        )}
        <span className="inline-block bg-white/20 px-6 py-3 rounded-full text-2xl font-bold">
          {currentPromotion.discountType === 'percentage'
            ? `${currentPromotion.value}% OFF`
            : formatCurrency(currentPromotion.value) + ' OFF'}
        </span>
      </div>
      {promotions.length > 1 && (
        <div className="flex justify-center gap-2 pb-6">
          {promotions.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i === currentIndex ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CartItemRow({ item }: { item: CartItem }) {
  const hasDiscount = item.discountValue > 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="bg-primary-100 text-primary-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shrink-0">
          {item.quantity}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-gray-900 truncate">
            {item.productName}
          </p>
          {hasDiscount && item.discountName && (
            <p className="text-xs text-green-600 truncate">
              {item.discountName}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-lg font-bold text-gray-900">
          {formatCurrency(item.subtotal)}
        </p>
        {hasDiscount && (
          <p className="text-xs text-green-600">
            -{formatCurrency(item.discountValue)}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyCartState() {
  return (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      <p className="text-xl">Your cart is empty</p>
    </div>
  );
}

export default function CustomerDisplay() {
  const { user } = useAuthStore();
  const { items, subtotal, discountAmount, taxAmount, total } =
    useCartStore();
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    const loadPromotions = async () => {
      const now = new Date();
      const activePromotions = await db.discounts
        .filter((d) => d.isActive === true)
        .filter((d) => {
          const afterStart = !d.startDate || new Date(d.startDate) <= now;
          const beforeEnd = !d.endDate || new Date(d.endDate) >= now;
          return afterStart && beforeEnd;
        })
        .toArray();

      const formatted: Promotion[] = activePromotions.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        discountType: d.discountType,
        value: d.value,
        priority: 'normal',
      }));

      setPromotions(formatted);
    };

    loadPromotions();

    const interval = setInterval(loadPromotions, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-row">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Left Side - Promotion Banner (66.6% width) */}
      <div className="w-[66.6%] h-full">
        <PromotionBanner promotions={promotions} />
      </div>

      {/* Right Side - Cart Area (33.4% width) */}
      <div className="w-[33.4%] h-full bg-white flex flex-col">
        {/* Cashier Name */}
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-right text-sm text-gray-500">
            Cashier: <span className="font-medium text-gray-700">{user?.name || 'Staff'}</span>
          </p>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <EmptyCartState />
          ) : (
            <div className="py-4">
              {items.map((item) => (
                <CartItemRow key={item.productId} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="px-6 py-6 border-t border-gray-200 bg-gray-50">
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-300">
              <span className="text-xl font-bold text-gray-900">TOTAL</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
