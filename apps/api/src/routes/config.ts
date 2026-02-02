import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { configService } from '../services/config-service';

const configRouter = new Hono();

configRouter.get('/currency', async (c) => {
  try {
    const config = await configService.getCurrencyConfig();
    if (!config) {
      return c.json({ success: false, error: 'Currency configuration not found' }, 404);
    }
    return c.json({ success: true, data: config });
  } catch (error) {
    console.error('Get currency config error:', error);
    return c.json({ success: false, error: 'Failed to get currency configuration' }, 500);
  }
});

configRouter.get('/currencies', async (c) => {
  try {
    const supported = await configService.getSupportedCurrencies();
    const currentCode = await configService.getActiveCurrencyCode();
    return c.json({ success: true, data: { supported, current: currentCode } });
  } catch (error) {
    console.error('Get currencies error:', error);
    return c.json({ success: false, error: 'Failed to get currencies' }, 500);
  }
});

configRouter.get('/exchange-rates', async (c) => {
  try {
    const rates = await configService.getExchangeRates();
    return c.json({ success: true, data: rates });
  } catch (error) {
    console.error('Get exchange rates error:', error);
    return c.json({ success: false, error: 'Failed to get exchange rates' }, 500);
  }
});

configRouter.get('/currency/history', authMiddleware, requirePermission('settings:read'), async (c) => {
  try {
    const history = await configService.getCurrencyHistory();
    return c.json({ success: true, data: { history, total: history.length } });
  } catch (error) {
    console.error('Get currency history error:', error);
    return c.json({ success: false, error: 'Failed to get history' }, 500);
  }
});

configRouter.post('/currency', authMiddleware, requirePermission('settings:update'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const { code, symbol, locale, decimals, thousandsSeparator, decimalSeparator } = body;

    if (!code || !symbol || !locale) {
      return c.json({ success: false, error: 'Missing required fields: code, symbol, locale' }, 400);
    }

    await configService.setCurrencyConfig(
      {
        code,
        symbol,
        locale,
        decimals: decimals ?? 0,
        thousandsSeparator: thousandsSeparator ?? ',',
        decimalSeparator: decimalSeparator ?? '.',
        isActive: true,
      },
      user.userId,
      user.email
    );

    return c.json({ success: true, data: { message: 'Currency configuration updated' } });
  } catch (error) {
    console.error('Update currency config error:', error);
    return c.json({ success: false, error: 'Failed to update currency configuration' }, 500);
  }
});

configRouter.post('/exchange-rates', authMiddleware, requirePermission('settings:update'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const { rates, source } = body;

    if (!rates || typeof rates !== 'object') {
      return c.json({ success: false, error: 'Invalid rates format' }, 400);
    }

    await configService.setExchangeRates(rates, user.userId, user.email, source);

    return c.json({ success: true, data: { message: 'Exchange rates updated' } });
  } catch (error) {
    console.error('Update exchange rates error:', error);
    return c.json({ success: false, error: 'Failed to update exchange rates' }, 500);
  }
});

export default configRouter;
