import { Hono } from 'hono';
import { eq, and, sql, desc, between } from 'drizzle-orm';
import { db, transactions, transactionItems, stock, discounts, products, stores, users } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createTransactionSchema, paginationSchema, dateRangeSchema, TAX_RATE } from '@pos/shared';
import { v4 as uuidv4 } from 'uuid';

const transactionsRouter = new Hono();

// All routes require authentication
transactionsRouter.use('*', authMiddleware);

// Generate transaction number
function generateTransactionNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN-${dateStr}-${sequence}`;
}

// List transactions
transactionsRouter.get('/', requirePermission('transactions:read'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId') || user.storeId;
    const cashierId = c.req.query('cashierId');
    const status = c.req.query('status');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Parse pagination
    const paginationResult = paginationSchema.safeParse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
    });

    const { page, limit } = paginationResult.success
      ? paginationResult.data
      : { page: 1, limit: 20 };

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Non-admins can only access their store's transactions
    if (user.role !== 'admin' && storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Cashiers can only see their own transactions
    const effectiveCashierId = user.role === 'cashier' ? user.userId : cashierId;

    // Build conditions
    const conditions = [eq(transactions.storeId, storeId)];

    if (effectiveCashierId) {
      conditions.push(eq(transactions.cashierId, effectiveCashierId));
    }

    if (status) {
      conditions.push(eq(transactions.status, status as 'completed' | 'voided' | 'pending_sync'));
    }

    if (startDate) {
      conditions.push(sql`${transactions.createdAt} >= ${new Date(startDate)}`);
    }

    if (endDate) {
      conditions.push(sql`${transactions.createdAt} <= ${new Date(endDate)}`);
    }

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(...conditions));

    const total = Number(countResult[0].count);

    // Get transactions with pagination
    const offset = (page - 1) * limit;

    const allTransactions = await db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.createdAt)],
      limit,
      offset,
    });

    return c.json({
      success: true,
      data: allTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List transactions error:', error);
    return c.json({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
});

// Get transaction by ID
transactionsRouter.get('/:id', requirePermission('transactions:read'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });

    if (!transaction) {
      return c.json({ success: false, error: 'Transaction not found' }, 404);
    }

    // Non-admins can only access their store's transactions
    if (user.role !== 'admin' && transaction.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Cashiers can only see their own transactions
    if (user.role === 'cashier' && transaction.cashierId !== user.userId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get transaction items
    const items = await db.query.transactionItems.findMany({
      where: eq(transactionItems.transactionId, id),
    });

    return c.json({
      success: true,
      data: {
        ...transaction,
        items,
      },
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    return c.json({ success: false, error: 'Failed to fetch transaction' }, 500);
  }
});

// Create transaction
transactionsRouter.post('/', requirePermission('transactions:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = createTransactionSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const storeId = user.storeId;
    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const { items, paymentMethod, amountPaid, discountId, discountCode, discountName, discountAmount } = result.data;

    // Validate stock availability and collect stock updates
    const stockUpdates: Array<{ stockId: string; newQuantity: number }> = [];

    for (const item of items) {
      const stockRecord = await db.query.stock.findFirst({
        where: and(eq(stock.productId, item.productId), eq(stock.storeId, storeId)),
      });

      if (!stockRecord) {
        return c.json({
          success: false,
          error: `Stock record not found for product: ${item.productName}`,
        }, 400);
      }

      if (stockRecord.quantity < item.quantity) {
        return c.json({
          success: false,
          error: `Insufficient stock for ${item.productName}. Available: ${stockRecord.quantity}, Requested: ${item.quantity}`,
        }, 400);
      }

      stockUpdates.push({
        stockId: stockRecord.id,
        newQuantity: stockRecord.quantity - item.quantity,
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = (subtotal - discountAmount) * TAX_RATE;
    const total = subtotal - discountAmount + taxAmount;
    const changeAmount = amountPaid - total;

    if (changeAmount < 0) {
      return c.json({ success: false, error: 'Insufficient payment amount' }, 400);
    }

    // Generate client ID and transaction number
    const clientId = uuidv4();
    const transactionNumber = generateTransactionNumber();

    // Create transaction
    const [newTransaction] = await db.insert(transactions).values({
      clientId,
      storeId,
      cashierId: user.userId,
      transactionNumber,
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: discountAmount.toString(),
      discountId: discountId || null,
      discountCode: discountCode || null,
      discountName: discountName || null,
      total: total.toString(),
      paymentMethod,
      amountPaid: amountPaid.toString(),
      changeAmount: changeAmount.toString(),
      status: 'completed',
      syncStatus: 'synced',
      clientTimestamp: new Date(),
    }).returning();

    // Create transaction items
    for (const item of items) {
      await db.insert(transactionItems).values({
        transactionId: newTransaction.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        discountId: item.discountId || null,
        discountName: item.discountName || null,
        discountValue: (item.discountValue || 0).toString(),
        subtotal: item.subtotal.toString(),
      });
    }

    // Update stock levels
    for (const update of stockUpdates) {
      await db.update(stock)
        .set({
          quantity: update.newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, update.stockId));
    }

    // Increment discount usage if coupon was used
    if (discountId) {
      await db.update(discounts)
        .set({
          usageCount: sql`${discounts.usageCount} + 1`,
        })
        .where(eq(discounts.id, discountId));
    }

    return c.json({
      success: true,
      data: {
        ...newTransaction,
        items,
      },
    }, 201);
  } catch (error) {
    console.error('Create transaction error:', error);
    return c.json({ success: false, error: 'Failed to create transaction' }, 500);
  }
});

// Void transaction
transactionsRouter.post('/:id/void', requirePermission('transactions:void'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const { reason } = body;

    // Check if transaction exists
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });

    if (!transaction) {
      return c.json({ success: false, error: 'Transaction not found' }, 404);
    }

    // Non-admins can only void their store's transactions
    if (user.role !== 'admin' && transaction.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Cannot void already voided transactions
    if (transaction.status === 'voided') {
      return c.json({ success: false, error: 'Transaction is already voided' }, 400);
    }

    // Get transaction items to restore stock
    const items = await db.query.transactionItems.findMany({
      where: eq(transactionItems.transactionId, id),
    });

    // Restore stock levels
    for (const item of items) {
      const stockRecord = await db.query.stock.findFirst({
        where: and(eq(stock.productId, item.productId), eq(stock.storeId, transaction.storeId)),
      });

      if (stockRecord) {
        await db.update(stock)
          .set({
            quantity: stockRecord.quantity + item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(stock.id, stockRecord.id));
      }
    }

    // Decrement discount usage if coupon was used
    if (transaction.discountId) {
      await db.update(discounts)
        .set({
          usageCount: sql`GREATEST(${discounts.usageCount} - 1, 0)`,
        })
        .where(eq(discounts.id, transaction.discountId));
    }

    // Update transaction status
    const [voidedTransaction] = await db.update(transactions)
      .set({
        status: 'voided',
        rejectionReason: reason || 'Voided by manager',
        rejectedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    return c.json({
      success: true,
      data: voidedTransaction,
      message: 'Transaction voided successfully',
    });
  } catch (error) {
    console.error('Void transaction error:', error);
    return c.json({ success: false, error: 'Failed to void transaction' }, 500);
  }
});

// Get receipt data
transactionsRouter.get('/:id/receipt', requirePermission('transactions:read'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    // Get transaction
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });

    if (!transaction) {
      return c.json({ success: false, error: 'Transaction not found' }, 404);
    }

    // Non-admins can only access their store's transactions
    if (user.role !== 'admin' && transaction.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get store info
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, transaction.storeId),
    });

    // Get cashier info
    const cashier = await db.query.users.findFirst({
      where: eq(users.id, transaction.cashierId),
    });

    // Get transaction items
    const items = await db.query.transactionItems.findMany({
      where: eq(transactionItems.transactionId, id),
    });

    // Format receipt data
    const receiptData = {
      store: store ? {
        name: store.name,
        address: store.address,
        phone: store.phone,
      } : null,
      transaction: {
        number: transaction.transactionNumber,
        date: transaction.createdAt.toISOString().split('T')[0],
        time: transaction.createdAt.toTimeString().split(' ')[0],
        cashierName: cashier?.name || 'Unknown',
      },
      items: items.map(item => ({
        quantity: item.quantity,
        name: item.productName,
        unitPrice: parseFloat(item.unitPrice),
        subtotal: parseFloat(item.subtotal),
        discount: item.discountValue ? {
          name: item.discountName,
          amount: parseFloat(item.discountValue),
        } : null,
      })),
      summary: {
        subtotal: parseFloat(transaction.subtotal),
        cartDiscount: transaction.discountCode ? {
          code: transaction.discountCode,
          amount: parseFloat(transaction.discountAmount),
        } : null,
        taxRate: TAX_RATE * 100,
        taxAmount: parseFloat(transaction.taxAmount),
        total: parseFloat(transaction.total),
      },
      payment: {
        method: transaction.paymentMethod,
        amountTendered: parseFloat(transaction.amountPaid),
        change: parseFloat(transaction.changeAmount),
      },
    };

    return c.json({
      success: true,
      data: receiptData,
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    return c.json({ success: false, error: 'Failed to fetch receipt' }, 500);
  }
});

export default transactionsRouter;
