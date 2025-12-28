import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { hasPermission, type Permission, type UserRole } from '@pos/shared';

export const requirePermission = (permission: Permission) => {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        401
      );
    }
    
    const userRole = user.role as UserRole;
    
    if (!hasPermission(userRole, permission)) {
      return c.json(
        { success: false, error: `Forbidden: Insufficient permissions for ${permission}` },
        403
      );
    }
    
    await next();
  });
};

export const requireRole = (...roles: UserRole[]) => {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        401
      );
    }
    
    if (!roles.includes(user.role as UserRole)) {
      return c.json(
        { success: false, error: `Forbidden: Required role: ${roles.join(' or ')}` },
        403
      );
    }
    
    await next();
  });
};

// Check if user belongs to the store they're trying to access
export const requireStoreAccess = createMiddleware(async (c: Context, next: Next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json(
      { success: false, error: 'Unauthorized: Authentication required' },
      401
    );
  }
  
  // Admins can access all stores
  if (user.role === 'admin') {
    await next();
    return;
  }
  
  // Get store ID from route params or query
  const storeIdParam = c.req.param('storeId');
  const storeIdQuery = c.req.query('storeId');
  const storeId = storeIdParam || storeIdQuery;
  
  // If no store ID specified, use user's store
  if (!storeId) {
    await next();
    return;
  }
  
  // Check if user's store matches the requested store
  if (user.storeId !== storeId) {
    return c.json(
      { success: false, error: 'Forbidden: Access to this store is not allowed' },
      403
    );
  }
  
  await next();
});
