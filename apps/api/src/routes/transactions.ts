import { Hono } from 'hono';
import { eq, and, sql, desc, between } from 'drizzle-orm';
import { db, transactions, transactionItems, transactionPayments, stock, discounts, products, stores, users, orderVouchers, vouchers as vouchersTable } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createTransactionSchema, createSplitTransactionSchema, paginationSchema, dateRangeSchema, TAX_RATE } from '@pos/shared';
import { v4 as uuidv4 } from 'uuid';
import { voucherService } from '../services/voucher-service';

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

    // Get transaction payments (for split payments)
    const payments = await db.query.transactionPayments.findMany({
      where: eq(transactionPayments.transactionId, id),
    });

    return c.json({
      success: true,
      data: {
        ...transaction,
        items,
        payments,
      },
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    return c.json({ success: false, error: 'Failed to fetch transaction' }, 500);
  }
});

// Create transaction (single or split payment)
transactionsRouter.post('/', requirePermission('transactions:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    // Try parsing as single payment first, then split payment
    const singleResult = createTransactionSchema.safeParse(body);
    const splitResult = createSplitTransactionSchema.safeParse(body);
    
    let isSplitPayment = false;
    let data: Record<string, unknown>;
    
    if (singleResult.success) {
      data = singleResult.data;
    } else if (splitResult.success) {
      isSplitPayment = true;
      data = splitResult.data;
    } else {
      return c.json(
        { success: false, error: 'Validation failed', details: singleResult.error.flatten() },
        400
      );
    }

    const storeId = user.storeId;
    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const items = data.items as Array<{
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      discountId?: string;
      discountName?: string;
      discountValue?: number;
      subtotal: number;
    }>;
    
    const discountAmount = data.discountAmount as number || 0;
    const discountId = data.discountId as string | undefined;
    const discountCode = data.discountCode as string | undefined;
    const discountName = data.discountName as string | undefined;
    const total = data.total as number;
    
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

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = (subtotal - discountAmount) * TAX_RATE;

    // Generate client ID and transaction number
    const clientId = uuidv4();
    const transactionNumber = generateTransactionNumber();

    if (isSplitPayment) {
      // Handle split payment
      const payments = data.payments as Array<{
        paymentMethod: 'cash' | 'card';
        amount: number;
        changeAmount: number;
      }>;
      
      // Validate total payment amount matches transaction total
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid < total) {
        return c.json({ success: false, error: 'Insufficient payment amount' }, 400);
      }

      // Create split transaction
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
        isSplitPayment: true,
        paymentMethod: 'cash', // Primary payment method for backwards compatibility
        amountPaid: totalPaid.toString(),
        changeAmount: (totalPaid - total).toString(),
        status: 'completed',
        syncStatus: 'synced',
        clientTimestamp: new Date(),
      }).returning();

      // Create transaction payments
      for (const payment of payments) {
        await db.insert(transactionPayments).values({
          transactionId: newTransaction.id,
          paymentMethod: payment.paymentMethod,
          amount: payment.amount.toString(),
          changeAmount: payment.changeAmount.toString(),
        });
      }
    } else {
      // Handle single payment (original logic)
      const paymentMethod = data.paymentMethod as 'cash' | 'card';
      const amountPaid = data.amountPaid as number;
      const changeAmount = (amountPaid as number) - total;

      if (changeAmount < 0) {
        return c.json({ success: false, error: 'Insufficient payment amount' }, 400);
      }

      // Create single payment transaction
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
        isSplitPayment: false,
        paymentMethod,
        amountPaid: amountPaid.toString(),
        changeAmount: changeAmount.toString(),
        status: 'completed',
        syncStatus: 'synced',
        clientTimestamp: new Date(),
      }).returning();

      // Create single transaction payment record
      await db.insert(transactionPayments).values({
        transactionId: newTransaction.id,
        paymentMethod,
        amount: amountPaid.toString(),
        changeAmount: changeAmount.toString(),
      });
    }

    // Create transaction items
    for (const item of items) {
      await db.insert(transactionItems).values({
        transactionId: (await db.query.transactions.findFirst({ where: eq(transactions.clientId, clientId) }))!.id,
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

    // Handle vouchers
    const vouchers = data.vouchers as Array<{
      id: string;
      code: string;
      type: 'GC' | 'PR';
      amountApplied: number;
    }> | undefined;

    if (vouchers && vouchers.length > 0) {
      const cartItems = items.map(item => ({
        id: item.productId,
        productId: item.productId,
        price: item.unitPrice,
        quantity: item.quantity,
      }));

      for (const voucher of vouchers) {
        try {
          await voucherService.useVoucher(
            voucher.code,
            clientId,
            cartItems,
            voucher.amountApplied
          );
        } catch (voucherError) {
          console.error('Error marking voucher as used:', voucherError);
        }
      }
    }

    // Fetch created transaction with payments
    const createdTransaction = await db.query.transactions.findFirst({
      where: eq(transactions.clientId, clientId),
    });
    
    const payments = await db.query.transactionPayments.findMany({
      where: eq(transactionPayments.transactionId, createdTransaction!.id),
    });

    return c.json({
      success: true,
      data: {
        ...createdTransaction,
        items,
        payments,
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

    // Get payment breakdown for audit logging (for split payments)
    const payments = await db.query.transactionPayments.findMany({
      where: eq(transactionPayments.transactionId, id),
    });

    const voidNote = transaction.isSplitPayment
      ? `${reason || 'Voided by manager'} | Split Payment: ${payments.map(p => `${p.paymentMethod}: $${p.amount}`).join(', ')}`
      : (reason || 'Voided by manager');

    // Update transaction status
    const [voidedTransaction] = await db.update(transactions)
      .set({
        status: 'voided',
        rejectionReason: voidNote,
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

    // Get transaction payments (for split payments)
    const payments = await db.query.transactionPayments.findMany({
      where: eq(transactionPayments.transactionId, id),
    });

    // Get transaction vouchers
    const transactionVouchers = await db.select({
      id: orderVouchers.id,
      code: vouchersTable.code,
      type: orderVouchers.type,
      amountApplied: orderVouchers.amountApplied,
      discountDetails: orderVouchers.discountDetails,
    })
      .from(orderVouchers)
      .leftJoin(vouchersTable, eq(orderVouchers.voucherId, vouchersTable.id))
      .where(eq(orderVouchers.orderId, transaction.clientId));

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
      vouchers: transactionVouchers.map(v => ({
        code: v.code,
        type: v.type,
        amountApplied: parseFloat(v.amountApplied),
      })),
      totalVoucherDiscount: transactionVouchers.reduce((sum, v) => sum + parseFloat(v.amountApplied), 0),
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
      payment: transaction.isSplitPayment
        ? {
            isSplitPayment: true,
            payments: payments.map(p => ({
              method: p.paymentMethod,
              amount: parseFloat(p.amount),
              change: parseFloat(p.changeAmount),
            })),
            totalPaid: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
            totalChange: payments.reduce((sum, p) => sum + parseFloat(p.changeAmount), 0),
          }
        : {
            isSplitPayment: false,
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
