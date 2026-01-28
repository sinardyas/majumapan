import { Hono } from 'hono';
import { customerService } from '../services/customer-service';
import { z } from 'zod';

const customerSchema = z.object({
  phone: z.string().min(10).max(20),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const updateCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  customerGroupId: z.string().optional(),
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(50),
  minSpend: z.number().min(0).optional(),
  minVisits: z.number().min(0).optional(),
  priority: z.number().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  minSpend: z.number().min(0).optional(),
  minVisits: z.number().min(0).optional(),
  priority: z.number().optional(),
});

export const customerRoutes = new Hono();

// Customer CRUD
customerRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = customerSchema.parse(body);

    // Check if customer already exists
    const existing = await customerService.getByPhone(parsed.phone);
    if (existing) {
      return c.json({
        success: false,
        error: 'Customer with this phone number already exists',
      }, 400);
    }

    const customer = await customerService.create(parsed);
    return c.json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Create customer error:', error);
    return c.json({ success: false, error: 'Failed to create customer' }, 500);
  }
});

customerRoutes.get('/', async (c) => {
  try {
    const search = c.req.query('search');
    const groupId = c.req.query('groupId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const customers = await customerService.list({ search, groupId, limit, offset });
    const total = await customerService.count({ groupId });

    return c.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('List customers error:', error);
    return c.json({ success: false, error: 'Failed to list customers' }, 500);
  }
});

customerRoutes.get('/count', async (c) => {
  try {
    const groupId = c.req.query('groupId');
    const count = await customerService.count({ groupId });
    return c.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Count customers error:', error);
    return c.json({ success: false, error: 'Failed to count customers' }, 500);
  }
});

customerRoutes.get('/phone/:phone', async (c) => {
  try {
    const phone = c.req.param('phone');
    const customer = await customerService.getByPhone(phone);
    
    if (!customer) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }
    
    return c.json({ success: true, data: customer });
  } catch (error) {
    console.error('Get customer by phone error:', error);
    return c.json({ success: false, error: 'Failed to get customer' }, 500);
  }
});

customerRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const customer = await customerService.getById(id);
    
    if (!customer) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }
    
    return c.json({ success: true, data: customer });
  } catch (error) {
    console.error('Get customer error:', error);
    return c.json({ success: false, error: 'Failed to get customer' }, 500);
  }
});

customerRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateCustomerSchema.parse(body);

    const customer = await customerService.update(id, parsed);
    return c.json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Update customer error:', error);
    return c.json({ success: false, error: 'Failed to update customer' }, 500);
  }
});

customerRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await customerService.delete(id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    return c.json({ success: false, error: 'Failed to delete customer' }, 500);
  }
});

customerRoutes.get('/:id/vouchers', async (c) => {
  try {
    const id = c.req.param('id');
    const vouchers = await customerService.getCustomerVouchers(id);
    
    if (!vouchers) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }
    
    return c.json({ success: true, data: vouchers });
  } catch (error) {
    console.error('Get customer vouchers error:', error);
    return c.json({ success: false, error: 'Failed to get vouchers' }, 500);
  }
});

// Customer Groups
customerRoutes.get('/groups/list', async (c) => {
  try {
    const groups = await customerService.getGroups();
    return c.json({ success: true, data: groups });
  } catch (error) {
    console.error('List groups error:', error);
    return c.json({ success: false, error: 'Failed to list groups' }, 500);
  }
});

customerRoutes.post('/groups', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createGroupSchema.parse(body);

    const group = await customerService.createGroup(parsed);
    return c.json({ success: true, data: group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Create group error:', error);
    return c.json({ success: false, error: 'Failed to create group' }, 500);
  }
});

customerRoutes.put('/groups/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateGroupSchema.parse(body);

    const group = await customerService.updateGroup(id, parsed);
    return c.json({ success: true, data: group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('Update group error:', error);
    return c.json({ success: false, error: 'Failed to update group' }, 500);
  }
});

customerRoutes.delete('/groups/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await customerService.deleteGroup(id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    if (error instanceof Error && error.message.includes('assigned customers')) {
      return c.json({ success: false, error: error.message }, 400);
    }
    return c.json({ success: false, error: 'Failed to delete group' }, 500);
  }
});
