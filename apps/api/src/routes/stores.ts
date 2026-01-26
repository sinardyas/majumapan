import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db, stores, devices } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createAuditLog } from '../utils/audit';
import { createStoreSchema, updateStoreSchema } from '@pos/shared';

const storesRouter = new Hono();

const createDeviceSchema = z.object({
  deviceName: z.string().optional(),
  deviceIdentifier: z.string().min(1),
});

// All routes require authentication
storesRouter.use('*', authMiddleware);

// List all stores (Admin only)
storesRouter.get('/', requireRole('admin'), async (c) => {
  try {
    const allStores = await db.query.stores.findMany({
      orderBy: (stores, { asc }) => [asc(stores.name)],
    });

    return c.json({
      success: true,
      data: {
        stores: allStores,
        total: allStores.length,
      },
    });
  } catch (error) {
    console.error('List stores error:', error);
    return c.json({ success: false, error: 'Failed to fetch stores' }, 500);
  }
});

// Get store by ID
storesRouter.get('/:id', requireRole('admin'), async (c) => {
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
storesRouter.post('/', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
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

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'create',
      entityType: 'store',
      entityId: newStore.id,
      entityName: newStore.name,
      c,
    });

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
storesRouter.put('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
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

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'update',
      entityType: 'store',
      entityId: id,
      entityName: updatedStore.name,
      c,
    });

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
storesRouter.delete('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
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

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'delete',
      entityType: 'store',
      entityId: id,
      entityName: existingStore.name,
      c,
    });

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

// GET /api/v1/stores/:storeId/devices - List store devices
storesRouter.get('/:storeId/devices', requireRole('admin', 'manager'), async (c) => {
  try {
    const storeId = c.req.param('storeId');

    const storeDevices = await db.query.devices.findMany({
      where: eq(devices.storeId, storeId),
      orderBy: [devices.createdAt],
    });

    return c.json({ success: true, data: storeDevices });
  } catch (error) {
    console.error('Error fetching store devices:', error);
    return c.json({ success: false, error: 'Failed to fetch devices' }, 500);
  }
});

// POST /api/v1/stores/:storeId/devices - Register new device
storesRouter.post('/:storeId/devices', requireRole('admin', 'manager'), async (c) => {
  try {
    const storeId = c.req.param('storeId');
    const user = c.get('user');
    const body = await c.req.json();
    const validation = createDeviceSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ success: false, error: 'Invalid request body' }, 400);
    }

    const [newDevice] = await db.insert(devices).values({
      storeId,
      deviceName: validation.data.deviceName || null,
      deviceIdentifier: validation.data.deviceIdentifier,
      isMasterTerminal: false,
      masterTerminalName: null,
    }).returning();

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'create',
      entityType: 'device',
      entityId: newDevice.id,
      entityName: validation.data.deviceName || newDevice.deviceIdentifier,
      c,
    });

    return c.json({
      success: true,
      data: {
        id: newDevice.id,
        storeId: newDevice.storeId,
        deviceName: newDevice.deviceName,
        deviceIdentifier: newDevice.deviceIdentifier,
        isMasterTerminal: newDevice.isMasterTerminal,
        masterTerminalName: newDevice.masterTerminalName,
      },
    }, 201);
  } catch (error) {
    console.error('Error creating device:', error);
    return c.json({ success: false, error: 'Failed to create device' }, 500);
  }
});

export default storesRouter;
