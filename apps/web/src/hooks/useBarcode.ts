import { useState, useEffect, useCallback, useRef } from 'react';

interface UseBarcodeOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxDelay?: number; // Max delay between keystrokes in ms
}

export function useBarcode({ onScan, minLength = 4, maxDelay = 50 }: UseBarcodeOptions) {
  const [buffer, setBuffer] = useState('');
  const lastKeyTime = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime.current;

    // If it's been too long since last keystroke, reset buffer
    if (timeDiff > maxDelay && buffer.length > 0) {
      setBuffer('');
    }

    lastKeyTime.current = currentTime;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Handle Enter key - submit the barcode
    if (event.key === 'Enter') {
      if (buffer.length >= minLength) {
        onScan(buffer);
      }
      setBuffer('');
      return;
    }

    // Only accept alphanumeric characters
    if (event.key.length === 1 && /^[a-zA-Z0-9]$/.test(event.key)) {
      setBuffer((prev) => prev + event.key);

      // Set a timeout to clear the buffer if no more keystrokes
      timeoutRef.current = setTimeout(() => {
        setBuffer('');
      }, maxDelay * 3);
    }
  }, [buffer, maxDelay, minLength, onScan]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  // Manual scan function for input field usage
  const manualScan = useCallback((barcode: string) => {
    if (barcode.length >= minLength) {
      onScan(barcode);
    }
  }, [minLength, onScan]);

  return {
    buffer,
    manualScan,
    clearBuffer: () => setBuffer(''),
  };
}
