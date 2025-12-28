import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../utils/jwt';
import type { JwtPayload } from '@pos/shared';

// Extend Hono's context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: 'Unauthorized: No token provided' },
      401
    );
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyAccessToken(token);
  

  if (!payload) {
    return c.json(
      { success: false, error: 'Unauthorized: Invalid or expired token' },
      401
    );
  }
  
  // Set user in context
  c.set('user', payload);
  
  await next();
});

// Optional auth middleware - doesn't fail if no token
export const optionalAuthMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);
    
    if (payload) {
      c.set('user', payload);
    }
  }
  
  await next();
});
