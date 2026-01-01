import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, appSettings } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';

const settingsRouter = new Hono();

settingsRouter.use('*', authMiddleware);

settingsRouter.get('/', requireRole('admin'), async (c) => {
  try {
    const allSettings = await db.select().from(appSettings);

    const settingsObj: Record<string, string> = {};
    for (const setting of allSettings) {
      settingsObj[setting.key] = setting.value;
    }

    return c.json({
      success: true,
      data: settingsObj,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json({ success: false, error: 'Failed to fetch settings' }, 500);
  }
});

settingsRouter.put('/', requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();

    if (!body || typeof body !== 'object') {
      return c.json({ success: false, error: 'Invalid request body' }, 400);
    }

    const updates: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') {
        return c.json({ success: false, error: `Invalid value for ${key}` }, 400);
      }
      updates.push({ key, value });
    }

    for (const { key, value } of updates) {
      await db.insert(appSettings).values({ key, value })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: new Date() },
        });
    }

    return c.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

export default settingsRouter;
