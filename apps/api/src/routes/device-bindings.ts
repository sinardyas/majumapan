import { Hono } from 'hono';
import { z } from 'zod';
import { db, deviceBindings, stores, devices, users, userSessions } from '../db';
import { eq, and, ilike, asc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { generateBindingCode, generateDeviceName, calculateExpiryTime, createQrData } from '../utils/device';
import { createAuditLog } from '../utils/audit';

const deviceBindingsRouter = new Hono();

const createDeviceSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  expiresIn: z.enum(['never', '24h', '7d', '30d']).optional().default('24h'),
});

const revokeDeviceSchema = z.object({
  reason: z.string().optional(),
});

// All routes require authentication
deviceBindingsRouter.use('*', authMiddleware);
deviceBindingsRouter.use('*', requireRole('admin', 'manager'));

// List all device bindings (admin) or store device bindings (manager)
deviceBindingsRouter.get('/', async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId');
    const status = c.req.query('status');
    const search = c.req.query('search');

    let queryConditions = [];

    // Managers can only see devices for their store
    if (user.role === 'manager' && user.storeId) {
      queryConditions.push(eq(deviceBindings.storeId, user.storeId));
    } else if (storeId) {
      queryConditions.push(eq(deviceBindings.storeId, storeId));
    }

    if (status) {
      queryConditions.push(eq(deviceBindings.status, status as 'pending' | 'active' | 'revoked'));
    }

    if (search) {
      queryConditions.push(ilike(deviceBindings.deviceName, `%${search}%`));
    }

    const bindings = await db.select({
      id: deviceBindings.id,
      storeId: deviceBindings.storeId,
      bindingCode: deviceBindings.bindingCode,
      status: deviceBindings.status,
      deviceName: deviceBindings.deviceName,
      isMasterTerminal: deviceBindings.isMasterTerminal,
      boundAt: deviceBindings.boundAt,
      expiresAt: deviceBindings.expiresAt,
      createdAt: deviceBindings.createdAt,
    })
      .from(deviceBindings)
      .where(queryConditions.length > 0 ? and(...queryConditions) : undefined)
      .orderBy(asc(deviceBindings.createdAt));

    // Get store names
    const storeIds = [...new Set(bindings.map(b => b.storeId))];
    const storeData = await db.select({ id: stores.id, name: stores.name })
      .from(stores)
      .where(storeIds.length > 0 ? eq(stores.id, storeIds[0]) : undefined);
    
    const storeMap = new Map(storeData.map(s => [s.id, s.name]));
    for (const id of storeIds.slice(1)) {
      const more = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.id, id));
      more.forEach(s => storeMap.set(s.id, s.name));
    }

    const result = bindings.map(b => ({
      ...b,
      storeName: storeMap.get(b.storeId) || 'Unknown Store',
    }));

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('List device bindings error:', error);
    return c.json({ success: false, error: 'Failed to fetch device bindings' }, 500);
  }
});

// Get device binding by ID
deviceBindingsRouter.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const binding = await db.query.deviceBindings.findFirst({
      where: eq(deviceBindings.id, id),
    });

    if (!binding) {
      return c.json({ success: false, error: 'Device binding not found' }, 404);
    }

    // Managers can only view devices from their store
    if (user.role === 'manager' && binding.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    return c.json({ success: true, data: binding });
  } catch (error) {
    console.error('Get device binding error:', error);
    return c.json({ success: false, error: 'Failed to fetch device binding' }, 500);
  }
});

// Create new device binding
deviceBindingsRouter.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = createDeviceSchema.safeParse(body);

    if (!result.success) {
      return c.json({ success: false, error: 'Validation failed', details: result.error.flatten() }, 400);
    }

    const { storeId, expiresIn } = result.data;

    // Managers can only create devices for their store
    if (user.role === 'manager' && user.storeId !== storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Check store exists
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });

    if (!store) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }

    // Generate binding code and device name
    const bindingCode = generateBindingCode();
    const deviceName = generateDeviceName();
    const expiresAt = calculateExpiryTime(expiresIn);
    const qrData = createQrData(storeId, bindingCode, expiresAt);

    // Create device binding
    const newBinding = await db.insert(deviceBindings).values({
      storeId,
      bindingCode,
      qrData,
      status: 'pending',
      deviceName,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'create',
      entityType: 'device_binding',
      entityId: newBinding[0].id,
      entityName: deviceName,
      c,
    });

    return c.json({
      success: true,
      data: {
        ...newBinding[0],
        qrCode: `data:text/plain;base64,${Buffer.from(qrData).toString('base64')}`,
      },
    });
  } catch (error) {
    console.error('Create device binding error:', error);
    return c.json({ success: false, error: 'Failed to create device binding' }, 500);
  }
});

// Revoke device binding
deviceBindingsRouter.post('/:id/revoke', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const result = revokeDeviceSchema.safeParse(body);

    if (!result.success) {
      return c.json({ success: false, error: 'Validation failed' }, 400);
    }

    const { reason } = result.data;

    const binding = await db.query.deviceBindings.findFirst({
      where: eq(deviceBindings.id, id),
    });

    if (!binding) {
      return c.json({ success: false, error: 'Device binding not found' }, 404);
    }

    // Managers can only revoke devices from their store
    if (user.role === 'manager' && binding.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Update binding status
    await db.update(deviceBindings)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: user.userId,
        revokedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(deviceBindings.id, id));

    // Deactivate any active sessions on this device
    // (This would require user_sessions table - handled separately)

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'revoke',
      entityType: 'device_binding',
      entityId: id,
      entityName: binding.deviceName,
      c,
    });

    return c.json({ success: true, message: 'Device binding revoked' });
  } catch (error) {
    console.error('Revoke device binding error:', error);
    return c.json({ success: false, error: 'Failed to revoke device binding' }, 500);
  }
});

// Regenerate binding code
deviceBindingsRouter.post('/:id/regenerate', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const binding = await db.query.deviceBindings.findFirst({
      where: eq(deviceBindings.id, id),
    });

    if (!binding) {
      return c.json({ success: false, error: 'Device binding not found' }, 404);
    }

    // Managers can only regenerate devices from their store
    if (user.role === 'manager' && binding.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Generate new code
    const newBindingCode = generateBindingCode();
    const expiresAt = calculateExpiryTime('24h');
    const qrData = createQrData(binding.storeId, newBindingCode, expiresAt);

    await db.update(deviceBindings)
      .set({
        bindingCode: newBindingCode,
        qrData,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(deviceBindings.id, id));

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'regenerate',
      entityType: 'device_binding',
      entityId: id,
      entityName: binding.deviceName,
      c,
    });

    return c.json({
      success: true,
      data: {
        bindingCode: newBindingCode,
        qrCode: `data:text/plain;base64,${Buffer.from(qrData).toString('base64')}`,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Regenerate device binding error:', error);
    return c.json({ success: false, error: 'Failed to regenerate device binding' }, 500);
  }
});

// Force logout a user from a device
deviceBindingsRouter.post('/force-logout', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { userId, deviceId } = body;

    if (!userId) {
      return c.json({ success: false, error: 'userId is required' }, 400);
    }

    // Managers can only force logout users from their store
    if (user.role === 'manager' && user.storeId) {
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!targetUser || targetUser.storeId !== user.storeId) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }
    }

    // Deactivate all sessions for the user (optionally on specific device)
    let query = eq(userSessions.userId, userId);
    if (deviceId) {
      query = and(query, eq(userSessions.deviceId, deviceId)) as any;
    }

    await db.update(userSessions)
      .set({ isActive: false, endedAt: new Date() })
      .where(and(query, eq(userSessions.isActive, true)));

    // Find target user name for audit log
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'logout',
      entityType: 'user_session',
      entityId: userId,
      entityName: targetUser?.name || 'Unknown',
      changes: { forceLogout: { old: true, new: false } },
      c,
    });

    return c.json({ success: true, message: 'User logged out successfully' });
  } catch (error) {
    console.error('Force logout error:', error);
    return c.json({ success: false, error: 'Failed to force logout user' }, 500);
  }
});

// Set/unset master terminal
deviceBindingsRouter.put('/:id/master-status', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const { isMasterTerminal } = body;

    if (typeof isMasterTerminal !== 'boolean') {
      return c.json({ success: false, error: 'isMasterTerminal must be a boolean' }, 400);
    }

    const binding = await db.query.deviceBindings.findFirst({
      where: eq(deviceBindings.id, id),
    });

    if (!binding) {
      return c.json({ success: false, error: 'Device binding not found' }, 404);
    }

    // Managers can only modify devices from their store
    if (user.role === 'manager' && binding.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Check if binding is active
    if (binding.status !== 'active') {
      return c.json({ success: false, error: 'Can only set master terminal on active devices' }, 400);
    }

    const oldMasterTerminal = binding.isMasterTerminal;

    // If setting as master, unset any existing master terminal for this store
    if (isMasterTerminal && !oldMasterTerminal) {
      await db.update(deviceBindings)
        .set({ isMasterTerminal: false, updatedAt: new Date() })
        .where(and(
          eq(deviceBindings.storeId, binding.storeId),
          eq(deviceBindings.isMasterTerminal, true)
        ));
    }

    // Update the device binding
    await db.update(deviceBindings)
      .set({ isMasterTerminal, updatedAt: new Date() })
      .where(eq(deviceBindings.id, id));

    // Determine audit action
    let auditAction: 'set_master' | 'replace_master' | 'remove_master' = 'set_master';
    if (!isMasterTerminal) {
      auditAction = 'remove_master';
    } else if (oldMasterTerminal) {
      auditAction = 'set_master';
    } else {
      auditAction = 'replace_master';
    }

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: auditAction,
      entityType: 'device_binding',
      entityId: id,
      entityName: binding.deviceName,
      changes: {
        isMasterTerminal: { old: oldMasterTerminal, new: isMasterTerminal },
      },
      c,
    });

    return c.json({
      success: true,
      data: { id, isMasterTerminal },
    });
  } catch (error) {
    console.error('Set master terminal error:', error);
    return c.json({ success: false, error: 'Failed to set master terminal' }, 500);
  }
});

export default deviceBindingsRouter;
