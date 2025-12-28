import { Hono } from 'hono';
import { eq, and, lt } from 'drizzle-orm';
import { db, stock, products, syncLog } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { updateStockSchema, adjustStockSchema } from '@pos/shared';

const stockRouter = new Hono();

// All routes require authentication
stockRouter.use('*', authMiddleware);

// List stock levels
stockRouter.get('/', requirePermission('stock:read'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId') || user.storeId;
    const lowStockOnly = c.req.query('lowStockOnly') === 'true';

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Non-admins can only access their store's stock
    if (user.role !== 'admin' && storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get stock with product info
    const stockItems = await db.query.stock.findMany({
      where: eq(stock.storeId, storeId),
      with: {
        // Note: We'll need to join manually since drizzle relations need to be set up
      },
    });

    // Get all products for the store to join with stock
    const storeProducts = await db.query.products.findMany({
      where: and(eq(products.storeId, storeId), eq(products.isActive, true)),
    });

    // Create a map of products
    const productMap = new Map(storeProducts.map(p => [p.id, p]));

    // Join stock with products
    let result = stockItems.map(s => ({
      ...s,
      product: productMap.get(s.productId) || null,
    }));

    // Filter low stock if requested
    if (lowStockOnly) {
      result = result.filter(s => s.quantity <= s.lowStockThreshold);
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('List stock error:', error);
    return c.json({ success: false, error: 'Failed to fetch stock' }, 500);
  }
});

// Get stock for a specific product
stockRouter.get('/:productId', requirePermission('stock:read'), async (c) => {
  try {
    const user = c.get('user');
    const { productId } = c.req.param();
    const storeId = c.req.query('storeId') || user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only access their store's stock
    if (user.role !== 'admin' && product.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const stockInfo = await db.query.stock.findFirst({
      where: and(eq(stock.productId, productId), eq(stock.storeId, storeId)),
    });

    return c.json({
      success: true,
      data: stockInfo || { productId, storeId, quantity: 0, lowStockThreshold: 10 },
    });
  } catch (error) {
    console.error('Get stock error:', error);
    return c.json({ success: false, error: 'Failed to fetch stock' }, 500);
  }
});

// Update stock for a specific product
stockRouter.put('/:productId', requirePermission('stock:adjust'), async (c) => {
  try {
    const user = c.get('user');
    const { productId } = c.req.param();
    const body = await c.req.json();
    const result = updateStockSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only update their store's stock
    if (user.role !== 'admin' && product.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Check if stock record exists
    const existingStock = await db.query.stock.findFirst({
      where: and(eq(stock.productId, productId), eq(stock.storeId, product.storeId)),
    });

    let updatedStock;

    if (existingStock) {
      // Update existing stock
      [updatedStock] = await db.update(stock)
        .set({
          quantity: result.data.quantity,
          lowStockThreshold: result.data.lowStockThreshold ?? existingStock.lowStockThreshold,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, existingStock.id))
        .returning();
    } else {
      // Create new stock record
      [updatedStock] = await db.insert(stock).values({
        storeId: product.storeId,
        productId,
        quantity: result.data.quantity,
        lowStockThreshold: result.data.lowStockThreshold ?? 10,
      }).returning();
    }

    // Log sync event
    await db.insert(syncLog).values({
      storeId: product.storeId,
      entityType: 'stock',
      entityId: updatedStock.id,
      action: 'update',
    });

    return c.json({
      success: true,
      data: updatedStock,
    });
  } catch (error) {
    console.error('Update stock error:', error);
    return c.json({ success: false, error: 'Failed to update stock' }, 500);
  }
});

// Bulk stock adjustment
stockRouter.post('/adjust', requirePermission('stock:adjust'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = adjustStockSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const { adjustments } = result.data;
    const results: Array<{ productId: string; success: boolean; newQuantity?: number; error?: string }> = [];

    for (const adjustment of adjustments) {
      try {
        // Get product
        const product = await db.query.products.findFirst({
          where: eq(products.id, adjustment.productId),
        });

        if (!product) {
          results.push({ productId: adjustment.productId, success: false, error: 'Product not found' });
          continue;
        }

        // Non-admins can only adjust their store's stock
        if (user.role !== 'admin' && product.storeId !== user.storeId) {
          results.push({ productId: adjustment.productId, success: false, error: 'Access denied' });
          continue;
        }

        // Get or create stock record
        let stockRecord = await db.query.stock.findFirst({
          where: and(eq(stock.productId, adjustment.productId), eq(stock.storeId, product.storeId)),
        });

        if (stockRecord) {
          const newQuantity = stockRecord.quantity + adjustment.quantity;

          // Check if adjustment would result in negative stock
          if (newQuantity < 0) {
            results.push({
              productId: adjustment.productId,
              success: false,
              error: `Insufficient stock. Current: ${stockRecord.quantity}, Adjustment: ${adjustment.quantity}`,
            });
            continue;
          }

          // Update stock
          [stockRecord] = await db.update(stock)
            .set({
              quantity: newQuantity,
              updatedAt: new Date(),
            })
            .where(eq(stock.id, stockRecord.id))
            .returning();
        } else {
          // Create new stock record if adjustment is positive
          if (adjustment.quantity < 0) {
            results.push({
              productId: adjustment.productId,
              success: false,
              error: 'Cannot create negative stock',
            });
            continue;
          }

          [stockRecord] = await db.insert(stock).values({
            storeId: product.storeId,
            productId: adjustment.productId,
            quantity: adjustment.quantity,
          }).returning();
        }

        // Log sync event
        await db.insert(syncLog).values({
          storeId: product.storeId,
          entityType: 'stock',
          entityId: stockRecord.id,
          action: 'update',
        });

        results.push({
          productId: adjustment.productId,
          success: true,
          newQuantity: stockRecord.quantity,
        });
      } catch (err) {
        console.error(`Error adjusting stock for ${adjustment.productId}:`, err);
        results.push({ productId: adjustment.productId, success: false, error: 'Internal error' });
      }
    }

    const allSuccessful = results.every(r => r.success);

    return c.json({
      success: allSuccessful,
      data: results,
      message: allSuccessful
        ? 'All stock adjustments completed successfully'
        : 'Some stock adjustments failed',
    }, allSuccessful ? 200 : 207);
  } catch (error) {
    console.error('Bulk stock adjustment error:', error);
    return c.json({ success: false, error: 'Failed to adjust stock' }, 500);
  }
});

// Get low stock alerts
stockRouter.get('/alerts/low', requirePermission('stock:read'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId') || user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Non-admins can only access their store's alerts
    if (user.role !== 'admin' && storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get low stock items
    const lowStockItems = await db.query.stock.findMany({
      where: and(
        eq(stock.storeId, storeId),
        // Using raw SQL for the comparison
      ),
    });

    // Filter where quantity <= lowStockThreshold
    const filtered = lowStockItems.filter(s => s.quantity <= s.lowStockThreshold);

    // Get product info
    const productIds = filtered.map(s => s.productId);
    const productsList = await db.query.products.findMany({
      where: and(
        eq(products.storeId, storeId),
        eq(products.isActive, true)
      ),
    });

    const productMap = new Map(productsList.map(p => [p.id, p]));

    const result = filtered
      .map(s => ({
        ...s,
        product: productMap.get(s.productId) || null,
      }))
      .filter(s => s.product !== null);

    return c.json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    return c.json({ success: false, error: 'Failed to fetch low stock alerts' }, 500);
  }
});

export default stockRouter;
