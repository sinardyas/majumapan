import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload } from '@pos/shared';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 15 * 60; // Default 15 minutes
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 15 * 60;
  }
}

export async function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
  storeId: string | null;
  deviceId?: string;
}): Promise<string> {
  const expiresIn = parseExpiration(JWT_EXPIRES_IN);
  
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    storeId: payload.storeId,
    deviceId: payload.deviceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(JWT_SECRET);
}

export async function generateRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresIn = parseExpiration(REFRESH_TOKEN_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  
  const token = await new SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(JWT_SECRET);
  
  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'refresh') {
      return null;
    }
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export function getExpiresInSeconds(): number {
  return parseExpiration(JWT_EXPIRES_IN);
}
