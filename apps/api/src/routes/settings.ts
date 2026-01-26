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

settingsRouter.get('/eod', requireRole('admin'), async (c) => {
  try {
    const [startHourResult, autoTransitionResult, emailsResult] = await Promise.all([
      db.query.appSettings.findFirst({
        where: eq(appSettings.key, 'eod_operational_day_start_hour'),
      }),
      db.query.appSettings.findFirst({
        where: eq(appSettings.key, 'eod_allow_auto_transition'),
      }),
      db.query.appSettings.findFirst({
        where: eq(appSettings.key, 'eod_notification_emails'),
      }),
    ]);

    const notificationEmails = emailsResult?.value
      ? JSON.parse(emailsResult.value)
      : [];

    return c.json({
      success: true,
      data: {
        operationalDayStartHour: parseInt(startHourResult?.value || '6'),
        allowAutoDayTransition: autoTransitionResult?.value === 'true',
        notificationEmails,
      },
    });
  } catch (error) {
    console.error('Get EOD settings error:', error);
    return c.json({ success: false, error: 'Failed to fetch EOD settings' }, 500);
  }
});

settingsRouter.put('/eod', requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();

    if (typeof body.operationalDayStartHour !== 'number' ||
        body.operationalDayStartHour < 0 ||
        body.operationalDayStartHour > 23) {
      return c.json({ success: false, error: 'Invalid operational day start hour' }, 400);
    }

    if (typeof body.allowAutoDayTransition !== 'boolean') {
      return c.json({ success: false, error: 'Invalid auto day transition value' }, 400);
    }

    const emailsArray = Array.isArray(body.notificationEmails)
      ? body.notificationEmails
      : [];

    await Promise.all([
      db.insert(appSettings).values({
        key: 'eod_operational_day_start_hour',
        value: String(body.operationalDayStartHour),
      }).onConflictDoUpdate({
        target: appSettings.key,
        set: { value: String(body.operationalDayStartHour), updatedAt: new Date() },
      }),
      db.insert(appSettings).values({
        key: 'eod_allow_auto_transition',
        value: String(body.allowAutoDayTransition),
      }).onConflictDoUpdate({
        target: appSettings.key,
        set: { value: String(body.allowAutoDayTransition), updatedAt: new Date() },
      }),
      db.insert(appSettings).values({
        key: 'eod_notification_emails',
        value: JSON.stringify(emailsArray),
      }).onConflictDoUpdate({
        target: appSettings.key,
        set: { value: JSON.stringify(emailsArray), updatedAt: new Date() },
      }),
    ]);

    return c.json({
      success: true,
      message: 'EOD settings updated successfully',
      data: {
        operationalDayStartHour: body.operationalDayStartHour,
        allowAutoDayTransition: body.allowAutoDayTransition,
        notificationEmails: emailsArray,
      },
    });
  } catch (error) {
    console.error('Update EOD settings error:', error);
    return c.json({ success: false, error: 'Failed to update EOD settings' }, 500);
  }
});

export default settingsRouter;
