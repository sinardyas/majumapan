import { Hono } from 'hono';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { db, auditLogTable } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const auditLogsRouter = new Hono();

auditLogsRouter.use('*', authMiddleware);

auditLogsRouter.get('/', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const entityType = c.req.query('entityType');
    const search = c.req.query('search');

    const conditions: any[] = [];

    if (userId) {
      conditions.push(eq(auditLogTable.userId, userId));
    }

    if (action) {
      conditions.push(eq(auditLogTable.action, action));
    }

    if (entityType) {
      conditions.push(eq(auditLogTable.entityType, entityType));
    }

    if (search) {
      conditions.push(or(
        sql`${auditLogTable.entityName} ILIKE ${`%${search}%`}`,
        sql`${auditLogTable.userEmail} ILIKE ${`%${search}%`}`
      ));
    }

    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult?.count || 0);

    const logs = await db.select()
      .from(auditLogTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List audit logs error:', error);
    return c.json({ success: false, error: 'Failed to fetch audit logs' }, 500);
  }
});

export default auditLogsRouter;
