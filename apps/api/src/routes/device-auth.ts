import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, deviceBindings, stores, users, userSessions } from '../db';
import { authMiddleware } from '../middleware/auth';
import { verifyPin } from '../utils/password';
import { generateAccessToken, getExpiresInSeconds } from '../utils/jwt';
import { devicePinLoginSchema } from '@pos/shared';

const deviceAuth = new Hono();

// All routes require device authentication (device binding)
deviceAuth.use('*', authMiddleware);

// Get current device info
deviceAuth.get('/devices/me', async (c) => {
  try {
    const user = c.get('user');
    
    if (!user.storeId) {
      return c.json({ success: false, error: 'User not associated with a store' }, 400);
    }
    
    // Find active device binding for this store
    const binding = await db.query.deviceBindings.findFirst({
      where: eq(deviceBindings.storeId, user.storeId),
    });

    if (!binding) {
      return c.json({ success: false, error: 'No device binding found' }, 404);
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, binding.storeId),
    });

    return c.json({
      success: true,
      data: {
        id: binding.id,
        storeId: binding.storeId,
        storeName: store?.name,
        deviceName: binding.deviceName,
        status: binding.status,
        boundAt: binding.boundAt,
      },
    });
  } catch (error) {
    console.error('Get device error:', error);
    return c.json({ success: false, error: 'Failed to fetch device' }, 500);
  }
});

// List users for the device's store
deviceAuth.get('/devices/users', async (c) => {
  try {
    const user = c.get('user');

    if (!user.storeId) {
      return c.json({ success: false, error: 'User not associated with a store' }, 400);
    }

    const storeUsers = await db.query.users.findMany({
      where: eq(users.storeId, user.storeId),
      columns: {
        id: true,
        name: true,
        role: true,
      },
    });

    // Get last login time for each user
    const usersWithLastLogin = await Promise.all(
      storeUsers.map(async (u) => {
        const lastSession = await db.query.userSessions.findFirst({
          where: eq(userSessions.userId, u.id),
          orderBy: (userSessions, { desc }) => [desc(userSessions.lastPinAt)],
        });
        return {
          ...u,
          lastLoginAt: lastSession?.lastPinAt?.toISOString() || null,
        };
      })
    );

    // Sort by role (manager first), then by name
    usersWithLastLogin.sort((a, b) => {
      if (a.role === 'manager' && b.role !== 'manager') return -1;
      if (a.role !== 'manager' && b.role === 'manager') return 1;
      return a.name.localeCompare(b.name);
    });

    return c.json({ success: true, data: usersWithLastLogin });
  } catch (error) {
    console.error('List device users error:', error);
    return c.json({ success: false, error: 'Failed to fetch users' }, 500);
  }
});

// Switch user - end current session and start new one
deviceAuth.post('/auth/switch-user', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = devicePinLoginSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const { userId, pin } = result.data;

    // Find target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    if (!targetUser.isActive) {
      return c.json({ success: false, error: 'User account is inactive' }, 403);
    }

    if (!targetUser.pin) {
      return c.json({ success: false, error: 'PIN not set for this user' }, 400);
    }

    // Verify PIN
    const isValidPin = await verifyPin(pin, targetUser.pin);
    if (!isValidPin) {
      return c.json({ success: false, error: 'Invalid PIN' }, 401);
    }

    // Deactivate current session
    await db.update(userSessions)
      .set({ isActive: false, endedAt: new Date() })
      .where(and(eq(userSessions.userId, user.userId), eq(userSessions.isActive, true)));

    // Create new session
    await db.insert(userSessions).values({
      userId: targetUser.id,
      deviceId: '00000000-0000-0000-0000-000000000000', // Placeholder
      storeId: targetUser.storeId!,
      pinHash: targetUser.pin,
      isActive: true,
      pinFailedAttempts: 0,
      lastPinAt: new Date(),
      lastActiveAt: new Date(),
      createdAt: new Date(),
    });

    // Generate new tokens
    const accessToken = await generateAccessToken({
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      storeId: targetUser.storeId,
    });

    return c.json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
          storeId: targetUser.storeId,
        },
        accessToken,
        expiresIn: getExpiresInSeconds(),
      },
    });
  } catch (error) {
    console.error('Switch user error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default deviceAuth;
