import { db } from '../db';
import { appSettings, auditLogTable } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrencyConfig, CURRENCY_CONFIG } from '@pos/shared';

interface CurrencyConfigInput {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  isActive?: boolean;
}

interface ExchangeRatesData {
  rates: Record<string, number>;
  updatedAt: string;
  source: string;
}

interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  isActive?: boolean;
}

export const configService = {
  async getCurrencyConfig(): Promise<CurrencyConfig | null> {
    const result = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'currency_config'),
    });

    if (!result) {
      return getCurrencyConfig('IDR');
    }

    try {
      const parsed = JSON.parse(result.value) as CurrencyConfig;
      return parsed;
    } catch {
      return getCurrencyConfig('IDR');
    }
  },

  async setCurrencyConfig(
    input: CurrencyConfigInput,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const existing = await this.getCurrencyConfig();

    await db.transaction(async (tx) => {
      await tx.insert(appSettings)
        .values({
          key: 'currency_config',
          value: JSON.stringify(input),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: JSON.stringify(input),
            updatedAt: new Date(),
          },
        });

      await tx.insert(auditLogTable).values({
        userId,
        userEmail,
        action: 'UPDATE',
        entityType: 'currency_config',
        entityId: 'currency_config',
        entityName: 'Currency Configuration',
        changes: {
          old: existing,
          new: input,
        },
        createdAt: new Date(),
      });
    });
  },

  async getExchangeRates(): Promise<ExchangeRatesData | null> {
    const result = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'exchange_rates'),
    });

    if (!result) {
      return null;
    }

    try {
      const parsed = JSON.parse(result.value);
      return {
        rates: parsed,
        updatedAt: result.updatedAt?.toISOString() || new Date().toISOString(),
        source: 'manual',
      };
    } catch {
      return null;
    }
  },

  async setExchangeRates(
    rates: Record<string, number>,
    userId: string,
    userEmail: string,
    source: string = 'manual'
  ): Promise<void> {
    const data = {
      ...rates,
      updatedAt: new Date().toISOString(),
      source,
    };

    await db.transaction(async (tx) => {
      await tx.insert(appSettings)
        .values({
          key: 'exchange_rates',
          value: JSON.stringify(data),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: JSON.stringify(data),
            updatedAt: new Date(),
          },
        });

      await tx.insert(auditLogTable).values({
        userId,
        userEmail,
        action: 'UPDATE',
        entityType: 'exchange_rates',
        entityId: 'exchange_rates',
        entityName: 'Exchange Rates',
        changes: { rates },
        createdAt: new Date(),
      });
    });
  },

  async getCurrencyHistory(limit: number = 50) {
    const history = await db.query.auditLogTable.findMany({
      where: eq(auditLogTable.entityType, 'currency_config'),
      orderBy: [desc(auditLogTable.createdAt)],
      limit,
    });

    return history;
  },

  async getSupportedCurrencies() {
    return Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
      code,
      name: new Intl.DisplayNames([config.locale], { type: 'currency' }).of(code) || code,
      symbol: config.symbol,
    }));
  },

  async getActiveCurrencyCode(): Promise<string> {
    const config = await this.getCurrencyConfig();
    return config?.code || 'IDR';
  },
};
