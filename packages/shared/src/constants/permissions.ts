export const USER_ROLES = ['admin', 'manager', 'cashier'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = {
  // Stores
  'stores:create': ['admin'],
  'stores:read': ['admin', 'manager'],
  'stores:update': ['admin'],
  'stores:delete': ['admin'],

  // Users
  'users:create': ['admin', 'manager'],
  'users:read': ['admin', 'manager'],
  'users:update': ['admin', 'manager'],
  'users:delete': ['admin', 'manager'],
  'users:create:admin': ['admin'],

  // Products
  'products:create': ['admin', 'manager'],
  'products:read': ['admin', 'manager', 'cashier'],
  'products:update': ['admin', 'manager'],
  'products:delete': ['admin', 'manager'],

  // Categories
  'categories:create': ['admin', 'manager'],
  'categories:read': ['admin', 'manager', 'cashier'],
  'categories:update': ['admin', 'manager'],
  'categories:delete': ['admin', 'manager'],

  // Stock
  'stock:adjust': ['admin', 'manager'],
  'stock:read': ['admin', 'manager', 'cashier'],

  // Discounts
  'discounts:create': ['admin', 'manager'],
  'discounts:read': ['admin', 'manager', 'cashier'],
  'discounts:update': ['admin', 'manager'],
  'discounts:delete': ['admin', 'manager'],

  // Transactions
  'transactions:create': ['admin', 'manager', 'cashier'],
  'transactions:read': ['admin', 'manager', 'cashier'],
  'transactions:read:all': ['admin', 'manager'],
  'transactions:void': ['admin', 'manager'],

  // Reports
  'reports:read': ['admin', 'manager'],
  'reports:export': ['admin', 'manager'],

  // Settings
  'settings:read': ['admin', 'manager'],
  'settings:update': ['admin'],

  // Sync
  'sync:full': ['admin', 'manager', 'cashier'],
  'sync:pull': ['admin', 'manager', 'cashier'],
  'sync:push': ['admin', 'manager', 'cashier'],
  'sync:status': ['admin', 'manager'],

  // End of Day
  'eod:manage': ['admin', 'manager'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(role as never);
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role as never))
    .map(([permission]) => permission as Permission);
}
