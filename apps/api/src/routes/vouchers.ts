import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { voucherService } from '../services/voucher-service';

const vouchersRouter = new Hono();

vouchersRouter.use('*', authMiddleware);

vouchersRouter.get('/', requirePermission('vouchers:read'), async (c) => {
  try {
    const type = c.req.query('type') as 'GC' | 'PR' | undefined;
    const isActive = c.req.query('active');
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');

    const vouchers = await voucherService.getAllVouchers({
      type,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });

    return c.json({ success: true, data: vouchers });
  } catch (error) {
    console.error('Get all vouchers error:', error);
    return c.json({ success: false, error: 'Failed to fetch vouchers' }, 500);
  }
});

vouchersRouter.get('/code/:code', async (c) => {
  try {
    const { code } = c.req.param();
    const voucher = await voucherService.getByCode(code);

    if (!voucher) {
      return c.json({ success: false, error: 'Voucher not found' }, 404);
    }

    return c.json({ success: true, data: voucher });
  } catch (error) {
    console.error('Get voucher error:', error);
    return c.json({ success: false, error: 'Failed to fetch voucher' }, 500);
  }
});

vouchersRouter.get('/code/:code/balance', async (c) => {
  try {
    const { code } = c.req.param();
    const balance = await voucherService.getBalance(code);

    if (!balance) {
      return c.json({ success: false, error: 'Voucher not found' }, 404);
    }

    return c.json({ success: true, data: balance });
  } catch (error) {
    console.error('Get balance error:', error);
    return c.json({ success: false, error: 'Failed to fetch balance' }, 500);
  }
});

vouchersRouter.get('/customer/:customerId', async (c) => {
  try {
    const { customerId } = c.req.param();
    const vouchers = await voucherService.getCustomerVouchers(customerId);
    return c.json({ success: true, data: vouchers });
  } catch (error) {
    console.error('Get customer vouchers error:', error);
    return c.json({ success: false, error: 'Failed to fetch vouchers' }, 500);
  }
});

vouchersRouter.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { code, cartItems, subtotal } = body;

    if (!code) {
      return c.json({ success: false, error: 'Voucher code is required' }, 400);
    }

    const result = await voucherService.validateVoucher(code, cartItems, subtotal);
    return c.json({ success: result.valid, ...result });
  } catch (error) {
    console.error('Validate voucher error:', error);
    return c.json({ success: false, error: 'Failed to validate voucher' }, 500);
  }
});

vouchersRouter.post('/gift-card', requirePermission('vouchers:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { initialValue, currency, expiresAt, customerId, notes } = body;

    if (!initialValue || initialValue <= 0) {
      return c.json({ success: false, error: 'Invalid initial value' }, 400);
    }

    const voucher = await voucherService.createGiftCard({
      initialValue: Number(initialValue),
      currency,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      customerId,
      createdBy: user.userId,
      notes,
    });

    return c.json({ success: true, data: voucher });
  } catch (error) {
    console.error('Create gift card error:', error);
    return c.json({ success: false, error: 'Failed to create gift card' }, 500);
  }
});

vouchersRouter.post('/promo', requirePermission('vouchers:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const {
      discountType,
      percentageValue,
      fixedValue,
      scope,
      freeItemId,
      freeItemMode,
      minPurchase,
      maxDiscount,
      expiresAt,
      applicableCategories,
      applicableProducts,
      qualifierCategories,
      qualifierProducts,
      notes,
    } = body;

    if (!discountType) {
      return c.json({ success: false, error: 'Discount type is required' }, 400);
    }

    if (!expiresAt) {
      return c.json({ success: false, error: 'Expiration date is required' }, 400);
    }

    if (discountType === 'PERCENTAGE' && !percentageValue) {
      return c.json({ success: false, error: 'Percentage value is required' }, 400);
    }

    if (discountType === 'FIXED' && !fixedValue) {
      return c.json({ success: false, error: 'Fixed value is required' }, 400);
    }

    if (discountType === 'FREE_ITEM' && !freeItemId) {
      return c.json({ success: false, error: 'Free item is required' }, 400);
    }

    const voucher = await voucherService.createPromotional({
      discountType,
      percentageValue: percentageValue ? Number(percentageValue) : undefined,
      fixedValue: fixedValue ? Number(fixedValue) : undefined,
      scope,
      freeItemId,
      freeItemMode,
      minPurchase: minPurchase ? Number(minPurchase) : undefined,
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      expiresAt: new Date(expiresAt),
      applicableCategories,
      applicableProducts,
      qualifierCategories,
      qualifierProducts,
      createdBy: user.userId,
      notes,
    });

    return c.json({ success: true, data: voucher });
  } catch (error) {
    console.error('Create promo error:', error);
    return c.json({ success: false, error: 'Failed to create promotional voucher' }, 500);
  }
});

vouchersRouter.post('/code/:code/use', requirePermission('vouchers:use'), async (c) => {
  try {
    const user = c.get('user');
    const { code } = c.req.param();
    const body = await c.req.json();
    const { orderId, cartItems, amountApplied } = body;

    if (!orderId) {
      return c.json({ success: false, error: 'Order ID is required' }, 400);
    }

    const result = await voucherService.useVoucher(code, orderId, cartItems, amountApplied);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Use voucher error:', error);
    return c.json({ success: false, error: 'Failed to use voucher' }, 500);
  }
});

vouchersRouter.post('/code/:code/void', requirePermission('vouchers:void'), async (c) => {
  try {
    const user = c.get('user');
    const { code } = c.req.param();
    const body = await c.req.json();
    const { reason } = body;

    const result = await voucherService.voidVoucher(code, user.userId, reason);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Void voucher error:', error);
    return c.json({ success: false, error: 'Failed to void voucher' }, 500);
  }
});

vouchersRouter.post('/refund', requirePermission('vouchers:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { orderId, refundAmount, customerId } = body;

    if (!orderId || !refundAmount) {
      return c.json({ success: false, error: 'Order ID and refund amount are required' }, 400);
    }

    const voucher = await voucherService.createFromRefund(
      orderId,
      Number(refundAmount),
      customerId,
      user.userId
    );

    return c.json({ success: true, data: voucher });
  } catch (error) {
    console.error('Create refund gift card error:', error);
    return c.json({ success: false, error: 'Failed to create gift card from refund' }, 500);
  }
});

vouchersRouter.get('/:id/transactions', async (c) => {
  try {
    const { id } = c.req.param();
    const transactions = await voucherService.getVoucherTransactions(id);
    return c.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Get voucher transactions error:', error);
    return c.json({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
});

export default vouchersRouter;
