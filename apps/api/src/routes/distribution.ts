import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { distributionService } from '../services/distribution-service';
import { customerService } from '../services/customer-service';
import { db } from '../db';
import { vouchers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(50),
  subject: z.string().optional(),
  message: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  subject: z.string().optional(),
  message: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

const distributeSchema = z.object({
  voucherCode: z.string(),
  channel: z.enum(['whatsapp', 'email', 'print']),
  recipientType: z.enum(['all', 'group', 'individual', 'manual']),
  groupId: z.string().uuid().optional(),
  individualPhone: z.string().optional(),
  manualPhones: z.array(z.string()).optional(),
  templateId: z.string().uuid().optional(),
});

export const distributionRoutes = new Hono();

distributionRoutes.use('*', authMiddleware);

// Template endpoints
distributionRoutes.get('/templates', async (c) => {
  try {
    const templates = await distributionService.getTemplates();
    return c.json({ success: true, data: templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return c.json({ success: false, error: 'Failed to get templates' }, 500);
  }
});

distributionRoutes.get('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const template = await distributionService.getTemplateById(id);
    
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    
    return c.json({ success: true, data: template });
  } catch (error) {
    console.error('Get template error:', error);
    return c.json({ success: false, error: 'Failed to get template' }, 500);
  }
});

distributionRoutes.post('/templates', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createTemplateSchema.parse(body);

    const template = await distributionService.createTemplate(parsed);
    return c.json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Create template error:', error);
    return c.json({ success: false, error: 'Failed to create template' }, 500);
  }
});

distributionRoutes.put('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateTemplateSchema.parse(body);

    const template = await distributionService.updateTemplate(id, parsed);
    return c.json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Update template error:', error);
    return c.json({ success: false, error: 'Failed to update template' }, 500);
  }
});

distributionRoutes.delete('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await distributionService.deleteTemplate(id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return c.json({ success: false, error: 'Failed to delete template' }, 500);
  }
});

// Distribution endpoint
distributionRoutes.post('/distribute', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = distributeSchema.parse(body);

    // Get voucher by code
    const normalizedCode = parsed.voucherCode.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    const voucherList = await db.select()
      .from(vouchers)
      .where(eq(vouchers.code, normalizedCode))
      .limit(1);
    
    const voucher = voucherList[0];
    if (!voucher) {
      return c.json({ success: false, error: 'Voucher not found' }, 404);
    }

    // Get template
    let template;
    if (parsed.templateId) {
      template = await distributionService.getTemplateById(parsed.templateId);
    } else {
      template = await distributionService.getDefaultTemplate();
    }

    if (!template) {
      return c.json({ success: false, error: 'No template available' }, 400);
    }

    // Get recipients
    let recipients: Array<{ phone?: string; email?: string; name?: string }> = [];

    switch (parsed.recipientType) {
      case 'all': {
        const customers = await customerService.list({ limit: 10000 });
        recipients = customers.map(c => ({
          phone: c.phone,
          email: c.email || undefined,
          name: c.name || undefined,
        }));
        break;
      }
      case 'group': {
        if (!parsed.groupId) {
          return c.json({ success: false, error: 'Group ID required' }, 400);
        }
        const customers = await customerService.list({ groupId: parsed.groupId, limit: 10000 });
        recipients = customers.map(c => ({
          phone: c.phone,
          email: c.email || undefined,
          name: c.name || undefined,
        }));
        break;
      }
      case 'individual': {
        if (!parsed.individualPhone) {
          return c.json({ success: false, error: 'Phone number required' }, 400);
        }
        const customer = await customerService.getByPhone(parsed.individualPhone);
        if (!customer) {
          return c.json({ success: false, error: 'Customer not found' }, 404);
        }
        recipients = [{
          phone: customer.phone,
          email: customer.email || undefined,
          name: customer.name || undefined,
        }];
        break;
      }
      case 'manual': {
        if (!parsed.manualPhones || parsed.manualPhones.length === 0) {
          return c.json({ success: false, error: 'Phone numbers required' }, 400);
        }
        recipients = parsed.manualPhones.map(phone => ({
          phone,
          name: undefined,
        }));
        break;
      }
    }

    if (recipients.length === 0) {
      return c.json({ success: false, error: 'No recipients found' }, 400);
    }

    // Generate links
    const links = await distributionService.generateDistributionLinks(
      recipients,
      template,
      voucher
    );

    return c.json({
      success: true,
      data: {
        recipientCount: recipients.length,
        links,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Distribute error:', error);
    return c.json({ success: false, error: 'Failed to distribute' }, 500);
  }
});

// History endpoint
distributionRoutes.get('/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const history = await distributionService.getDistributionHistory(limit);
    return c.json({ success: true, data: history });
  } catch (error) {
    console.error('Get history error:', error);
    return c.json({ success: false, error: 'Failed to get history' }, 500);
  }
});

// Preview template
distributionRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.json();
    const { templateId, voucherCode, customerName } = body;

    const template = await distributionService.getTemplateById(templateId);
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const normalizedCode = voucherCode.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    const voucherList = await db.select()
      .from(vouchers)
      .where(eq(vouchers.code, normalizedCode))
      .limit(1);
    
    const voucher = voucherList[0];
    if (!voucher) {
      return c.json({ success: false, error: 'Voucher not found' }, 404);
    }

    const preview = distributionService.renderTemplate(
      template.message,
      {
        name: customerName || 'Customer',
        code: voucher.code,
        discount: distributionService.formatDiscount(voucher),
        expires: voucher.expiresAt 
          ? new Date(voucher.expiresAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : 'No expiration',
        store_name: 'Majumapan',
      }
    );

    return c.json({ success: true, data: { preview } });
  } catch (error) {
    console.error('Preview error:', error);
    return c.json({ success: false, error: 'Failed to preview' }, 500);
  }
});
