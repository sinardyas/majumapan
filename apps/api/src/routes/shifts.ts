import { Hono } from 'hono';
import { z } from 'zod';
import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { db, shifts } from '../db';
import { desc, eq, and, gte } from 'drizzle-orm';
import { verifyAccessToken } from '../utils/jwt';
import type { JwtPayload } from '@pos/shared';

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

const shiftsRouter = new Hono();

const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyAccessToken(token);
  
  if (!payload) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  
  c.set('user', payload);
  await next();
});

function generateShiftNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SHIFT-${dateStr}-${sequence}`;
}

const openShiftSchema = z.object({
  floatAmount: z.number().min(0),
  note: z.string().optional(),
});

const closeShiftSchema = z.object({
  shiftId: z.string().uuid(),
  endingCash: z.number().min(0),
  note: z.string().optional(),
  supervisorApproval: z.object({
    supervisorId: z.string().uuid(),
    approvedAt: z.string().datetime(),
  }).optional(),
  varianceReason: z.string().optional(),
});

// Apply auth middleware to all routes
shiftsRouter.use('*', authMiddleware);

// POST /api/shifts/open - Open a new shift
shiftsRouter.post('/open', async (c) => {
  const data = await c.req.json();
  const parsed = openShiftSchema.parse(data);
  const user = c.get('user');

  // Check if user has a store assigned
  if (!user.storeId) {
    return c.json({ success: false, error: 'User is not assigned to a store' }, 400);
  }

  // Check for existing active shift
  const existingShift = await db.query.shifts.findFirst({
    where: and(
      eq(shifts.cashierId, user.userId),
      eq(shifts.status, 'ACTIVE'),
    ),
  });

  if (existingShift) {
    return c.json({ success: false, error: 'You already have an active shift' }, 400);
  }

  const now = new Date();
  const shiftNumber = generateShiftNumber();

  const [newShift] = await db.insert(shifts).values({
    shiftNumber,
    cashierId: user.userId,
    storeId: user.storeId,
    openingFloat: parsed.floatAmount.toString(),
    openingNote: parsed.note || undefined,
    openingTimestamp: now,
    status: 'ACTIVE',
    syncStatus: 'pending',
  }).returning();

  return c.json({
    success: true,
    data: { shift: newShift },
  });
});

// POST /api/shifts/close - Close active shift
shiftsRouter.post('/close', async (c) => {
  const data = await c.req.json();
  const parsed = closeShiftSchema.parse(data);
  const user = c.get('user');

  const shift = await db.query.shifts.findFirst({
    where: eq(shifts.id, parsed.shiftId),
  });

  if (!shift) {
    return c.json({ success: false, error: 'Shift not found' }, 404);
  }

  // Check authorization - cashier can close their own shift, supervisor/admin can close any
  if (shift.cashierId !== user.userId && user.role !== 'supervisor' && user.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  const now = new Date();

  // Calculate variance
  const variance = parsed.endingCash - Number(shift.openingFloat);

  // Check if supervisor approval is needed for large variance
  if (Math.abs(variance) >= 5 && !parsed.supervisorApproval) {
    return c.json({
      success: false,
      error: 'Large variance requires supervisor approval',
      data: { variance, requiresApproval: true },
    }, 400);
  }

  await db.update(shifts)
    .set({
      endingCash: String(parsed.endingCash),
      endingNote: parsed.note ?? undefined,
      closingTimestamp: now,
      status: 'CLOSED',
      variance: String(variance),
      varianceReason: parsed.varianceReason ?? undefined,
      varianceApprovedBy: parsed.supervisorApproval?.supervisorId ?? undefined,
      varianceApprovedAt: parsed.supervisorApproval?.approvedAt ? new Date(parsed.supervisorApproval.approvedAt) : undefined,
      updatedAt: now,
      syncStatus: 'pending',
    })
    .where(eq(shifts.id, parsed.shiftId));

  const updatedShift = await db.query.shifts.findFirst({
    where: eq(shifts.id, parsed.shiftId),
  });

  return c.json({
    success: true,
    data: { shift: updatedShift },
  });
});

// GET /api/shifts/active - Get current active shift
shiftsRouter.get('/active', async (c) => {
  const user = c.get('user');

  const shift = await db.query.shifts.findFirst({
    where: and(
      eq(shifts.cashierId, user.userId),
      eq(shifts.status, 'ACTIVE'),
    ),
  });

  return c.json({
    success: true,
    data: { shift: shift || null },
  });
});

// GET /api/shifts/:id - Get shift by ID
shiftsRouter.get('/:id', async (c) => {
  const shiftId = c.req.param('id');
  const user = c.get('user');

  const shift = await db.query.shifts.findFirst({
    where: eq(shifts.id, shiftId),
  });

  if (!shift) {
    return c.json({ success: false, error: 'Shift not found' }, 404);
  }

  // Cashiers can only view their own shifts, supervisors/admins can view all
  if (shift.cashierId !== user.userId && user.role !== 'supervisor' && user.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  return c.json({
    success: true,
    data: { shift },
  });
});

// GET /api/shifts - List shifts with filters
shiftsRouter.get('/', async (c) => {
  const user = c.get('user');
  const { status, startDate, endDate } = c.req.query();

  const conditions = [];

  // Non-supervisors can only see their own shifts
  if (user.role !== 'supervisor' && user.role !== 'admin') {
    conditions.push(eq(shifts.cashierId, user.userId));
  }

  if (status) {
    conditions.push(eq(shifts.status, status as 'ACTIVE' | 'CLOSED' | 'SUSPENDED'));
  }

  if (startDate) {
    conditions.push(gte(shifts.openingTimestamp, new Date(startDate)));
  }

  const shiftList = await db.query.shifts.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(shifts.openingTimestamp)],
    limit: 100,
  });

  return c.json({
    success: true,
    data: { shifts: shiftList },
  });
});

// POST /api/shifts/sync - Sync offline shifts
shiftsRouter.post('/sync', async (c) => {
  const clientShifts = await c.req.json();

  if (!Array.isArray(clientShifts)) {
    return c.json({ success: false, error: 'Invalid request' }, 400);
  }

  const serverShifts = [];

  for (const clientShift of clientShifts) {
    const existingShift = await db.query.shifts.findFirst({
      where: eq(shifts.id, clientShift.id),
    });

    if (existingShift) {
      // Update if client is newer
      if (new Date(clientShift.updatedAt) > new Date(existingShift.updatedAt)) {
        await db.update(shifts)
          .set({
            ...clientShift,
            serverId: existingShift.id,
            updatedAt: new Date(),
          })
          .where(eq(shifts.id, clientShift.id));
      }
      serverShifts.push(existingShift);
    } else {
      // Insert new shift
      const [newShift] = await db.insert(shifts).values({
        ...clientShift,
        serverId: clientShift.id,
      }).returning();
      serverShifts.push(newShift);
    }
  }

  return c.json({
    success: true,
    data: { shifts: serverShifts },
  });
});

export default shiftsRouter;
