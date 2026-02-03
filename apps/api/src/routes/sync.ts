import { Hono } from 'hono';
import { eq, and, gt, sql, desc } from 'drizzle-orm';
import {
  db,
  stores,
  categories,
  products,
  stock,
  discounts,
  transactions,
  transactionItems,
  transactionPayments,
  syncLog,
} from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { syncPushSchema } from '@pos/shared';
import { voucherService } from '../services/voucher-service';

const syncRouter = new Hono();

// All routes require authentication
syncRouter.use('*', authMiddleware);

// Generate transaction number
function generateTransactionNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN-${dateStr}-${sequence}`;
}

// Full sync - Initial data download
syncRouter.get('/full', requirePermission('sync:full'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;
    const entities = c.req.query('entities')?.split(',') || [];

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Get store info
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });

    if (!store) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }

    const result: Record<string, unknown> = { store };
    const lastSyncTimestamp = new Date().toISOString();

    // Only fetch requested entities
    if (entities.length === 0 || entities.includes('categories')) {
      result.categories = await db.query.categories.findMany({
        where: and(eq(categories.storeId, storeId), eq(categories.isActive, true)),
      });
    }

    if (entities.length === 0 || entities.includes('products')) {
      result.products = await db.query.products.findMany({
        where: and(eq(products.storeId, storeId), eq(products.isActive, true)),
      });

      result.stock = await db.query.stock.findMany({
        where: eq(stock.storeId, storeId),
      });
    }

    // Products and stock will be binded and synced together
    // if (entities.length === 0 || entities.includes('stock')) {
    //   result.stock = await db.query.stock.findMany({
    //     where: eq(stock.storeId, storeId),
    //   });
    // }

    if (entities.length === 0 || entities.includes('discounts')) {
      const now = new Date();
      const allDiscounts = await db.query.discounts.findMany({
        where: and(
          eq(discounts.storeId, storeId),
          eq(discounts.isActive, true)
        ),
      });

      const validDiscounts = allDiscounts.filter(d => {
        if (d.startDate && d.startDate > now) return false;
        if (d.endDate && d.endDate < now) return false;
        return true;
      });

      result.discounts = validDiscounts;
    }

    result.lastSyncTimestamp = lastSyncTimestamp;

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Full sync error:', error);
    return c.json({ success: false, error: 'Failed to perform full sync' }, 500);
  }
});

// Pull sync - Get changes since last sync
syncRouter.get('/pull', requirePermission('sync:pull'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;
    const since = c.req.query('since');

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    if (!since) {
      return c.json({ success: false, error: 'Last sync timestamp is required' }, 400);
    }

    const sinceDate = new Date(since);

    // Get sync log entries since last sync
    const syncEntries = await db.query.syncLog.findMany({
      where: and(
        eq(syncLog.storeId, storeId),
        gt(syncLog.timestamp, sinceDate)
      ),
      orderBy: (syncLog, { asc }) => [asc(syncLog.timestamp)],
    });

    // Group by entity type and action
    const changes = {
      categories: { created: [] as typeof allCategories, updated: [] as typeof allCategories, deleted: [] as string[] },
      products: { created: [] as typeof allProducts, updated: [] as typeof allProducts, deleted: [] as string[] },
      stock: { updated: [] as typeof allStock },
      discounts: { created: [] as typeof allDiscounts, updated: [] as typeof allDiscounts, deleted: [] as string[] },
    };

    // Process sync entries
    const processedIds = new Set<string>();

    for (const entry of syncEntries) {
      const key = `${entry.entityType}-${entry.entityId}`;
      if (processedIds.has(key)) continue;
      processedIds.add(key);

      switch (entry.entityType) {
        case 'category':
          if (entry.action === 'delete') {
            changes.categories.deleted.push(entry.entityId);
          } else {
            const category = await db.query.categories.findFirst({
              where: eq(categories.id, entry.entityId),
            });
            if (category) {
              if (entry.action === 'create') {
                changes.categories.created.push(category);
              } else {
                changes.categories.updated.push(category);
              }
            }
          }
          break;

        case 'product':
          if (entry.action === 'delete') {
            changes.products.deleted.push(entry.entityId);
          } else {
            const product = await db.query.products.findFirst({
              where: eq(products.id, entry.entityId),
            });
            if (product) {
              if (entry.action === 'create') {
                changes.products.created.push(product);
              } else {
                changes.products.updated.push(product);
              }
            }
          }
          break;

        case 'stock':
          const stockItem = await db.query.stock.findFirst({
            where: eq(stock.id, entry.entityId),
          });
          if (stockItem) {
            changes.stock.updated.push(stockItem);
          }
          break;

        case 'discount':
          if (entry.action === 'delete') {
            changes.discounts.deleted.push(entry.entityId);
          } else {
            const discount = await db.query.discounts.findFirst({
              where: eq(discounts.id, entry.entityId),
            });
            if (discount) {
              if (entry.action === 'create') {
                changes.discounts.created.push(discount);
              } else {
                changes.discounts.updated.push(discount);
              }
            }
          }
          break;
      }
    }

    const lastSyncTimestamp = new Date().toISOString();

    return c.json({
      success: true,
      data: {
        changes,
        lastSyncTimestamp,
      },
    });
  } catch (error) {
    console.error('Pull sync error:', error);
    return c.json({ success: false, error: 'Failed to pull changes' }, 500);
  }
});

// Push sync - Upload offline transactions
syncRouter.post('/push', requirePermission('sync:push'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = syncPushSchema.safeParse(body);

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

    const { transactions: offlineTransactions } = result.data;

    // Sort by client timestamp (oldest first)
    offlineTransactions.sort((a, b) =>
      new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime()
    );

    const synced: Array<{ clientId: string; serverId: string; transactionNumber: string }> = [];
    const rejected: Array<{
      clientId: string;
      reason: string;
      stockIssues?: Array<{
        productId: string;
        productName: string;
        requested: number;
        available: number;
      }>;
    }> = [];
    const stockUpdates: Array<{ productId: string; newQuantity: number }> = [];

    for (const txn of offlineTransactions) {
      try {
        // Check if transaction already exists (idempotency)
        const existing = await db.query.transactions.findFirst({
          where: eq(transactions.clientId, txn.clientId),
        });

        if (existing) {
          synced.push({
            clientId: txn.clientId,
            serverId: existing.id,
            transactionNumber: existing.transactionNumber,
          });
          continue;
        }

        // Validate stock availability
        const stockIssues: Array<{
          productId: string;
          productName: string;
          requested: number;
          available: number;
        }> = [];

        const stockRecords: Array<{ stockId: string; productId: string; currentQty: number; requestedQty: number }> = [];

        for (const item of txn.items) {
          const stockRecord = await db.query.stock.findFirst({
            where: and(eq(stock.productId, item.productId), eq(stock.storeId, storeId)),
          });

          const availableQty = stockRecord?.quantity ?? 0;

          if (availableQty < item.quantity) {
            stockIssues.push({
              productId: item.productId,
              productName: item.productName,
              requested: item.quantity,
              available: availableQty,
            });
          } else if (stockRecord) {
            stockRecords.push({
              stockId: stockRecord.id,
              productId: item.productId,
              currentQty: stockRecord.quantity,
              requestedQty: item.quantity,
            });
          }
        }

        // If stock issues, reject the transaction
        if (stockIssues.length > 0) {
          rejected.push({
            clientId: txn.clientId,
            reason: 'Insufficient stock',
            stockIssues,
          });
          continue;
        }

        // Create the transaction
        const transactionNumber = generateTransactionNumber();
        let serverTransactionId: string;

        // Check if this is a split payment
        const isSplitPayment = txn.isSplitPayment === true || (txn.payments && txn.payments.length > 0);

        if (isSplitPayment && txn.payments) {
          // Handle split payment
          const totalPaid = txn.payments.reduce((sum, p) => sum + p.amount, 0);
          const totalChange = txn.payments.reduce((sum, p) => sum + (p.changeAmount || 0), 0);

          const [newTransaction] = await db.insert(transactions).values({
            clientId: txn.clientId,
            storeId,
            cashierId: user.userId,
            transactionNumber,
            subtotal: txn.subtotal.toString(),
            taxAmount: txn.taxAmount.toString(),
            discountAmount: txn.discountAmount.toString(),
            discountId: txn.discountId || null,
            discountCode: txn.discountCode || null,
            discountName: txn.discountName || null,
            total: txn.total.toString(),
            isSplitPayment: true,
            paymentMethod: 'cash', // Primary for compatibility
            amountPaid: totalPaid.toString(),
            changeAmount: totalChange.toString(),
            status: 'completed',
            syncStatus: 'synced',
            clientTimestamp: new Date(txn.clientTimestamp),
          }).returning();
          
          serverTransactionId = newTransaction.id;

          // Create transaction payments
          for (const payment of txn.payments) {
            await db.insert(transactionPayments).values({
              transactionId: newTransaction.id,
              paymentMethod: payment.paymentMethod,
              amount: payment.amount.toString(),
              changeAmount: (payment.changeAmount || 0).toString(),
            });
          }
        } else {
          // Handle single payment (original logic)
          const [newTransaction] = await db.insert(transactions).values({
            clientId: txn.clientId,
            storeId,
            cashierId: user.userId,
            transactionNumber,
            subtotal: txn.subtotal.toString(),
            taxAmount: txn.taxAmount.toString(),
            discountAmount: txn.discountAmount.toString(),
            discountId: txn.discountId || null,
            discountCode: txn.discountCode || null,
            discountName: txn.discountName || null,
            total: txn.total.toString(),
            isSplitPayment: false,
            paymentMethod: txn.paymentMethod || 'cash',
            amountPaid: (txn.amountPaid || txn.total).toString(),
            changeAmount: (txn.changeAmount || 0).toString(),
            status: 'completed',
            syncStatus: 'synced',
            clientTimestamp: new Date(txn.clientTimestamp),
          }).returning();
          
          serverTransactionId = newTransaction.id;

          // Create single transaction payment record
          await db.insert(transactionPayments).values({
            transactionId: newTransaction.id,
            paymentMethod: txn.paymentMethod || 'cash',
            amount: (txn.amountPaid || txn.total).toString(),
            changeAmount: (txn.changeAmount || 0).toString(),
          });
        }

        // Create transaction items
        for (const item of txn.items) {
          // Find the transaction we just created
          const createdTxn = await db.query.transactions.findFirst({
            where: eq(transactions.clientId, txn.clientId),
          });
          
          if (createdTxn) {
            await db.insert(transactionItems).values({
              transactionId: createdTxn.id,
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
        }

        // Update stock levels
        for (const record of stockRecords) {
          const newQuantity = record.currentQty - record.requestedQty;
          await db.update(stock)
            .set({
              quantity: newQuantity,
              updatedAt: new Date(),
            })
            .where(eq(stock.id, record.stockId));

          stockUpdates.push({
            productId: record.productId,
            newQuantity,
          });
        }

        // Increment discount usage if coupon was used
        if (txn.discountId) {
          await db.update(discounts)
            .set({
              usageCount: sql`${discounts.usageCount} + 1`,
            })
            .where(eq(discounts.id, txn.discountId));
        }

        // Process vouchers
        if (txn.vouchers && txn.vouchers.length > 0) {
          const cartItems = txn.items.map(item => ({
            id: item.productId,
            productId: item.productId,
            price: item.unitPrice,
            quantity: item.quantity,
          }));

          for (const voucher of txn.vouchers) {
            try {
              await voucherService.useVoucher(
                voucher.code,
                serverTransactionId,
                cartItems,
                voucher.amountApplied
              );
            } catch (voucherError) {
              console.error(`Error marking voucher ${voucher.code} as used:`, voucherError);
            }
          }
        }

        synced.push({
          clientId: txn.clientId,
          serverId: (await db.query.transactions.findFirst({ where: eq(transactions.clientId, txn.clientId) }))!.id,
          transactionNumber,
        });
      } catch (err) {
        console.error(`Error processing transaction ${txn.clientId}:`, err);
        rejected.push({
          clientId: txn.clientId,
          reason: 'Internal processing error',
        });
      }
    }

    return c.json({
      success: true,
      data: {
        synced,
        rejected,
        stockUpdates,
      },
    });
  } catch (error) {
    console.error('Push sync error:', error);
    return c.json({ success: false, error: 'Failed to push transactions' }, 500);
  }
});

// Get sync status with entity counts
syncRouter.get('/status', requirePermission('sync:status'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const [syncedCategoryCount] = await db.select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(and(eq(categories.storeId, storeId), eq(categories.isActive, true)));

    const [pendingCategoryCount] = await db.select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(and(eq(categories.storeId, storeId), eq(categories.isActive, false)));

    const [syncedProductCount] = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.isActive, true)));

    const [pendingProductCount] = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.isActive, false)));

    const [syncedStockCount] = await db.select({ count: sql<number>`count(*)` })
      .from(stock)
      .where(and(eq(stock.storeId, storeId)));

    const [pendingStockCount] = await db.select({ count: sql<number>`count(*)` })
      .from(stock)
      .where(and(eq(stock.storeId, storeId)));

    const [syncedTransactionCount] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.storeId, storeId));

    const [pendingTransactionCount] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'pending')
      ));

    const [rejectedTransactionCount] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'rejected')
      ));

    const lastSync = await db.query.syncLog.findFirst({
      where: eq(syncLog.storeId, storeId),
      orderBy: (syncLog, { desc }) => [desc(syncLog.timestamp)],
    });

    return c.json({
      success: true,
      data: {
        storeId,
        entities: {
          categories: {
            synced: Number(syncedCategoryCount.count),
            pending: Number(pendingCategoryCount.count),
          },
          products: {
            synced: Number(syncedProductCount.count),
            pending: Number(pendingProductCount.count),
          },
	  stock: {
            synced: Number(syncedStockCount.count),
            pending: Number(pendingStockCount.count),
          },
          transactions: {
            synced: Number(syncedTransactionCount.count),
            pending: Number(pendingTransactionCount.count),
            rejected: Number(rejectedTransactionCount.count),
          },
        },
        lastSyncTimestamp: lastSync?.timestamp?.toISOString() || null,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    return c.json({ success: false, error: 'Failed to get sync status' }, 500);
  }
});

// Get pending transactions list
syncRouter.get('/pending', requirePermission('sync:status'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const limit = Number(c.req.query('limit')) || 20;
    const offset = Number(c.req.query('offset')) || 0;

    const pendingTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'pending')
      ),
      orderBy: (transactions, { desc }) => [desc(transactions.clientTimestamp)],
      limit,
      offset,
    });

    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'pending')
      ));

    return c.json({
      success: true,
      data: {
        items: pendingTransactions,
        total: Number(totalResult.count),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get pending transactions error:', error);
    return c.json({ success: false, error: 'Failed to get pending transactions' }, 500);
  }
});

// Get rejected transactions list
syncRouter.get('/rejected', requirePermission('sync:status'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const limit = Number(c.req.query('limit')) || 20;
    const offset = Number(c.req.query('offset')) || 0;

    const rejectedTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'rejected')
      ),
      orderBy: (transactions, { desc }) => [desc(transactions.clientTimestamp)],
      limit,
      offset,
    });

    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'rejected')
      ));

    return c.json({
      success: true,
      data: {
        items: rejectedTransactions,
        total: Number(totalResult.count),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get rejected transactions error:', error);
    return c.json({ success: false, error: 'Failed to get rejected transactions' }, 500);
  }
});

// Clear all pending transactions
syncRouter.delete('/pending', requirePermission('sync:status'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    await db.delete(transactions)
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'pending')
      ));

    return c.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Clear pending transactions error:', error);
    return c.json({ success: false, error: 'Failed to clear pending transactions' }, 500);
  }
});

// Clear single pending transaction
syncRouter.delete('/pending/:clientId', requirePermission('sync:status'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;
    const clientId = c.req.param('clientId');

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.clientId, clientId),
        eq(transactions.storeId, storeId)
      ),
    });

    if (existing) {
      await db.delete(transactions)
        .where(and(
          eq(transactions.clientId, clientId),
          eq(transactions.storeId, storeId)
        ));
    }

    return c.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Clear pending transaction error:', error);
    return c.json({ success: false, error: 'Failed to clear pending transaction' }, 500);
  }
});

export default syncRouter;

// Type definitions for the arrays used above
type CategoryType = Awaited<ReturnType<typeof db.query.categories.findMany>>;
type ProductType = Awaited<ReturnType<typeof db.query.products.findMany>>;
type StockType = Awaited<ReturnType<typeof db.query.stock.findMany>>;
type DiscountType = Awaited<ReturnType<typeof db.query.discounts.findMany>>;

const allCategories: CategoryType = [];
const allProducts: ProductType = [];
const allStock: StockType = [];
const allDiscounts: DiscountType = [];
