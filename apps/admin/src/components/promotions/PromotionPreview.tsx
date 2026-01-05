import { X, Play, Pause } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface PromotionPreviewProps {
  promotions: Array<{
    name: string;
    description: string | null;
    bannerImageUrl: string;
    colorTheme: string;
    displayDuration: number;
  }>;
  onClose: () => void;
}

export function PromotionPreview({ promotions, onClose }: PromotionPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPromotion = promotions[currentIndex];
  const duration = currentPromotion?.displayDuration || 5;

  useEffect(() => {
    if (!isPlaying || promotions.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, duration * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, promotions.length, duration]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % promotions.length);
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Preview</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Preview Area - Simulates Customer Display */}
          <div className="aspect-[3.2/1] bg-gray-900 rounded-lg overflow-hidden relative">
            {currentPromotion ? (
              <>
                {/* Banner Image */}
                <img
                  src={currentPromotion.bannerImageUrl}
                  alt={currentPromotion.name}
                  className="w-full h-full object-cover"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

                {/* Content */}
                <div className="absolute inset-0 flex items-center justify-start pl-12">
                  <div className="text-white max-w-xl">
                    <h3 className="text-4xl font-bold mb-2">
                      {currentPromotion.name}
                    </h3>
                    {currentPromotion.description && (
                      <p className="text-xl opacity-90">
                        {currentPromotion.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {promotions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleDotClick(i)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        i === currentIndex
                          ? 'bg-white scale-110'
                          : 'bg-white/50 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <p className="text-xl">No promotions to preview</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={handlePrev}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={promotions.length <= 1}
            >
              Previous
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Play
                </>
              )}
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={promotions.length <= 1}
            >
              Next
            </button>
          </div>

          {/* Info */}
          <p className="text-center text-sm text-gray-500 mt-4">
            {promotions.length} promotion(s) • {duration}s per slide
          </p>
        </div>
      </div>
    </div>
  );
}
