import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, users } from '../db';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../utils/audit';
import { createUserSchema, updateUserSchema } from '@pos/shared';
import { hashPassword, hashPin } from '../utils/password';

const usersRouter = new Hono();

// All routes require authentication
usersRouter.use('*', authMiddleware);

// List users
usersRouter.get('/', requirePermission('users:read'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId');

    let whereClause;
    
    // Admin can see all users, managers can only see users from their store
    if (user.role === 'admin') {
      whereClause = storeId ? eq(users.storeId, storeId) : undefined;
    } else {
      // Manager can only see users from their store
      whereClause = user.storeId ? eq(users.storeId, user.storeId) : undefined;
    }

    const allUsers = await db.query.users.findMany({
      where: whereClause,
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      columns: {
        id: true,
        storeId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return c.json({
      success: true,
      data: allUsers,
    });
  } catch (error) {
    console.error('List users error:', error);
    return c.json({ success: false, error: 'Failed to fetch users' }, 500);
  }
});

// Get user by ID
usersRouter.get('/:id', requirePermission('users:read'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        storeId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only view users from their store
    if (currentUser.role === 'manager' && user.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    return c.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ success: false, error: 'Failed to fetch user' }, 500);
  }
});

// Create user
usersRouter.post('/', requirePermission('users:create'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json();
    const result = createUserSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const { email, password, name, role, storeId, pin } = result.data;

    // Only admins can create admin users
    if (role === 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'Only admins can create admin users' }, 403);
    }

    // Managers can only create users for their own store
    if (currentUser.role === 'manager') {
      if (storeId && storeId !== currentUser.storeId) {
        return c.json({ success: false, error: 'Cannot create users for other stores' }, 403);
      }
    }

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return c.json({ success: false, error: 'Email already in use' }, 400);
    }

    // Hash password and PIN
    const passwordHash = await hashPassword(password);
    const pinHash = pin ? await hashPin(pin) : null;

    // Determine store ID
    const assignedStoreId = currentUser.role === 'manager' ? currentUser.storeId : (storeId || null);

    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      name,
      role,
      storeId: assignedStoreId,
      pin: pinHash,
    }).returning({
      id: users.id,
      storeId: users.storeId,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

    await createAuditLog({
      userId: currentUser.userId,
      userEmail: currentUser.email,
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      entityName: newUser.name,
      c,
    });

    return c.json({
      success: true,
      data: newUser,
    }, 201);
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({ success: false, error: 'Failed to create user' }, 500);
  }
});

// Update user
usersRouter.put('/:id', requirePermission('users:update'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only update users from their store
    if (currentUser.role === 'manager' && existingUser.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Cannot update users from other stores' }, 403);
    }

    // Only admins can change role to admin or update admin users
    if (existingUser.role === 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'Cannot update admin users' }, 403);
    }

    if (result.data.role === 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'Only admins can assign admin role' }, 403);
    }

    // Check if email is being changed and if it's already in use
    if (result.data.email && result.data.email !== existingUser.email) {
      const emailExists = await db.query.users.findFirst({
        where: eq(users.email, result.data.email),
      });

      if (emailExists) {
        return c.json({ success: false, error: 'Email already in use' }, 400);
      }
    }

    const [updatedUser] = await db.update(users)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        storeId: users.storeId,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    await createAuditLog({
      userId: currentUser.userId,
      userEmail: currentUser.email,
      action: 'update',
      entityType: 'user',
      entityId: id,
      entityName: updatedUser.name,
      c,
    });

    return c.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    return c.json({ success: false, error: 'Failed to update user' }, 500);
  }
});

// Soft delete user
usersRouter.delete('/:id', requirePermission('users:delete'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();

    // Cannot delete yourself
    if (id === currentUser.userId) {
      return c.json({ success: false, error: 'Cannot delete your own account' }, 400);
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only delete users from their store
    if (currentUser.role === 'manager' && existingUser.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Cannot delete users from other stores' }, 403);
    }

    // Only admins can delete admin users
    if (existingUser.role === 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'Cannot delete admin users' }, 403);
    }

    const [deletedUser] = await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
      });

    await createAuditLog({
      userId: currentUser.userId,
      userEmail: currentUser.email,
      action: 'delete',
      entityType: 'user',
      entityId: id,
      entityName: existingUser.name,
      c,
    });

    return c.json({
      success: true,
      data: deletedUser,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ success: false, error: 'Failed to delete user' }, 500);
  }
});

// Change user password (by admin/manager)
usersRouter.put('/:id/password', requirePermission('users:update'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();

    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400);
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only update users from their store
    if (currentUser.role === 'manager' && existingUser.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Cannot update users from other stores' }, 403);
    }

    // Only admins can change admin passwords
    if (existingUser.role === 'admin' && currentUser.role !== 'admin') {
      return c.json({ success: false, error: 'Cannot update admin passwords' }, 403);
    }

    const passwordHash = await hashPassword(newPassword);

    await db.update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return c.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Update password error:', error);
    return c.json({ success: false, error: 'Failed to update password' }, 500);
  }
});

// Set/update user PIN (by admin/manager)
usersRouter.put('/:id/pin', requirePermission('users:update'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();

    const { pin } = body;

    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
      return c.json({ success: false, error: 'PIN must be exactly 6 digits' }, 400);
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only update users from their store
    if (currentUser.role === 'manager' && existingUser.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Cannot update users from other stores' }, 403);
    }

    const pinHash = await hashPin(pin);

    await db.update(users)
      .set({
        pin: pinHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return c.json({
      success: true,
      message: 'PIN updated successfully',
    });
  } catch (error) {
    console.error('Update PIN error:', error);
    return c.json({ success: false, error: 'Failed to update PIN' }, 500);
  }
});

export default usersRouter;
