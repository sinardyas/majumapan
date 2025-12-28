import { Hono } from 'hono';
import { eq, and, gt, sql } from 'drizzle-orm';
import {
  db,
  stores,
  categories,
  products,
  stock,
  discounts,
  productDiscounts,
  transactions,
  transactionItems,
  syncLog,
} from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { syncPushSchema, TAX_RATE } from '@pos/shared';

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

    // Get all active categories
    const allCategories = await db.query.categories.findMany({
      where: and(eq(categories.storeId, storeId), eq(categories.isActive, true)),
    });

    // Get all active products
    const allProducts = await db.query.products.findMany({
      where: and(eq(products.storeId, storeId), eq(products.isActive, true)),
    });

    // Get all stock
    const allStock = await db.query.stock.findMany({
      where: eq(stock.storeId, storeId),
    });

    // Get all active discounts (both product and cart level)
    const now = new Date();
    const allDiscounts = await db.query.discounts.findMany({
      where: and(
        eq(discounts.storeId, storeId),
        eq(discounts.isActive, true)
      ),
    });

    // Filter discounts by date validity
    const validDiscounts = allDiscounts.filter(d => {
      if (d.startDate && d.startDate > now) return false;
      if (d.endDate && d.endDate < now) return false;
      return true;
    });

    // Get product discount links
    const discountIds = validDiscounts.map(d => d.id);
    const productDiscountLinks = await db.query.productDiscounts.findMany();
    const relevantLinks = productDiscountLinks.filter(pd => discountIds.includes(pd.discountId));

    // Add product IDs to product-level discounts
    const discountsWithProducts = validDiscounts.map(d => ({
      ...d,
      productIds: relevantLinks
        .filter(pd => pd.discountId === d.id)
        .map(pd => pd.productId),
    }));

    const lastSyncTimestamp = new Date().toISOString();

    return c.json({
      success: true,
      data: {
        store,
        categories: allCategories,
        products: allProducts,
        stock: allStock,
        discounts: discountsWithProducts,
        lastSyncTimestamp,
      },
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
          paymentMethod: txn.paymentMethod,
          amountPaid: txn.amountPaid.toString(),
          changeAmount: txn.changeAmount.toString(),
          status: 'completed',
          syncStatus: 'synced',
          clientTimestamp: new Date(txn.clientTimestamp),
        }).returning();

        // Create transaction items
        for (const item of txn.items) {
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

        synced.push({
          clientId: txn.clientId,
          serverId: newTransaction.id,
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

// Get sync status
syncRouter.get('/status', requirePermission('sync:pull'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Get counts
    const [categoryCount] = await db.select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(and(eq(categories.storeId, storeId), eq(categories.isActive, true)));

    const [productCount] = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.isActive, true)));

    const [transactionCount] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.storeId, storeId));

    const [pendingCount] = await db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.syncStatus, 'pending')
      ));

    // Get last sync log entry
    const lastSync = await db.query.syncLog.findFirst({
      where: eq(syncLog.storeId, storeId),
      orderBy: (syncLog, { desc }) => [desc(syncLog.timestamp)],
    });

    return c.json({
      success: true,
      data: {
        storeId,
        counts: {
          categories: Number(categoryCount.count),
          products: Number(productCount.count),
          transactions: Number(transactionCount.count),
          pendingSync: Number(pendingCount.count),
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
