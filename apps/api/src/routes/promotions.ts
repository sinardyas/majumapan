import { Hono } from 'hono';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { db, promotions, discounts, syncLog, stores } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../utils/audit';
import { z } from 'zod';
import type { JwtPayload } from '@pos/shared';

const promotionsRouter = new Hono();

// All routes require authentication
promotionsRouter.use('*', authMiddleware);

// Validation schemas
const createPromotionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  bannerImageUrl: z.string().url('Invalid image URL'),
  discountId: z.string().uuid('Invalid discount ID').optional().nullable(),
  colorTheme: z.string().default('sunset-orange'),
  displayDuration: z.number().int().min(1).max(30).default(5),
  showOnDisplay: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updatePromotionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().optional(),
  bannerImageUrl: z.string().url('Invalid image URL').optional(),
  discountId: z.string().uuid('Invalid discount ID').optional().nullable(),
  colorTheme: z.string().optional(),
  displayDuration: z.number().int().min(1).max(30).optional(),
  showOnDisplay: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const reorderPromotionsSchema = z.object({
  promotionIds: z.array(z.string().uuid('Invalid promotion ID')).min(1),
});

// List promotions
promotionsRouter.get('/', requirePermission('promotions:read'), async (c) => {
  try {
    const activeOnly = c.req.query('activeOnly') !== 'false';
    const showOnDisplay = c.req.query('showOnDisplay');

    const conditions = [];

    if (activeOnly) {
      conditions.push(eq(promotions.isActive, true));
    }

    if (showOnDisplay !== undefined) {
      conditions.push(eq(promotions.showOnDisplay, showOnDisplay === 'true'));
    }

    const promotionList = await db.query.promotions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [asc(promotions.displayPriority)],
    });

    return c.json({
      success: true,
      data: promotionList,
      total: promotionList.length,
    });
  } catch (error) {
    console.error('List promotions error:', error);
    return c.json({ success: false, error: 'Failed to fetch promotions' }, 500);
  }
});

// Get promotion by ID
promotionsRouter.get('/:id', requirePermission('promotions:read'), async (c) => {
  try {
    const { id } = c.req.param();

    const promotion = await db.query.promotions.findFirst({
      where: eq(promotions.id, id),
    });

    if (!promotion) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    return c.json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    console.error('Get promotion error:', error);
    return c.json({ success: false, error: 'Failed to fetch promotion' }, 500);
  }
});

// Create promotion
promotionsRouter.post('/', requirePermission('promotions:create'), async (c) => {
  try {
    const user = c.get('user') as JwtPayload;
    const body = await c.req.json();

    const validationResult = createPromotionSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, 400);
    }

    const data = validationResult.data;

    // Get current max priority
    const currentPromotions = await db.query.promotions.findMany({
      columns: { displayPriority: true },
    });

    const maxPriority = currentPromotions.length > 0
      ? Math.max(...currentPromotions.map(p => p.displayPriority ?? 0))
      : -1;

    // Verify discount exists if provided
    if (data.discountId) {
      const discount = await db.query.discounts.findFirst({
        where: eq(discounts.id, data.discountId),
      });

      if (!discount) {
        return c.json({ success: false, error: 'Linked discount not found' }, 400);
      }
    }

    const [newPromotion] = await db.insert(promotions).values({
      name: data.name,
      description: data.description || null,
      bannerImageUrl: data.bannerImageUrl,
      discountId: data.discountId || null,
      colorTheme: data.colorTheme,
      displayPriority: maxPriority + 1,
      displayDuration: data.displayDuration,
      showOnDisplay: data.showOnDisplay,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    }).returning();

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'create',
      entityType: 'promotion',
      entityId: newPromotion.id,
      entityName: data.name,
      c,
    });

    // Sync log - add entry for all stores so they receive the global promotion
    const allStores = await db.query.stores.findMany({
      columns: { id: true },
    });
    await db.insert(syncLog).values(
      allStores.map(store => ({
        storeId: store.id,
        entityType: 'promotion',
        entityId: newPromotion.id,
        action: 'create',
      }))
    );

    return c.json({
      success: true,
      data: newPromotion,
    }, 201);
  } catch (error) {
    console.error('Create promotion error:', error);
    return c.json({ success: false, error: 'Failed to create promotion' }, 500);
  }
});

// Update promotion
promotionsRouter.put('/:id', requirePermission('promotions:update'), async (c) => {
  try {
    const user = c.get('user') as JwtPayload;
    const { id } = c.req.param();
    const body = await c.req.json();

    // Check if promotion exists
    const existing = await db.query.promotions.findFirst({
      where: eq(promotions.id, id),
    });

    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const validationResult = updatePromotionSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, 400);
    }

    const data = validationResult.data;

    // Verify discount exists if provided
    if (data.discountId) {
      const discount = await db.query.discounts.findFirst({
        where: eq(discounts.id, data.discountId),
      });

      if (!discount) {
        return c.json({ success: false, error: 'Linked discount not found' }, 400);
      }
    }

    const [updatedPromotion] = await db.update(promotions)
      .set({
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        bannerImageUrl: data.bannerImageUrl ?? existing.bannerImageUrl,
        discountId: data.discountId ?? existing.discountId,
        colorTheme: data.colorTheme ?? existing.colorTheme,
        displayDuration: data.displayDuration ?? existing.displayDuration,
        showOnDisplay: data.showOnDisplay ?? existing.showOnDisplay,
        startDate: data.startDate !== undefined
          ? (data.startDate ? new Date(data.startDate) : null)
          : existing.startDate,
        endDate: data.endDate !== undefined
          ? (data.endDate ? new Date(data.endDate) : null)
          : existing.endDate,
        isActive: data.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, id))
      .returning();

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'update',
      entityType: 'promotion',
      entityId: id,
      entityName: updatedPromotion.name,
      c,
    });

    // Sync log - add entry for all stores so they receive the update
    const allStores = await db.query.stores.findMany({
      columns: { id: true },
    });
    await db.insert(syncLog).values(
      allStores.map(store => ({
        storeId: store.id,
        entityType: 'promotion',
        entityId: id,
        action: 'update',
      }))
    );

    return c.json({
      success: true,
      data: updatedPromotion,
    });
  } catch (error) {
    console.error('Update promotion error:', error);
    return c.json({ success: false, error: 'Failed to update promotion' }, 500);
  }
});

// Delete promotion
promotionsRouter.delete('/:id', requirePermission('promotions:delete'), async (c) => {
  try {
    const user = c.get('user') as JwtPayload;
    const { id } = c.req.param();

    const existing = await db.query.promotions.findFirst({
      where: eq(promotions.id, id),
    });

    if (!existing) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    await db.delete(promotions).where(eq(promotions.id, id));

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'delete',
      entityType: 'promotion',
      entityId: id,
      entityName: existing.name,
      c,
    });

    // Sync log - add entry for all stores so they delete the promotion
    const allStores = await db.query.stores.findMany({
      columns: { id: true },
    });
    await db.insert(syncLog).values(
      allStores.map(store => ({
        storeId: store.id,
        entityType: 'promotion',
        entityId: id,
        action: 'delete',
      }))
    );

    return c.json({
      success: true,
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    console.error('Delete promotion error:', error);
    return c.json({ success: false, error: 'Failed to delete promotion' }, 500);
  }
});

// Reorder promotions
promotionsRouter.put('/reorder', requirePermission('promotions:reorder'), async (c) => {
  try {
    const user = c.get('user') as JwtPayload;

    const body = await c.req.json();
    const validationResult = reorderPromotionsSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, 400);
    }

    const { promotionIds } = validationResult.data;

    // Update priorities in batch
    await Promise.all(
      promotionIds.map((promoId, index) =>
        db.update(promotions)
          .set({ displayPriority: index, updatedAt: new Date() })
          .where(eq(promotions.id, promoId))
      )
    );

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'update',
      entityType: 'promotions',
      c,
    });

    // Sync log - add entry for all stores so they receive the reorder
    const allStores = await db.query.stores.findMany({
      columns: { id: true },
    });
    await db.insert(syncLog).values(
      allStores.flatMap(store =>
        promotionIds.map(promoId => ({
          storeId: store.id,
          entityType: 'promotion',
          entityId: promoId,
          action: 'update',
        }))
      )
    );

    return c.json({
      success: true,
      message: 'Promotions reordered successfully',
    });
  } catch (error) {
    console.error('Reorder promotions error:', error);
    return c.json({ success: false, error: 'Failed to reorder promotions' }, 500);
  }
});

export default promotionsRouter;
