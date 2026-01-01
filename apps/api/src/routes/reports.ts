import { Hono } from 'hono';
import { eq, and, sql, desc, gte, lte, asc } from 'drizzle-orm';
import { db, transactions, transactionItems, stores, users, products, categories, stock } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const reportsRouter = new Hono();

reportsRouter.use('*', authMiddleware);

reportsRouter.get('/system-overview', requireRole('admin'), async (c) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats] = await db.select({
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactions.total} AS NUMERIC)), 0)`,
      totalTransactions: sql<number>`COUNT(*)`,
    })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, today),
        eq(transactions.status, 'completed')
      ));

    const [activeStoresResult] = await db.select({
      count: sql<number>`COUNT(*)`,
    })
      .from(stores)
      .where(eq(stores.isActive, true));

    const [pendingSyncsResult] = await db.select({
      count: sql<number>`COUNT(*)`,
    })
      .from(transactions)
      .where(eq(transactions.syncStatus, 'pending'));

    const lowStockResult = await db.execute(
      sql`SELECT COUNT(DISTINCT product_id) as count FROM stock WHERE quantity <= 10`
    );

    const [activeUsersResult] = await db.select({
      count: sql<number>`COUNT(DISTINCT ${transactions.cashierId})`,
    })
      .from(transactions)
      .where(gte(transactions.createdAt, today));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [newUsersResult] = await db.select({
      count: sql<number>`COUNT(*)`,
    })
      .from(users)
      .where(gte(users.createdAt, weekAgo));

    return c.json({
      success: true,
      data: {
        today: {
          totalRevenue: Number(todayStats?.totalRevenue || 0),
          totalTransactions: Number(todayStats?.totalTransactions || 0),
        },
        activeStores: Number(activeStoresResult?.count || 0),
        pendingSyncs: Number(pendingSyncsResult?.count || 0),
        lowStockAlerts: Number(lowStockResult?.count || 0),
        activeUsersToday: Number(activeUsersResult?.count || 0),
        newUsersThisWeek: Number(newUsersResult?.count || 0),
      },
    });
  } catch (error) {
    console.error('System overview error:', error);
    return c.json({ success: false, error: 'Failed to fetch system overview' }, 500);
  }
});

reportsRouter.get('/stores-comparison', requireRole('admin'), async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const conditions: any[] = [eq(transactions.status, 'completed')];

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate)));
    }

    const storeStats = await db.select({
      storeId: stores.id,
      storeName: stores.name,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactions.total} AS NUMERIC)), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    })
      .from(transactions)
      .innerJoin(stores, eq(stores.id, transactions.storeId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(stores.id, stores.name)
      .orderBy(desc(sql`SUM(CAST(${transactions.total} AS NUMERIC))`));

    return c.json({
      success: true,
      data: storeStats,
    });
  } catch (error) {
    console.error('Stores comparison error:', error);
    return c.json({ success: false, error: 'Failed to fetch store comparison' }, 500);
  }
});

reportsRouter.get('/sales-by-store', requireRole('admin'), async (c) => {
  try {
    const storeId = c.req.query('storeId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const conditions: any[] = [eq(transactions.status, 'completed')];

    if (storeId) {
      conditions.push(eq(transactions.storeId, storeId));
    }

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate)));
    }

    const salesData = await db.select({
      date: sql<string>`DATE(${transactions.createdAt})`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactions.total} AS NUMERIC)), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    })
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`DATE(${transactions.createdAt})`)
      .orderBy(sql`DATE(${transactions.createdAt})`);

    return c.json({
      success: true,
      data: salesData,
    });
  } catch (error) {
    console.error('Sales by store error:', error);
    return c.json({ success: false, error: 'Failed to fetch sales data' }, 500);
  }
});

reportsRouter.get('/top-stores', requireRole('admin'), async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const metric = c.req.query('metric') || 'revenue';

    const conditions: any[] = [eq(transactions.status, 'completed')];

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate)));
    }

    const orderBy = metric === 'revenue'
      ? desc(sql`SUM(CAST(${transactions.total} AS NUMERIC))`)
      : desc(sql`COUNT(*)`);

    const topStores = await db.select({
      storeId: stores.id,
      storeName: stores.name,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactions.total} AS NUMERIC)), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    })
      .from(transactions)
      .innerJoin(stores, eq(stores.id, transactions.storeId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(stores.id, stores.name)
      .orderBy(orderBy)
      .limit(10);

    return c.json({
      success: true,
      data: topStores,
    });
  } catch (error) {
    console.error('Top stores error:', error);
    return c.json({ success: false, error: 'Failed to fetch top stores' }, 500);
  }
});

reportsRouter.get('/user-activity', requireRole('admin'), async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const storeId = c.req.query('storeId');
    const role = c.req.query('role');

    const conditions: any[] = [];

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate)));
    }

    if (storeId) {
      conditions.push(eq(transactions.storeId, storeId));
    }

    const userStats = await db.select({
      userId: users.id,
      userEmail: users.email,
      userName: users.name,
      userRole: users.role,
      transactionCount: sql<number>`COUNT(*)`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactions.total} AS NUMERIC)), 0)`,
    })
      .from(transactions)
      .innerJoin(users, eq(users.id, transactions.cashierId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(users.id, users.email, users.name, users.role)
      .orderBy(desc(sql`COUNT(*)`));

    const filteredStats = role
      ? userStats.filter(u => u.userRole === role)
      : userStats;

    return c.json({
      success: true,
      data: filteredStats,
    });
  } catch (error) {
    console.error('User activity error:', error);
    return c.json({ success: false, error: 'Failed to fetch user activity' }, 500);
  }
});

reportsRouter.get('/product-performance', requireRole('admin'), async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const storeId = c.req.query('storeId');
    const categoryId = c.req.query('categoryId');

    const conditions: any[] = [
      eq(transactionItems.id, transactionItems.id),
      eq(products.id, transactionItems.productId),
    ];

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate)));
    }

    if (storeId) {
      conditions.push(eq(products.storeId, storeId));
    }

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    const productStats = await db.select({
      productId: products.id,
      productName: products.name,
      productSku: products.sku,
      categoryId: products.categoryId,
      totalQuantity: sql<number>`SUM(${transactionItems.quantity})`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactionItems.subtotal} AS NUMERIC)), 0)`,
    })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
      .innerJoin(products, eq(products.id, transactionItems.productId))
      .where(and(...conditions))
      .groupBy(products.id, products.name, products.sku, products.categoryId)
      .orderBy(desc(sql`SUM(${transactionItems.quantity})`));

    return c.json({
      success: true,
      data: productStats,
    });
  } catch (error) {
    console.error('Product performance error:', error);
    return c.json({ success: false, error: 'Failed to fetch product performance' }, 500);
  }
});

export default reportsRouter;
