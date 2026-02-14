import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const pinLoginSchema = z.object({
  pin: z.string().length(6, 'PIN must be 6 digits'),
  storeId: z.string().uuid('Invalid store ID'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const setPinSchema = z.object({
  pin: z.string().length(6, 'PIN must be 6 digits').regex(/^\d+$/, 'PIN must contain only digits'),
});

// Device Binding Login Schemas
export const deviceLoginSchema = z.object({
  bindingCode: z.string().length(6, 'Binding code must be 6 characters').toUpperCase(),
  deviceFingerprint: z.string().optional(),
});

export const devicePinLoginSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  pin: z.string().length(6, 'PIN must be 6 digits'),
});

export const createDeviceSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  expiresIn: z.enum(['never', '24h', '7d', '30d']).optional().default('24h'),
});

export const revokeDeviceSchema = z.object({
  reason: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PinLoginInput = z.infer<typeof pinLoginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type DeviceLoginInput = z.infer<typeof deviceLoginSchema>;
export type DevicePinLoginInput = z.infer<typeof devicePinLoginSchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type RevokeDeviceInput = z.infer<typeof revokeDeviceSchema>;
