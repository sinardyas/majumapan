import { Hono } from 'hono';
import { eq, and, or, sql } from 'drizzle-orm';
import { db, discounts, productDiscounts, syncLog } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../utils/audit';
import { createDiscountSchema, updateDiscountSchema } from '@pos/shared';

const discountsRouter = new Hono();

// All routes require authentication
discountsRouter.use('*', authMiddleware);

// List discounts
discountsRouter.get('/', requirePermission('discounts:read'), async (c) => {
  try {
    const user = c.get('user');
    const requestedStoreId = c.req.query('storeId');
    const scope = c.req.query('scope'); // 'product' or 'cart'
    const activeOnly = c.req.query('activeOnly') !== 'false';

    const canAccessAllStores = user.role === 'admin';

    let discountList;

    if (requestedStoreId) {
      // Specific store requested
      if (user.role !== 'admin' && requestedStoreId !== user.storeId) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      const conditions = [eq(discounts.storeId, requestedStoreId)];

      if (activeOnly) {
        conditions.push(eq(discounts.isActive, true));
      }

      if (scope === 'product' || scope === 'cart') {
        conditions.push(eq(discounts.discountScope, scope));
      }

      discountList = await db.query.discounts.findMany({
        where: and(...conditions),
        orderBy: (discounts, { desc }) => [desc(discounts.createdAt)],
      });
    } else if (canAccessAllStores && !user.storeId) {
      // Admin without storeId - return ALL discounts
      const conditions = [];

      if (activeOnly) {
        conditions.push(eq(discounts.isActive, true));
      }

      if (scope === 'product' || scope === 'cart') {
        conditions.push(eq(discounts.discountScope, scope));
      }

      discountList = await db.query.discounts.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (discounts, { desc }) => [desc(discounts.createdAt)],
      });
    } else {
      // No storeId in query, use user's store
      const effectiveStoreId = user.storeId || requestedStoreId;

      if (!effectiveStoreId) {
        return c.json({ success: false, error: 'Store ID is required' }, 400);
      }

      const conditions = [eq(discounts.storeId, effectiveStoreId)];

      if (activeOnly) {
        conditions.push(eq(discounts.isActive, true));
      }

      if (scope === 'product' || scope === 'cart') {
        conditions.push(eq(discounts.discountScope, scope));
      }

      discountList = await db.query.discounts.findMany({
        where: and(...conditions),
        orderBy: (discounts, { desc }) => [desc(discounts.createdAt)],
      });
    }

    return c.json({
      success: true,
      data: discountList,
    });
  } catch (error) {
    console.error('List discounts error:', error);
    return c.json({ success: false, error: 'Failed to fetch discounts' }, 500);
  }
});

// Get discount by ID
discountsRouter.get('/:id', requirePermission('discounts:read'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const discount = await db.query.discounts.findFirst({
      where: eq(discounts.id, id),
    });

    if (!discount) {
      return c.json({ success: false, error: 'Discount not found' }, 404);
    }

    // Non-admins can only access their store's discounts
    if (user.role !== 'admin' && discount.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get associated products for product-level discounts
    let products: string[] = [];
    if (discount.discountScope === 'product') {
      const productLinks = await db.query.productDiscounts.findMany({
        where: eq(productDiscounts.discountId, id),
      });
      products = productLinks.map(pl => pl.productId);
    }

    return c.json({
      success: true,
      data: {
        ...discount,
        productIds: products,
      },
    });
  } catch (error) {
    console.error('Get discount error:', error);
    return c.json({ success: false, error: 'Failed to fetch discount' }, 500);
  }
});

// Create discount
discountsRouter.post('/', requirePermission('discounts:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = createDiscountSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Determine store ID
    const storeId = user.role === 'admin'
      ? (body.storeId || user.storeId)
      : user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Check for duplicate code if provided
    if (result.data.code) {
      const existingCode = await db.query.discounts.findFirst({
        where: and(eq(discounts.storeId, storeId), eq(discounts.code, result.data.code)),
      });

      if (existingCode) {
        return c.json({ success: false, error: 'Discount code already exists' }, 400);
      }
    }

    // Validate percentage discounts
    if (result.data.discountType === 'percentage' && result.data.value > 100) {
      return c.json({ success: false, error: 'Percentage discount cannot exceed 100%' }, 400);
    }

    const [newDiscount] = await db.insert(discounts).values({
      storeId,
      code: result.data.code || null,
      name: result.data.name,
      description: result.data.description || null,
      discountType: result.data.discountType,
      discountScope: result.data.discountScope,
      value: result.data.value.toString(),
      minPurchaseAmount: result.data.minPurchaseAmount?.toString() || null,
      maxDiscountAmount: result.data.maxDiscountAmount?.toString() || null,
      startDate: result.data.startDate ? new Date(result.data.startDate) : null,
      endDate: result.data.endDate ? new Date(result.data.endDate) : null,
      usageLimit: result.data.usageLimit || null,
    }).returning();

    // Link products if it's a product discount
    if (result.data.discountScope === 'product' && result.data.productIds?.length) {
      for (const productId of result.data.productIds) {
        await db.insert(productDiscounts).values({
          discountId: newDiscount.id,
          productId,
        });
      }
    }

    // Log sync event
    await db.insert(syncLog).values({
      storeId,
      entityType: 'discount',
      entityId: newDiscount.id,
      action: 'create',
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'create',
      entityType: 'discount',
      entityId: newDiscount.id,
      entityName: newDiscount.name,
      c,
    });

    return c.json({
      success: true,
      data: newDiscount,
    }, 201);
  } catch (error) {
    console.error('Create discount error:', error);
    return c.json({ success: false, error: 'Failed to create discount' }, 500);
  }
});

// Update discount
discountsRouter.put('/:id', requirePermission('discounts:update'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const result = updateDiscountSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Check if discount exists
    const existingDiscount = await db.query.discounts.findFirst({
      where: eq(discounts.id, id),
    });

    if (!existingDiscount) {
      return c.json({ success: false, error: 'Discount not found' }, 404);
    }

    // Non-admins can only update their store's discounts
    if (user.role !== 'admin' && existingDiscount.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Check for duplicate code if being changed
    if (result.data.code && result.data.code !== existingDiscount.code) {
      const existingCode = await db.query.discounts.findFirst({
        where: and(
          eq(discounts.storeId, existingDiscount.storeId!),
          eq(discounts.code, result.data.code)
        ),
      });

      if (existingCode) {
        return c.json({ success: false, error: 'Discount code already exists' }, 400);
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: new Date(),
    };

    // Convert numeric fields
    if (result.data.value !== undefined) {
      updateData.value = result.data.value.toString();
    }
    if (result.data.minPurchaseAmount !== undefined) {
      updateData.minPurchaseAmount = result.data.minPurchaseAmount?.toString() || null;
    }
    if (result.data.maxDiscountAmount !== undefined) {
      updateData.maxDiscountAmount = result.data.maxDiscountAmount?.toString() || null;
    }
    if (result.data.startDate !== undefined) {
      updateData.startDate = result.data.startDate ? new Date(result.data.startDate) : null;
    }
    if (result.data.endDate !== undefined) {
      updateData.endDate = result.data.endDate ? new Date(result.data.endDate) : null;
    }

    // Remove productIds from update data (handled separately)
    delete updateData.productIds;

    const [updatedDiscount] = await db.update(discounts)
      .set(updateData)
      .where(eq(discounts.id, id))
      .returning();

    // Update product links if provided
    if (body.productIds !== undefined) {
      // Remove existing links
      await db.delete(productDiscounts).where(eq(productDiscounts.discountId, id));

      // Add new links
      if (body.productIds?.length) {
        for (const productId of body.productIds) {
          await db.insert(productDiscounts).values({
            discountId: id,
            productId,
          });
        }
      }
    }

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingDiscount.storeId!,
      entityType: 'discount',
      entityId: id,
      action: 'update',
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'update',
      entityType: 'discount',
      entityId: id,
      entityName: existingDiscount.name,
      c,
    });

    return c.json({
      success: true,
      data: updatedDiscount,
    });
  } catch (error) {
    console.error('Update discount error:', error);
    return c.json({ success: false, error: 'Failed to update discount' }, 500);
  }
});

// Soft delete discount
discountsRouter.delete('/:id', requirePermission('discounts:delete'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    // Check if discount exists
    const existingDiscount = await db.query.discounts.findFirst({
      where: eq(discounts.id, id),
    });

    if (!existingDiscount) {
      return c.json({ success: false, error: 'Discount not found' }, 404);
    }

    // Non-admins can only delete their store's discounts
    if (user.role !== 'admin' && existingDiscount.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const [deletedDiscount] = await db.update(discounts)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, id))
      .returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingDiscount.storeId!,
      entityType: 'discount',
      entityId: id,
      action: 'delete',
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'delete',
      entityType: 'discount',
      entityId: id,
      entityName: existingDiscount.name,
      c,
    });

    return c.json({
      success: true,
      data: deletedDiscount,
      message: 'Discount deactivated successfully',
    });
  } catch (error) {
    console.error('Delete discount error:', error);
    return c.json({ success: false, error: 'Failed to delete discount' }, 500);
  }
});

// Validate coupon code at checkout
discountsRouter.post('/validate', requirePermission('discounts:read'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { code, cartTotal } = body;

    if (!code) {
      return c.json({ success: false, error: 'Coupon code is required' }, 400);
    }

    const storeId = user.storeId;
    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const now = new Date();

    // Find discount by code
    const discount = await db.query.discounts.findFirst({
      where: and(
        eq(discounts.storeId, storeId),
        eq(discounts.code, code),
        eq(discounts.isActive, true),
        eq(discounts.discountScope, 'cart')
      ),
    });

    if (!discount) {
      return c.json({ success: false, error: 'Invalid coupon code' }, 400);
    }

    // Check date validity
    if (discount.startDate && discount.startDate > now) {
      return c.json({ success: false, error: 'Coupon is not yet active' }, 400);
    }

    if (discount.endDate && discount.endDate < now) {
      return c.json({ success: false, error: 'Coupon has expired' }, 400);
    }

    // Check usage limit
    if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
      return c.json({ success: false, error: 'Coupon usage limit reached' }, 400);
    }

    // Check minimum purchase amount
    if (discount.minPurchaseAmount !== null && cartTotal < parseFloat(discount.minPurchaseAmount)) {
      return c.json({
        success: false,
        error: `Minimum purchase of $${discount.minPurchaseAmount} required`,
      }, 400);
    }

    // Calculate discount amount
    let discountAmount: number;
    if (discount.discountType === 'percentage') {
      discountAmount = cartTotal * (parseFloat(discount.value) / 100);
      // Apply max discount cap if set
      if (discount.maxDiscountAmount !== null) {
        discountAmount = Math.min(discountAmount, parseFloat(discount.maxDiscountAmount));
      }
    } else {
      discountAmount = parseFloat(discount.value);
    }

    // Ensure discount doesn't exceed cart total
    discountAmount = Math.min(discountAmount, cartTotal);

    return c.json({
      success: true,
      data: {
        discount: {
          id: discount.id,
          code: discount.code,
          name: discount.name,
          discountType: discount.discountType,
          value: parseFloat(discount.value),
        },
        discountAmount: Math.round(discountAmount * 100) / 100,
        newTotal: Math.round((cartTotal - discountAmount) * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return c.json({ success: false, error: 'Failed to validate coupon' }, 500);
  }
});

export default discountsRouter;
