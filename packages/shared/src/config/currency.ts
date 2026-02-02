export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

export const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    locale: 'id-ID',
    decimals: 0,
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    locale: 'ja-JP',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    locale: 'de-DE',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    locale: 'en-GB',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    locale: 'en-SG',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  MYR: {
    code: 'MYR',
    symbol: 'RM',
    locale: 'ms-MY',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
};

export function getCurrencyConfig(code: string): CurrencyConfig {
  return CURRENCY_CONFIG[code] || CURRENCY_CONFIG['IDR'];
}

export function isValidCurrency(code: string): boolean {
  return code in CURRENCY_CONFIG;
}

export function getDefaultCurrency(): CurrencyConfig {
  return CURRENCY_CONFIG['IDR'];
}

export function getSupportedCurrencies(): CurrencyConfig[] {
  return Object.values(CURRENCY_CONFIG);
}

export function formatCurrencyCode(code: string): string {
  const config = getCurrencyConfig(code);
  return `${config.symbol} (${config.code})`;
}
