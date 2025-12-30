import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, users, refreshTokens } from '../db';
import { hashPassword, verifyPassword, verifyPin, hashPin } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getExpiresInSeconds,
} from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import {
  loginSchema,
  pinLoginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  setPinSchema,
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

export default auth;
