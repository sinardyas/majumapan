import { Hono } from 'hono';
import { eq, and, ilike } from 'drizzle-orm';
import { db, users, refreshTokens, deviceBindings, stores, userSessions } from '../db';
import { hashPassword, verifyPassword, verifyPin, hashPin, hashRefreshToken } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getExpiresInSeconds,
} from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createAuditLog } from '../utils/audit';
import { parseQrData } from '../utils/device';
import {
  loginSchema,
  pinLoginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  setPinSchema,
  deviceLoginSchema,
  devicePinLoginSchema,
} from '@pos/shared';

const auth = new Hono();

// Login with email/password
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }
    
    const { email, password } = result.data;
    
    // Find user by email
    const user = await db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.isActive, true)),
    });
    
    if (!user) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }
    
    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    });
    
    const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id);
    
    // Store refresh token hash
    const tokenHash = await Bun.password.hash(refreshToken, { algorithm: 'bcrypt', cost: 10 });
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      entityName: user.name,
      c,
    });

    return c.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: getExpiresInSeconds(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Device binding login - first step to bind device and get users
auth.post('/device-login', async (c) => {
  try {
    const body = await c.req.json();
    const result = deviceLoginSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const { bindingCode, deviceFingerprint } = result.data;

    // Find device binding by code
    const binding = await db.query.deviceBindings.findFirst({
      where: eq(deviceBindings.bindingCode, bindingCode),
    });

    if (!binding) {
      return c.json(
        { success: false, error: 'Invalid binding code. Please check and try again.' },
        400
      );
    }

    // Check if binding is valid
    if (binding.status === 'revoked') {
      return c.json(
        { success: false, error: 'This device binding has been revoked. Please contact admin.' },
        400
      );
    }

    // Check expiration
    if (binding.expiresAt && new Date(binding.expiresAt) < new Date()) {
      return c.json(
        { success: false, error: 'This binding code has expired. Please request a new code from admin.' },
        400
      );
    }

    // Get store info
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, binding.storeId),
    });

    if (!store) {
      return c.json({ success: false, error: 'Store not found' }, 404);
    }

    // Update binding status and device info if this is first binding
    let isNewBinding = false;
    if (binding.status === 'pending') {
      await db.update(deviceBindings)
        .set({
          status: 'active',
          boundAt: new Date(),
          deviceFingerprint: deviceFingerprint || null,
          updatedAt: new Date(),
        })
        .where(eq(deviceBindings.id, binding.id));
      isNewBinding = true;
    }

    // Get users for this store
    const storeUsers = await db.query.users.findMany({
      where: and(eq(users.storeId, binding.storeId), eq(users.isActive, true)),
      columns: {
        id: true,
        name: true,
        role: true,
      },
    });

    // Get last login time for each user (from user_sessions)
    const usersWithLastLogin = await Promise.all(
      storeUsers.map(async (user) => {
        const lastSession = await db.query.userSessions.findFirst({
          where: and(eq(userSessions.userId, user.id), eq(userSessions.isActive, true)),
          orderBy: (userSessions, { desc }) => [desc(userSessions.lastPinAt)],
        });
        return {
          ...user,
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

    return c.json({
      success: true,
      data: {
        device: {
          id: binding.id,
          storeId: binding.storeId,
          deviceName: binding.deviceName,
          storeName: store.name,
          isNewBinding,
        },
        users: usersWithLastLogin,
      },
    });
  } catch (error) {
    console.error('Device login error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PIN login - second step after device binding (device authenticated)
auth.post('/pin-login-device', async (c) => {
  try {
    const body = await c.req.json();
    const result = devicePinLoginSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }

    const { userId, pin } = result.data;

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    if (!user.isActive) {
      return c.json({ success: false, error: 'Your account has been deactivated. Please contact admin.' }, 403);
    }

    if (!user.pin) {
      return c.json({ success: false, error: 'PIN not set. Please contact admin to set your PIN.' }, 400);
    }

    // Check PIN lockout - look for recent failed attempts
    const recentSession = await db.query.userSessions.findFirst({
      where: eq(userSessions.userId, userId),
      orderBy: (userSessions, { desc }) => [desc(userSessions.createdAt)],
    });

    if (recentSession?.pinLockedUntil && new Date(recentSession.pinLockedUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(recentSession.pinLockedUntil).getTime() - Date.now()) / 60000);
      return c.json(
        { success: false, error: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.` },
        403
      );
    }

    // Verify PIN
    const isValidPin = await verifyPin(pin, user.pin);

    if (!isValidPin) {
      // Increment failed attempts
      const failedAttempts = (recentSession?.pinFailedAttempts || 0) + 1;
      const lockUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await db.insert(userSessions).values({
        userId: user.id,
        deviceId: '00000000-0000-0000-0000-000000000000',
        storeId: user.storeId!,
        pinHash: user.pin,
        isActive: false,
        pinFailedAttempts: failedAttempts,
        pinLockedUntil: lockUntil,
        createdAt: new Date(),
      });

      const attemptsLeft = 5 - failedAttempts;
      if (attemptsLeft <= 0) {
        return c.json(
          { success: false, error: 'Account locked due to too many failed attempts. Try again in 15 minutes.' },
          403
        );
      }

      return c.json(
        { success: false, error: `Incorrect PIN. Attempts remaining: ${attemptsLeft}` },
        401
      );
    }

    // PIN correct - create session
    await db.insert(userSessions).values({
      userId: user.id,
      deviceId: '00000000-0000-0000-0000-000000000000', // Placeholder
      storeId: user.storeId!,
      pinHash: user.pin,
      isActive: true,
      pinFailedAttempts: 0,
      lastPinAt: new Date(),
      lastActiveAt: new Date(),
      createdAt: new Date(),
    });

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    });

    const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id);

    // Store refresh token
    const tokenHash = await hashRefreshToken(refreshToken);
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      entityName: user.name,
      c,
    });

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
        },
        accessToken,
        refreshToken,
        expiresIn: getExpiresInSeconds(),
      },
    });
  } catch (error) {
    console.error('Device PIN login error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PIN login for quick access during shift
auth.post('/pin-login', async (c) => {
  try {
    const body = await c.req.json();
    const result = pinLoginSchema.safeParse(body);
    
    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }
    
    const { pin, storeId } = result.data;
    
    // Find users in the store with a PIN set
    const storeUsers = await db.query.users.findMany({
      where: and(eq(users.storeId, storeId), eq(users.isActive, true)),
    });
    
    // Find user with matching PIN
    let matchedUser = null;
    for (const user of storeUsers) {
      if (user.pin) {
        const isValidPin = await verifyPin(pin, user.pin);
        if (isValidPin) {
          matchedUser = user;
          break;
        }
      }
    }
    
    if (!matchedUser) {
      return c.json({ success: false, error: 'Invalid PIN' }, 401);
    }
    
    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: matchedUser.id,
      email: matchedUser.email,
      role: matchedUser.role,
      storeId: matchedUser.storeId,
    });
    
    const { token: refreshToken, expiresAt } = await generateRefreshToken(matchedUser.id);
    
    // Store refresh token hash
    const tokenHash = await Bun.password.hash(refreshToken, { algorithm: 'bcrypt', cost: 10 });
    await db.insert(refreshTokens).values({
      userId: matchedUser.id,
      tokenHash,
      expiresAt,
    });
    
    return c.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: getExpiresInSeconds(),
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          name: matchedUser.name,
          role: matchedUser.role,
          storeId: matchedUser.storeId,
        },
      },
    });
  } catch (error) {
    console.error('PIN login error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Refresh access token
auth.post('/refresh', async (c) => {
  try {
    const body = await c.req.json();
    const result = refreshTokenSchema.safeParse(body);
    
    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }
    
    const { refreshToken } = result.data;
    
    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return c.json({ success: false, error: 'Invalid or expired refresh token' }, 401);
    }
    
    // Find stored refresh token
    const storedTokens = await db.query.refreshTokens.findMany({
      where: eq(refreshTokens.userId, payload.userId),
    });
    
    // Verify token hash matches one of the stored tokens
    let validToken = null;
    for (const token of storedTokens) {
      const isValid = await Bun.password.verify(refreshToken, token.tokenHash);
      if (isValid && token.expiresAt > new Date()) {
        validToken = token;
        break;
      }
    }
    
    if (!validToken) {
      return c.json({ success: false, error: 'Invalid or expired refresh token' }, 401);
    }
    
    // Get user
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, payload.userId), eq(users.isActive, true)),
    });
    
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 401);
    }
    
    // Generate new access token
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    });
    
    return c.json({
      success: true,
      data: {
        accessToken,
        expiresIn: getExpiresInSeconds(),
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Logout
auth.post('/logout', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      action: 'logout',
      entityType: 'user',
      entityId: user.userId,
      entityName: user.email,
      c,
    });

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.userId));

    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get current user profile
auth.get('/me', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userPayload.userId),
    });
    
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Change password
auth.put('/password', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    const body = await c.req.json();
    const result = changePasswordSchema.safeParse(body);
    
    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }
    
    const { currentPassword, newPassword } = result.data;
    
    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userPayload.userId),
    });
    
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return c.json({ success: false, error: 'Current password is incorrect' }, 401);
    }
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update password
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    
    // Invalidate all refresh tokens
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    
    return c.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Set/update PIN
auth.put('/pin', authMiddleware, async (c) => {
  try {
    const userPayload = c.get('user');
    const body = await c.req.json();
    const result = setPinSchema.safeParse(body);
    
    if (!result.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: result.error.flatten() },
        400
      );
    }
    
    const { pin } = result.data;
    
    // Hash PIN
    const pinHash = await hashPin(pin);
    
    // Update PIN
    await db.update(users)
      .set({ pin: pinHash, updatedAt: new Date() })
      .where(eq(users.id, userPayload.userId));
    
    return c.json({ success: true, message: 'PIN updated successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Admin/Manager: Set user's PIN
auth.put('/users/:id/pin', authMiddleware, requireRole('admin', 'manager'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json();
    const { pin } = body;

    if (!pin || !/^\d{6}$/.test(pin)) {
      return c.json({ success: false, error: 'PIN must be exactly 6 digits' }, 400);
    }

    // Find target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only manage users in their store
    if (currentUser.role === 'manager' && targetUser.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Hash and set PIN
    const pinHash = await hashPin(pin);
    await db.update(users)
      .set({ pin: pinHash, updatedAt: new Date() })
      .where(eq(users.id, id));

    return c.json({ success: true, message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set user PIN error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Admin/Manager: Reset (clear) user's PIN
auth.delete('/users/:id/pin', authMiddleware, requireRole('admin', 'manager'), async (c) => {
  try {
    const currentUser = c.get('user');
    const { id } = c.req.param();

    // Find target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Managers can only manage users in their store
    if (currentUser.role === 'manager' && targetUser.storeId !== currentUser.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Clear PIN
    await db.update(users)
      .set({ pin: null, updatedAt: new Date() })
      .where(eq(users.id, id));

    return c.json({ success: true, message: 'PIN reset successfully' });
  } catch (error) {
    console.error('Reset user PIN error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default auth;
