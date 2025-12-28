import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, categories, syncLog } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createCategorySchema, updateCategorySchema } from '@pos/shared';

const categoriesRouter = new Hono();

// All routes require authentication
categoriesRouter.use('*', authMiddleware);

// List categories
categoriesRouter.get('/', requirePermission('categories:read'), async (c) => {
  try {
    const user = c.get('user');

//// asdasdadasdaasdada
    const storeId = c.req.query('storeId') || user.storeId;
    const includeInactive = c.req.query('includeInactive') === 'true';

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Non-admins can only access their store's categories
    if (user.role !== 'admin' && storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const whereClause = includeInactive
      ? eq(categories.storeId, storeId)
      : and(eq(categories.storeId, storeId), eq(categories.isActive, true));

    const allCategories = await db.query.categories.findMany({
      where: whereClause,
      orderBy: (categories, { asc }) => [asc(categories.name)],
    });

    return c.json({
      success: true,
      data: allCategories,
    });
  } catch (error) {
    console.error('List categories error:', error);
    return c.json({ success: false, error: 'Failed to fetch categories' }, 500);
  }
});

// Get category by ID
categoriesRouter.get('/:id', requirePermission('categories:read'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const category = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!category) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    // Non-admins can only access their store's categories
    if (user.role !== 'admin' && category.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    return c.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category error:', error);
    return c.json({ success: false, error: 'Failed to fetch category' }, 500);
  }
});

// Create category
categoriesRouter.post('/', requirePermission('categories:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = createCategorySchema.safeParse(body);

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

    const [newCategory] = await db.insert(categories).values({
      storeId,
      name: result.data.name,
      description: result.data.description || null,
    }).returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId,
      entityType: 'category',
      entityId: newCategory.id,
      action: 'create',
    });

    return c.json({
      success: true,
      data: newCategory,
    }, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return c.json({ success: false, error: 'Failed to create category' }, 500);
  }
});

// Update category
categoriesRouter.put('/:id', requirePermission('categories:update'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const result = updateCategorySchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Check if category exists
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!existingCategory) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    // Non-admins can only update their store's categories
    if (user.role !== 'admin' && existingCategory.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const [updatedCategory] = await db.update(categories)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingCategory.storeId,
      entityType: 'category',
      entityId: id,
      action: 'update',
    });

    return c.json({
      success: true,
      data: updatedCategory,
    });
  } catch (error) {
    console.error('Update category error:', error);
    return c.json({ success: false, error: 'Failed to update category' }, 500);
  }
});

// Soft delete category
categoriesRouter.delete('/:id', requirePermission('categories:delete'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    // Check if category exists
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!existingCategory) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    // Non-admins can only delete their store's categories
    if (user.role !== 'admin' && existingCategory.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const [deletedCategory] = await db.update(categories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingCategory.storeId,
      entityType: 'category',
      entityId: id,
      action: 'delete',
    });

    return c.json({
      success: true,
      data: deletedCategory,
      message: 'Category deactivated successfully',
    });
  } catch (error) {
    console.error('Delete category error:', error);
    return c.json({ success: false, error: 'Failed to delete category' }, 500);
  }
});

export default categoriesRouter;
