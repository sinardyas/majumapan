import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, products, categories, users, stores } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';

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

export default dataRouter;
