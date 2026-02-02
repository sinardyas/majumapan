import { getCurrencyConfig, type CurrencyConfig } from '../config/currency';

interface CurrencyFormattingOptions {
  currency?: string;
  decimals?: number;
  compact?: boolean;
  symbol?: string;
}

export function formatCurrency(
  amount: number | string,
  options: CurrencyFormattingOptions = {}
): string {
  const currencyCode = options.currency || 'IDR';
  const config = getCurrencyConfig(currencyCode);

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return 'Invalid amount';

  if (options.compact) {
    return formatCompactWithConfig(numAmount, config);
  }

  const decimals = options.decimals ?? config.decimals;

  const formattedNumber = formatNumberValue(numAmount, config.locale, decimals);

  return `${config.symbol} ${formattedNumber}`;
}

export function formatCompact(amount: number, currencyCode: string = 'IDR'): string {
  const config = getCurrencyConfig(currencyCode);
  return formatCompactWithConfig(amount, config);
}

function formatCompactWithConfig(amount: number, config: CurrencyConfig): string {
  const formatter = new Intl.NumberFormat(config.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return `${config.symbol} ${formatter.format(amount)}`;
}

export function formatCompactWithConfigValue(amount: number, config: CurrencyConfig): string {
  return formatCompactWithConfig(amount, config);
}

export function parseCurrency(formatted: string, currencyCode: string = 'IDR'): number {
  const config = getCurrencyConfig(currencyCode);
  const cleanString = formatted
    .replace(config.symbol, '')
    .replace(config.thousandsSeparator, '')
    .replace(config.decimalSeparator, '.')
    .trim();

  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatPercent(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(
  value: number | string,
  currencyCode: string = 'IDR',
  decimals?: number
): string {
  const config = getCurrencyConfig(currencyCode);
  const dec = decimals ?? config.decimals;
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return formatNumberValue(numValue, config.locale, dec);
}

function formatNumberValue(value: number, locale: string, decimals: number): string {
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatter.format(value);
}

export function formatCurrencyWithoutSymbol(
  value: number | string,
  currencyCode: string = 'IDR'
): string {
  const config = getCurrencyConfig(currencyCode);
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return formatNumberValue(numValue, config.locale, config.decimals);
}

export function getCurrencySymbol(currencyCode: string = 'IDR'): string {
  const config = getCurrencyConfig(currencyCode);
  return config.symbol;
}

export function getCurrencyLocale(currencyCode: string = 'IDR'): string {
  const config = getCurrencyConfig(currencyCode);
  return config.locale;
}

export function getCurrencyDecimals(currencyCode: string = 'IDR'): number {
  const config = getCurrencyConfig(currencyCode);
  return config.decimals;
}

export function convertCurrency(
  amount: number,
  fromRate: number,
  toRate: number
): number {
  if (fromRate === 0) return 0;
  return (amount / fromRate) * toRate;
}
