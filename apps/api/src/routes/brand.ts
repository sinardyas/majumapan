import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, companies, stores, users, appSettings } from '../db';
import { hashPassword } from '../utils/password';

const brand = new Hono();

// POST /brand/setup - Initial brand setup (first run only)
brand.post('/setup', async (c) => {
  try {
    const body = await c.req.json();

    // Validate required fields
    const { companyName, companyEmail, adminName, adminEmail, adminPassword } = body;

    if (!companyName || companyName.length < 2 || companyName.length > 255) {
      return c.json(
        { success: false, error: 'Company name must be 2-255 characters' },
        400
      );
    }

    if (!companyEmail || !companyEmail.includes('@')) {
      return c.json(
        { success: false, error: 'Invalid company email' },
        400
      );
    }

    if (!adminName || adminName.length < 2 || adminName.length > 255) {
      return c.json(
        { success: false, error: 'Admin name must be 2-255 characters' },
        400
      );
    }

    if (!adminEmail || !adminEmail.includes('@')) {
      return c.json(
        { success: false, error: 'Invalid admin email' },
        400
      );
    }

    if (!adminPassword || adminPassword.length < 8) {
      return c.json(
        { success: false, error: 'Admin password must be at least 8 characters' },
        400
      );
    }

    // Check if brand already exists
    const existingCompany = await db.query.companies.findFirst();
    if (existingCompany) {
      return c.json(
        { success: false, error: 'BRAND_ALREADY_EXISTS', message: 'Brand has already been configured' },
        400
      );
    }

    // Check if admin email already exists
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });
    if (existingAdmin) {
      return c.json(
        { success: false, error: 'Email already exists' },
        400
      );
    }

    // Create company
    const [company] = await db.insert(companies).values({
      name: companyName,
      email: companyEmail,
      isActive: true,
    }).returning();

    // Create admin user
    const adminPasswordHash = await hashPassword(adminPassword);
    const [adminUser] = await db.insert(users).values({
      companyId: company.id,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: adminName,
      role: 'admin' as any,
      pin: '000000', // Default PIN for admin
      isActive: true,
    }).returning();

    // Set brand email in app settings
    await db.insert(appSettings).values({
      key: 'brand_email',
      value: companyEmail,
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: companyEmail, updatedAt: new Date() },
    });

    return c.json({
      success: true,
      data: {
        companyId: company.id,
        adminUserId: adminUser.id,
        message: 'Brand setup complete. Please login.',
      },
    });
  } catch (error) {
    console.error('Brand setup error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /brand - Get brand details (admin only)
brand.get('/', async (c) => {
  try {
    const company = await db.query.companies.findFirst();

    if (!company) {
      return c.json(
        { success: false, error: 'BRAND_NOT_FOUND', message: 'Brand not configured' },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        id: company.id,
        name: company.name,
        email: company.email,
        logoUrl: company.logoUrl,
        isActive: company.isActive,
        createdAt: company.createdAt,
      },
    });
  } catch (error) {
    console.error('Get brand error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /brand - Update brand details (admin only)
brand.put('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name, email } = body;

    const company = await db.query.companies.findFirst();
    if (!company) {
      return c.json(
        { success: false, error: 'BRAND_NOT_FOUND', message: 'Brand not configured' },
        404
      );
    }

    // Validate fields if provided
    if (name !== undefined && (name.length < 2 || name.length > 255)) {
      return c.json(
        { success: false, error: 'Company name must be 2-255 characters' },
        400
      );
    }

    if (email !== undefined && !email.includes('@')) {
      return c.json(
        { success: false, error: 'Invalid company email' },
        400
      );
    }

    // Build update object
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) {
      updateData.email = email;
      // Also update brand_email setting
      await db.insert(appSettings).values({
        key: 'brand_email',
        value: email,
      }).onConflictDoUpdate({
        target: appSettings.key,
        set: { value: email, updatedAt: new Date() },
      });
    }
    updateData.updatedAt = new Date();

    const [updatedCompany] = await db.update(companies)
      .set(updateData)
      .where(eq(companies.id, company.id))
      .returning();

    return c.json({
      success: true,
      data: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        email: updatedCompany.email,
        logoUrl: updatedCompany.logoUrl,
        isActive: updatedCompany.isActive,
        updatedAt: updatedCompany.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update brand error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /brand/check - Check if brand is configured (public)
brand.get('/check', async (c) => {
  try {
    const company = await db.query.companies.findFirst();

    return c.json({
      success: true,
      data: {
        isConfigured: !!company,
      },
    });
  } catch (error) {
    console.error('Check brand error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default brand;
