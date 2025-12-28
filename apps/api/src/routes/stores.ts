import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, stores } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createStoreSchema, updateStoreSchema } from '@pos/shared';

const storesRouter = new Hono();

// All routes require authentication
storesRouter.use('*', authMiddleware);

// List all stores (Admin only)
storesRouter.get('/', requirePermission('stores:read'), async (c) => {
  try {
    const allStores = await db.query.stores.findMany({
      orderBy: (stores, { desc }) => [desc(stores.createdAt)],
    });

    return c.json({
      success: true,
      data: allStores,
    });
  } catch (error) {
    console.error('List stores error:', error);
    return c.json({ success: false, error: 'Failed to fetch stores' }, 500);
  }
});

// Get store by ID
storesRouter.get('/:id', requirePermission('stores:read'), async (c) => {
  try {
    const { id } = c.req.param();

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!store) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }

    return c.json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error('Get store error:', error);
    return c.json({ success: false, error: 'Failed to fetch store' }, 500);
  }
});

// Create store (Admin only)
storesRouter.post('/', requirePermission('stores:create'), async (c) => {
  try {
    const body = await c.req.json();
    const result = createStoreSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const [newStore] = await db.insert(stores).values({
      name: result.data.name,
      address: result.data.address || null,
      phone: result.data.phone || null,
    }).returning();

    return c.json({
      success: true,
      data: newStore,
    }, 201);
  } catch (error) {
    console.error('Create store error:', error);
    return c.json({ success: false, error: 'Failed to create store' }, 500);
  }
});

// Update store (Admin only)
storesRouter.put('/:id', requirePermission('stores:update'), async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const result = updateStoreSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Check if store exists
    const existingStore = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!existingStore) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }

    const [updatedStore] = await db.update(stores)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, id))
      .returning();

    return c.json({
      success: true,
      data: updatedStore,
    });
  } catch (error) {
    console.error('Update store error:', error);
    return c.json({ success: false, error: 'Failed to update store' }, 500);
  }
});

// Soft delete store (Admin only)
storesRouter.delete('/:id', requirePermission('stores:delete'), async (c) => {
  try {
    const { id } = c.req.param();

    // Check if store exists
    const existingStore = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!existingStore) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }

    const [deletedStore] = await db.update(stores)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, id))
      .returning();

    return c.json({
      success: true,
      data: deletedStore,
      message: 'Store deactivated successfully',
    });
  } catch (error) {
    console.error('Delete store error:', error);
    return c.json({ success: false, error: 'Failed to delete store' }, 500);
  }
});

export default storesRouter;
