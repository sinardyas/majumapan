import { db } from '../db/index.js';
import { auditLogTable } from '../db/schema.js';
import type { Context } from 'hono';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout';

export interface AuditLogParams {
  userId: string;
  userEmail: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: any; new: any }>;
  c: Context;
}

export async function createAuditLog(params: AuditLogParams) {
  const ip = getIpAddress(params.c);
  const userAgent = getUserAgent(params.c);

  await db.insert(auditLogTable).values({
    userId: params.userId,
    userEmail: params.userEmail,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    changes: params.changes as any,
    ipAddress: ip,
    userAgent,
  });
}

function getIpAddress(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return c.req.header('cf-connecting-ip') || 
         c.req.header('x-real-ip') || 
         'unknown';
}

function getUserAgent(c: Context): string {
  return c.req.header('user-agent') || 'unknown';
}
