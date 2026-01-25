import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { devices } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const devicesRouter = new Hono();

const updateMasterTerminalSchema = z.object({
  isMasterTerminal: z.boolean(),
  masterTerminalName: z.string().optional(),
});

// GET /api/v1/devices/:id/master-status
devicesRouter.get(
  '/:id/master-status',
  authMiddleware,
  async (c) => {
    try {
      const deviceId = c.req.param('id');
      
      const device = await db.query.devices.findFirst({
        where: eq(devices.id, deviceId),
      });
      
      if (!device) {
        return c.json({ success: false, error: 'Device not found' }, 404);
      }
      
      return c.json({
        success: true,
        data: {
          id: device.id,
          storeId: device.storeId,
          deviceName: device.deviceName,
          deviceIdentifier: device.deviceIdentifier,
          isMasterTerminal: device.isMasterTerminal,
          masterTerminalName: device.masterTerminalName,
        },
      });
    } catch (error) {
      console.error('Error fetching device status:', error);
      return c.json({ success: false, error: 'Failed to fetch device status' }, 500);
    }
  }
);

// PUT /api/v1/devices/:id/master-status
devicesRouter.put(
  '/:id/master-status',
  authMiddleware,
  requireRole('admin'),
  async (c) => {
    try {
      const deviceId = c.req.param('id');
      const body = await c.req.json();
      const validation = updateMasterTerminalSchema.safeParse(body);
      
      if (!validation.success) {
        return c.json({ success: false, error: 'Invalid request body' }, 400);
      }
      
      await db.update(devices)
        .set({
          isMasterTerminal: validation.data.isMasterTerminal,
          masterTerminalName: validation.data.masterTerminalName,
          updatedAt: new Date(),
        })
        .where(eq(devices.id, deviceId));
      
      return c.json({ success: true, message: 'Master terminal status updated' });
    } catch (error) {
      console.error('Error updating master terminal status:', error);
      return c.json({ success: false, error: 'Failed to update status' }, 500);
    }
  }
);

// GET /api/v1/devices/store/:storeId
devicesRouter.get(
  '/store/:storeId',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
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
  }
);

export { devicesRouter as default };
