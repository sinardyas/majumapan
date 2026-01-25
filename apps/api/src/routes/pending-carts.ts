import { Hono } from 'hono';
import { db } from '../db';
import { pendingCartsQueue } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '@pos/shared';

const pendingCartsRouter = new Hono();

// GET /api/v1/pending-carts
pendingCartsRouter.get(
  '/',
  authMiddleware,
  async (c) => {
    try {
      const storeId = c.req.query('storeId');
      const operationalDate = c.req.query('operationalDate');
      
      if (!storeId || !operationalDate) {
        return c.json({ success: false, error: 'storeId and operationalDate are required' }, 400);
      }
      
      const pendingCarts = await db.query.pendingCartsQueue.findMany({
        where: and(
          eq(pendingCartsQueue.storeId, storeId),
          eq(pendingCartsQueue.operationalDate, operationalDate)
        ),
        orderBy: [pendingCartsQueue.createdAt],
      });
      
      return c.json({ success: true, data: pendingCarts });
    } catch (error) {
      console.error('Error fetching pending carts:', error);
      return c.json({ success: false, error: 'Failed to fetch pending carts' }, 500);
    }
  }
);

// POST /api/v1/pending-carts/:cartId/restore
pendingCartsRouter.post(
  '/:cartId/restore',
  authMiddleware,
  async (c) => {
    try {
      const cartId = c.req.param('cartId');
      const user = c.get('user') as JwtPayload;
      
      const pendingCart = await db.query.pendingCartsQueue.findFirst({
        where: eq(pendingCartsQueue.cartId, cartId),
      });
      
      if (!pendingCart) {
        return c.json({ success: false, error: 'Pending cart not found' }, 404);
      }
      
      await db.delete(pendingCartsQueue)
        .where(eq(pendingCartsQueue.cartId, cartId));
      
      return c.json({
        success: true,
        data: { cartId, restored: true },
      });
    } catch (error) {
      console.error('Error restoring pending cart:', error);
      return c.json({ success: false, error: 'Failed to restore cart' }, 500);
    }
  }
);

// DELETE /api/v1/pending-carts/:cartId
pendingCartsRouter.delete(
  '/:cartId',
  authMiddleware,
  async (c) => {
    try {
      const cartId = c.req.param('cartId');
      
      await db.delete(pendingCartsQueue)
        .where(eq(pendingCartsQueue.cartId, cartId));
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Error voiding pending cart:', error);
      return c.json({ success: false, error: 'Failed to void cart' }, 500);
    }
  }
);

export { pendingCartsRouter as default };
