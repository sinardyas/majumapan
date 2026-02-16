import * as React from 'react';
import { cn } from './lib/utils';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  allowDecimal?: boolean;
  showClear?: boolean;
  showBackspace?: boolean;
  submitLabel?: string;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
  autoSubmit?: boolean;
  className?: string;
}

export function Numpad({
  value,
  onChange,
  maxLength = 10,
  allowDecimal = false,
  showClear = false,
  showBackspace = true,
  submitLabel,
  onSubmit,
  disabled = false,
  autoSubmit = false,
  className,
}: NumpadProps) {
  const handleKeyPress = React.useCallback(
    (key: string) => {
      if (disabled) return;

      if (key === 'clear') {
        onChange('');
        return;
      }

      if (key === 'backspace') {
        onChange(value.slice(0, -1));
        return;
      }

      if (key === 'submit') {
        if (value.length > 0 && onSubmit) {
          onSubmit(value);
        }
        return;
      }

      if (key === '.') {
        if (allowDecimal && !value.includes('.')) {
          onChange(value + '.');
        }
        return;
      }

      if (/^\d$/.test(key)) {
        if (value.length < maxLength) {
          const newValue = value + key;
          onChange(newValue);
          if (autoSubmit && newValue.length === maxLength) {
            setTimeout(() => {
              if (onSubmit) onSubmit(newValue);
            }, 100);
          }
        }
      }
    },
    [disabled, onChange, maxLength, allowDecimal, value, autoSubmit, onSubmit]
  );

  const getButtonClass = (type: 'digit' | 'decimal' | 'clear' | 'backspace' | 'submit') => {
    const base = 'h-14 rounded-lg font-medium text-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
    
    if (disabled) {
      return `${base} bg-gray-100 text-gray-400 cursor-not-allowed`;
    }

    switch (type) {
      case 'clear':
        return `${base} bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300`;
      case 'backspace':
        return `${base} bg-gray-50 text-gray-700 hover:bg-gray-200 active:bg-gray-300`;
      case 'submit':
        return `${base} bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800`;
      case 'decimal':
        return `${base} bg-gray-50 text-gray-900 hover:bg-gray-200 active:bg-gray-300 ${!allowDecimal ? 'opacity-50 cursor-not-allowed' : ''}`;
      default:
        return `${base} bg-white text-gray-900 hover:bg-gray-100 active:bg-gray-200`;
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyPress(key)}
            disabled={disabled}
            className={getButtonClass('digit')}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {allowDecimal ? (
          <button
            type="button"
            onClick={() => handleKeyPress('.')}
            disabled={disabled || value.includes('.')}
            className={getButtonClass('decimal')}
          >
            .
          </button>
        ) : showClear ? (
          <button
            type="button"
            onClick={() => handleKeyPress('clear')}
            disabled={disabled}
            className={getButtonClass('clear')}
          >
            C
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          disabled={disabled}
          className={getButtonClass('digit')}
        >
          0
        </button>

        {showBackspace ? (
          <button
            type="button"
            onClick={() => handleKeyPress('backspace')}
            disabled={disabled || value.length === 0}
            className={getButtonClass('backspace')}
          >
            <span className="text-lg">⌫</span>
          </button>
        ) : showClear ? (
          <button
            type="button"
            onClick={() => handleKeyPress('clear')}
            disabled={disabled}
            className={getButtonClass('clear')}
          >
            C
          </button>
        ) : (
          <div />
        )}
      </div>

      {submitLabel && (
        <button
          type="button"
          onClick={() => handleKeyPress('submit')}
          disabled={disabled || value.length === 0}
          className={getButtonClass('submit')}
        >
          {submitLabel}
        </button>
      )}
    </div>
  );
}
