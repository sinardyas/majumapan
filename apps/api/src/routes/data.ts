import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { db, products, categories, users, stores } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { z, ZodError } from 'zod';

const dataRouter = new Hono();

dataRouter.use('*', authMiddleware);

dataRouter.get('/export/products', requireRole('admin'), async (c) => {
  try {
    const storeId = c.req.query('storeId');

    const conditions = storeId ? [eq(products.storeId, storeId)] : [];

    const productList = await db.select({
      id: products.id,
      storeId: products.storeId,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      description: products.description,
      price: products.price,
      costPrice: products.costPrice,
      categoryId: products.categoryId,
      isActive: products.isActive,
    })
      .from(products)
      .leftJoin(stores, eq(stores.id, products.storeId))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const csv = [
      'id,storeId,sku,barcode,name,description,price,costPrice,categoryId,isActive',
      ...productList.map(p => 
        `"${p.id}","${p.storeId}","${p.sku}","${p.barcode || ''}","${p.name}","${p.description || ''}","${p.price}","${p.costPrice || ''}","${p.categoryId || ''}","${p.isActive}"`
      )
    ].join('\n');

    return c.text(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="products-${Date.now()}.csv"`,
    });
  } catch (error) {
    console.error('Export products error:', error);
    return c.json({ success: false, error: 'Failed to export products' }, 500);
  }
});

dataRouter.get('/export/categories', requireRole('admin'), async (c) => {
  try {
    const storeId = c.req.query('storeId');

    const conditions = storeId ? [eq(categories.storeId, storeId)] : [];

    const categoryList = await db.select()
      .from(categories)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const csv = [
      'id,storeId,name,description,isActive',
      ...categoryList.map(cat => 
        `"${cat.id}","${cat.storeId}","${cat.name}","${cat.description || ''}","${cat.isActive}"`
      )
    ].join('\n');

    return c.text(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="categories-${Date.now()}.csv"`,
    });
  } catch (error) {
    console.error('Export categories error:', error);
    return c.json({ success: false, error: 'Failed to export categories' }, 500);
  }
});

dataRouter.get('/export/users', requireRole('admin'), async (c) => {
  try {
    const storeId = c.req.query('storeId');

    const conditions = storeId ? [eq(users.storeId, storeId)] : [];

    const userList = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      storeId: users.storeId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const csv = [
      'id,email,name,role,storeId,isActive,createdAt',
      ...userList.map(u => 
        `"${u.id}","${u.email}","${u.name}","${u.role}","${u.storeId || ''}","${u.isActive}","${u.createdAt.toISOString()}"`
      )
    ].join('\n');

    return c.text(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users-${Date.now()}.csv"`,
    });
  } catch (error) {
    console.error('Export users error:', error);
    return c.json({ success: false, error: 'Failed to export users' }, 500);
  }
});

dataRouter.post('/import/products', requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();
    const items = body.items as Record<string, unknown>[];

    const productSchema = z.object({
      storeId: z.string().uuid(),
      sku: z.string().min(1).max(100),
      barcode: z.string().optional(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      price: z.number().positive(),
      costPrice: z.number().optional(),
      categoryId: z.string().uuid().optional(),
      isActive: z.boolean().default(true),
    });

    const results = {
      success: [] as string[],
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const data = productSchema.parse(items[i]);

        const existing = await db.select({ id: products.id })
          .from(products)
          .where(and(eq(products.storeId, data.storeId), eq(products.sku, data.sku)))
          .limit(1);

        if (existing.length > 0) {
          results.errors.push({ row: i + 1, error: 'Product with this SKU already exists' });
          continue;
        }

        await db.insert(products).values({
          storeId: data.storeId,
          sku: data.sku,
          barcode: data.barcode,
          name: data.name,
          description: data.description,
          price: String(data.price),
          costPrice: data.costPrice ? String(data.costPrice) : null,
          categoryId: data.categoryId,
          isActive: data.isActive,
        });

        results.success.push(`Row ${i + 1}: ${data.name}`);
      } catch (err: any) {
        if (err instanceof ZodError) {
          results.errors.push({ row: i + 1, error: err.issues.map((e: any) => e.message).join(', ') });
        } else {
          results.errors.push({ row: i + 1, error: 'Invalid data' });
        }
      }
    }

    return c.json({
      success: true,
      data: {
        imported: results.success.length,
        errors: results.errors.length,
        details: results,
      },
    });
  } catch (error) {
    console.error('Import products error:', error);
    return c.json({ success: false, error: 'Failed to import products' }, 500);
  }
});

dataRouter.post('/import/categories', requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();
    const items = body.items as Record<string, unknown>[];

    const categorySchema = z.object({
      storeId: z.string().uuid(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
    });

    const results = {
      success: [] as string[],
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const data = categorySchema.parse(items[i]);

        await db.insert(categories).values({
          storeId: data.storeId,
          name: data.name,
          description: data.description,
          isActive: data.isActive,
        });

        results.success.push(`Row ${i + 1}: ${data.name}`);
      } catch (err: any) {
        if (err instanceof ZodError) {
          results.errors.push({ row: i + 1, error: err.issues.map((e: any) => e.message).join(', ') });
        } else {
          results.errors.push({ row: i + 1, error: 'Invalid data' });
        }
      }
    }

    return c.json({
      success: true,
      data: {
        imported: results.success.length,
        errors: results.errors.length,
        details: results,
      },
    });
  } catch (error) {
    console.error('Import categories error:', error);
    return c.json({ success: false, error: 'Failed to import categories' }, 500);
  }
});

dataRouter.post('/import/users', requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();
    const items = body.items as Record<string, unknown>[];

    const userSchema = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(255),
      password: z.string().min(6),
      role: z.enum(['admin', 'manager', 'cashier']),
      storeId: z.string().uuid().optional(),
      pin: z.string().length(6).optional(),
      isActive: z.boolean().default(true),
    });

    const results = {
      success: [] as string[],
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const data = userSchema.parse(items[i]);

        if (data.role !== 'cashier' && !data.storeId) {
          results.errors.push({ row: i + 1, error: 'storeId is required for admin and manager roles' });
          continue;
        }

        const existing = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.email, data.email))
          .limit(1);

        if (existing.length > 0) {
          results.errors.push({ row: i + 1, error: 'User with this email already exists' });
          continue;
        }

        await db.insert(users).values({
          email: data.email,
          name: data.name,
          passwordHash: data.password, 
          role: data.role,
          storeId: data.storeId || null,
          pin: data.pin,
          isActive: data.isActive,
        });

        results.success.push(`Row ${i + 1}: ${data.email}`);
      } catch (err: any) {
        if (err instanceof ZodError) {
          results.errors.push({ row: i + 1, error: err.issues.map((e: any) => e.message).join(', ') });
        } else {
          results.errors.push({ row: i + 1, error: 'Invalid data' });
        }
      }
    }

    return c.json({
      success: true,
      data: {
        imported: results.success.length,
        errors: results.errors.length,
        details: results,
      },
    });
  } catch (error) {
    console.error('Import users error:', error);
    return c.json({ success: false, error: 'Failed to import users' }, 500);
  }
});

export default dataRouter;
