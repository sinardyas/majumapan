import { Hono } from 'hono';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { db, products, stock, syncLog, productDiscounts, discounts } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../utils/audit';
import { createProductSchema, updateProductSchema, paginationSchema } from '@pos/shared';

const productsRouter = new Hono();

function convertDateTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === '') return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date;
}

// All routes require authentication
productsRouter.use('*', authMiddleware);

// List products with pagination
productsRouter.get('/', requirePermission('products:read'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId') || user.storeId;
    const categoryId = c.req.query('categoryId');
    const search = c.req.query('search');
    const includeInactive = c.req.query('includeInactive') === 'true';

    // Parse pagination
    const paginationResult = paginationSchema.safeParse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
    });

    const { page, limit } = paginationResult.success 
      ? paginationResult.data 
      : { page: 1, limit: 20 };

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    // Non-admins can only access their store's products
    if (user.role !== 'admin' && storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Build where conditions
    const conditions = [eq(products.storeId, storeId)];
    
    if (!includeInactive) {
      conditions.push(eq(products.isActive, true));
    }

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.sku, `%${search}%`),
          like(products.barcode, `%${search}%`)
        )!
      );
    }

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions));
    
    const total = Number(countResult[0].count);

    // Get products with pagination
    const offset = (page - 1) * limit;
    
    const allProducts = await db.query.products.findMany({
      where: and(...conditions),
      orderBy: (products, { asc }) => [asc(products.name)],
      limit,
      offset,
    });

    return c.json({
      success: true,
      data: allProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List products error:', error);
    return c.json({ success: false, error: 'Failed to fetch products' }, 500);
  }
});

// Get product by ID
productsRouter.get('/:id', requirePermission('products:read'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only access their store's products
    if (user.role !== 'admin' && product.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get stock info
    const stockInfo = await db.query.stock.findFirst({
      where: and(eq(stock.productId, id), eq(stock.storeId, product.storeId)),
    });

    return c.json({
      success: true,
      data: {
        ...product,
        stock: stockInfo || { quantity: 0, lowStockThreshold: 10 },
      },
    });
  } catch (error) {
    console.error('Get product error:', error);
    return c.json({ success: false, error: 'Failed to fetch product' }, 500);
  }
});

// Get product by barcode
productsRouter.get('/barcode/:code', requirePermission('products:read'), async (c) => {
  try {
    const user = c.get('user');
    const { code } = c.req.param();
    const storeId = c.req.query('storeId') || user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.barcode, code),
        eq(products.storeId, storeId),
        eq(products.isActive, true)
      ),
    });

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Get stock info
    const stockInfo = await db.query.stock.findFirst({
      where: and(eq(stock.productId, product.id), eq(stock.storeId, storeId)),
    });

    return c.json({
      success: true,
      data: {
        ...product,
        stock: stockInfo || { quantity: 0, lowStockThreshold: 10 },
      },
    });
  } catch (error) {
    console.error('Get product by barcode error:', error);
    return c.json({ success: false, error: 'Failed to fetch product' }, 500);
  }
});

// Create product
productsRouter.post('/', requirePermission('products:create'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = createProductSchema.safeParse(body);

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

    // Check for duplicate SKU
    const existingSku = await db.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.sku, result.data.sku)),
    });

    if (existingSku) {
      return c.json({ success: false, error: 'SKU already exists in this store' }, 400);
    }

    // Check for duplicate barcode if provided
    if (result.data.barcode) {
      const existingBarcode = await db.query.products.findFirst({
        where: and(eq(products.storeId, storeId), eq(products.barcode, result.data.barcode)),
      });

      if (existingBarcode) {
        return c.json({ success: false, error: 'Barcode already exists in this store' }, 400);
      }
    }

    const productValues = {
      storeId,
      categoryId: result.data.categoryId || null,
      sku: result.data.sku,
      barcode: result.data.barcode || null,
      name: result.data.name,
      description: result.data.description || null,
      price: result.data.price.toString(),
      costPrice: result.data.costPrice?.toString() || null,
      imageUrl: result.data.imageUrl || null,
      imageBase64: result.data.imageBase64 || null,
      hasPromo: result.data.hasPromo ?? false,
      promoType: result.data.promoType ?? null,
      promoValue: result.data.promoValue?.toString() ?? null,
      promoMinQty: result.data.promoMinQty ?? 1,
      promoStartDate: convertDateTime(result.data.promoStartDate),
      promoEndDate: convertDateTime(result.data.promoEndDate),
    };

    const [newProduct] = await db.insert(products).values(productValues).returning();

    // Create initial stock record
    const initialQuantity = body.initialStock || 0;
    await db.insert(stock).values({
      storeId,
      productId: newProduct.id,
      quantity: initialQuantity,
      lowStockThreshold: body.lowStockThreshold || 10,
    });

    // Log sync event
    await db.insert(syncLog).values({
      storeId,
      entityType: 'product',
      entityId: newProduct.id,
      action: 'create',
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'create',
      entityType: 'product',
      entityId: newProduct.id,
      entityName: newProduct.name,
      c,
    });

    return c.json({
      success: true,
      data: newProduct,
    }, 201);
  } catch (error) {
    console.error('Create product error:', error);
    return c.json({ success: false, error: 'Failed to create product' }, 500);
  }
});

// Update product
productsRouter.put('/:id', requirePermission('products:update'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const result = updateProductSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Check if product exists
    const existingProduct = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existingProduct) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only update their store's products
    if (user.role !== 'admin' && existingProduct.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Check for duplicate SKU if being changed
    if (result.data.sku && result.data.sku !== existingProduct.sku) {
      const existingSku = await db.query.products.findFirst({
        where: and(
          eq(products.storeId, existingProduct.storeId),
          eq(products.sku, result.data.sku)
        ),
      });

      if (existingSku) {
        return c.json({ success: false, error: 'SKU already exists in this store' }, 400);
      }
    }

    // Check for duplicate barcode if being changed
    if (result.data.barcode && result.data.barcode !== existingProduct.barcode) {
      const existingBarcode = await db.query.products.findFirst({
        where: and(
          eq(products.storeId, existingProduct.storeId),
          eq(products.barcode, result.data.barcode)
        ),
      });

      if (existingBarcode) {
        return c.json({ success: false, error: 'Barcode already exists in this store' }, 400);
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: new Date(),
    };

    // Convert numeric fields to strings for decimal columns
    if (result.data.price !== undefined) {
      updateData.price = result.data.price.toString();
    }
    if (result.data.costPrice !== undefined) {
      updateData.costPrice = result.data.costPrice.toString();
    }
    if (result.data.promoValue !== undefined) {
      updateData.promoValue = result.data.promoValue?.toString() ?? null;
    }

    // Convert datetime-local format strings to Date objects for timestamp columns
    if (result.data.promoStartDate !== undefined) {
      updateData.promoStartDate = convertDateTime(result.data.promoStartDate);
    }
    if (result.data.promoEndDate !== undefined) {
      updateData.promoEndDate = convertDateTime(result.data.promoEndDate);
    }

    const [updatedProduct] = await db.update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingProduct.storeId,
      entityType: 'product',
      entityId: id,
      action: 'update',
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'update',
      entityType: 'product',
      entityId: id,
      entityName: existingProduct.name,
      c,
    });

    return c.json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ success: false, error: 'Failed to update product' }, 500);
  }
});

// Soft delete product
productsRouter.delete('/:id', requirePermission('products:delete'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    // Check if product exists
    const existingProduct = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existingProduct) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only delete their store's products
    if (user.role !== 'admin' && existingProduct.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const [deletedProduct] = await db.update(products)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingProduct.storeId,
      entityType: 'product',
      entityId: id,
      action: 'delete',
    });

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'delete',
      entityType: 'product',
      entityId: id,
      entityName: existingProduct.name,
      c,
    });

    return c.json({
      success: true,
      data: deletedProduct,
      message: 'Product deactivated successfully',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({ success: false, error: 'Failed to delete product' }, 500);
  }
});

// Upload product image (base64)
productsRouter.post('/:id/image', requirePermission('products:update'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();

    const { imageBase64, imageUrl } = body;

    if (!imageBase64 && !imageUrl) {
      return c.json({ success: false, error: 'Image data or URL is required' }, 400);
    }

    // Check if product exists
    const existingProduct = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existingProduct) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only update their store's products
    if (user.role !== 'admin' && existingProduct.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const [updatedProduct] = await db.update(products)
      .set({
        imageBase64: imageBase64 || null,
        imageUrl: imageUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    // Log sync event
    await db.insert(syncLog).values({
      storeId: existingProduct.storeId,
      entityType: 'product',
      entityId: id,
      action: 'update',
    });

    return c.json({
      success: true,
      data: updatedProduct,
      message: 'Product image updated successfully',
    });
  } catch (error) {
    console.error('Upload product image error:', error);
    return c.json({ success: false, error: 'Failed to update product image' }, 500);
  }
});

// Get active discounts for a product
productsRouter.get('/:id/discounts', requirePermission('products:read'), async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Non-admins can only access their store's products
    if (user.role !== 'admin' && product.storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    const now = new Date();

    // Get product discounts
    const productDiscountsList = await db
      .select({
        discount: discounts,
      })
      .from(productDiscounts)
      .innerJoin(discounts, eq(productDiscounts.discountId, discounts.id))
      .where(
        and(
          eq(productDiscounts.productId, id),
          eq(discounts.isActive, true),
          eq(discounts.discountScope, 'product'),
          or(
            sql`${discounts.startDate} IS NULL`,
            sql`${discounts.startDate} <= ${now}`
          ),
          or(
            sql`${discounts.endDate} IS NULL`,
            sql`${discounts.endDate} >= ${now}`
          )
        )
      );

    return c.json({
      success: true,
      data: productDiscountsList.map(pd => pd.discount),
    });
  } catch (error) {
    console.error('Get product discounts error:', error);
    return c.json({ success: false, error: 'Failed to fetch product discounts' }, 500);
  }
});

export default productsRouter;
