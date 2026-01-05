import { useEffect, useState, useCallback, useRef } from 'react';
import { db, COLOR_THEMES } from '@/db';
import { Tag, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface PromotionCarouselProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

interface DisplayPromotion {
  id: string;
  name: string;
  description: string | null;
  bannerImageUrl: string | null;
  colorTheme: string;
  displayDuration: number;
  discountValue?: number;
  discountType?: 'percentage' | 'fixed';
}

function getThemeStyles(themeId: string) {
  const theme = COLOR_THEMES.find(t => t.id === themeId);
  if (!theme) {
    return {
      gradient: 'from-orange-500 to-red-500',
      bgLight: 'bg-orange-50',
      textColor: 'text-orange-600',
    };
  }

  const themeMap: Record<string, { gradient: string; bgLight: string; textColor: string }> = {
    'sunset-orange': { gradient: 'from-orange-500 to-red-500', bgLight: 'bg-orange-50', textColor: 'text-orange-600' },
    'ocean-blue': { gradient: 'from-blue-500 to-cyan-500', bgLight: 'bg-blue-50', textColor: 'text-blue-600' },
    'forest-green': { gradient: 'from-green-500 to-emerald-500', bgLight: 'bg-green-50', textColor: 'text-green-600' },
    'royal-purple': { gradient: 'from-purple-500 to-indigo-500', bgLight: 'bg-purple-50', textColor: 'text-purple-600' },
    'cherry-red': { gradient: 'from-red-500 to-rose-500', bgLight: 'bg-red-50', textColor: 'text-red-600' },
  };

  return themeMap[themeId] || themeMap['sunset-orange'];
}

export function PromotionCarousel({ onClose, showCloseButton }: PromotionCarouselProps) {
  const [promotions, setPromotions] = useState<DisplayPromotion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPromotions = useCallback(async () => {
    const now = new Date();

    const activePromotions = await db.promotions
      .filter((p) => p.isActive === true && p.showOnDisplay === true)
      .filter((p) => {
        const afterStart = !p.startDate || new Date(p.startDate) <= now;
        const beforeEnd = !p.endDate || new Date(p.endDate) >= now;
        return afterStart && beforeEnd;
      })
      .sortBy('displayPriority');

    if (activePromotions.length > 0) {
      const formatted: DisplayPromotion[] = activePromotions.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        bannerImageUrl: p.bannerImageUrl || null,
        colorTheme: p.colorTheme,
        displayDuration: p.displayDuration || 5000,
      }));
      setPromotions(formatted);
      return;
    }

    const activeDiscounts = await db.discounts
      .filter((d) => d.isActive === true)
      .filter((d) => {
        const afterStart = !d.startDate || new Date(d.startDate) <= now;
        const beforeEnd = !d.endDate || new Date(d.endDate) >= now;
        return afterStart && beforeEnd;
      })
      .toArray();

    if (activeDiscounts.length > 0) {
      const formatted: DisplayPromotion[] = activeDiscounts.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        bannerImageUrl: null,
        colorTheme: 'sunset-orange',
        displayDuration: 5000,
        discountValue: d.value,
        discountType: d.discountType,
      }));
      setPromotions(formatted);
    }
  }, []);

  useEffect(() => {
    loadPromotions();
    const interval = setInterval(loadPromotions, 30000);
    return () => clearInterval(interval);
  }, [loadPromotions]);

  useEffect(() => {
    if (promotions.length <= 1) return;

    const duration = promotions[currentIndex]?.displayDuration || 5000;
    intervalRef.current = setInterval(() => {
      goToNext();
    }, duration);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [promotions.length, currentIndex]);

  const goToNext = useCallback(() => {
    if (isTransitioning || promotions.length === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % promotions.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isTransitioning, promotions.length]);

  const goToPrev = useCallback(() => {
    if (isTransitioning || promotions.length === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isTransitioning, promotions.length]);

  const goToIndex = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isTransitioning, currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

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
  const themeStyles = getThemeStyles(currentPromotion.colorTheme);
  const gradientClass = themeStyles.gradient;

  return (
    <div
      className="h-full relative overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {promotions.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
            aria-label="Previous promotion"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
            aria-label="Next promotion"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
          aria-label="Close carousel"
        >
          <X className="h-6 w-6" />
        </button>
      )}

      <div
        className="h-full transition-opacity duration-300"
        style={{
          background: currentPromotion.bannerImageUrl
            ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${currentPromotion.bannerImageUrl}) center/cover`
            : undefined,
        }}
      >
        {!currentPromotion.bannerImageUrl ? (
          <div className={`h-full bg-gradient-to-r ${gradientClass} flex flex-col`}>
            <div className="flex-1 flex items-center justify-center">
              <div className="whitespace-nowrap px-4">
                {promotions.map((p) => (
                  <span
                    key={p.id}
                    className="inline-block mx-8 text-3xl font-bold text-white"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-end pb-8">
            <div className="flex-1" />
            <div className="text-center text-white px-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Tag className="h-8 w-8" />
                <span className="text-5xl font-bold">{currentPromotion.name}</span>
              </div>
              {currentPromotion.description && (
                <p className="text-2xl opacity-90 mb-4">{currentPromotion.description}</p>
              )}
              {currentPromotion.discountValue && currentPromotion.discountType && (
                <span className="inline-block bg-white/20 px-6 py-3 rounded-full text-2xl font-bold">
                  {currentPromotion.discountType === 'percentage'
                    ? `${currentPromotion.discountValue}% OFF`
                    : `$${currentPromotion.discountValue} OFF`}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {promotions.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex justify-center gap-2">
          {promotions.map((_, i) => (
            <button
              key={i}
              onClick={() => goToIndex(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === currentIndex
                  ? 'bg-white scale-125'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to promotion ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
