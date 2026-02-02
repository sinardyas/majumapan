import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { formatCurrency as sharedFormatCurrency } from '@pos/shared/utils/currency';

interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  isActive: boolean;
}

export function useCurrencyConfig() {
  const [config, setConfig] = useState<CurrencyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await api.get<any>('/config/currency');
      if (response?.success && response?.data) {
        setConfig(response.data);
      } else {
        setError('Failed to load currency config');
      }
    } catch (err) {
      setError('Failed to load currency config');
      console.error('Error fetching currency config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const formatCurrency = useCallback((amount: number | string) => {
    if (config) {
      return sharedFormatCurrency(amount, { currency: config.code });
    }
    return sharedFormatCurrency(amount);
  }, [config]);

  const formatCompact = useCallback((amount: number) => {
    if (config) {
      return sharedFormatCurrency(amount, { currency: config.code, compact: true });
    }
    return sharedFormatCurrency(amount, { compact: true });
  }, [config]);

  const getSymbol = useCallback(() => {
    return config?.symbol || 'Rp';
  }, [config]);

  return {
    config,
    loading,
    error,
    formatCurrency,
    formatCompact,
    getSymbol,
    refresh: fetchConfig,
  };
}

export function formatCurrency(amount: number | string, currencyCode?: string): string {
  return sharedFormatCurrency(amount, { currency: currencyCode });
}

export function formatCompact(amount: number, currencyCode?: string): string {
  return sharedFormatCurrency(amount, { currency: currencyCode, compact: true });
}
