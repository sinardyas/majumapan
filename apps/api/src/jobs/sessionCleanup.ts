import { db, userSessions, deviceBindings } from '../db';
import { eq, lt, or, and, isNull, isNotNull } from 'drizzle-orm';

const SESSION_INACTIVITY_MINUTES = 30;

export async function cleanupInactiveSessions(): Promise<number> {
  const cutoffTime = new Date(Date.now() - SESSION_INACTIVITY_MINUTES * 60 * 1000);
  
  const result = await db.update(userSessions)
    .set({
      isActive: false,
      endedAt: new Date(),
    })
    .where(
      and(
        eq(userSessions.isActive, true),
        or(
          lt(userSessions.lastActiveAt, cutoffTime),
          isNull(userSessions.lastActiveAt)
        )
      )
    );
  
  return 0; // Drizzle doesn't return rowCount directly
}

export async function cleanupExpiredBindings(): Promise<number> {
  const now = new Date();
  
  const result = await db.update(deviceBindings)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedReason: 'Auto-expired: Binding code not claimed within expiration period',
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceBindings.status, 'pending'),
        lt(deviceBindings.expiresAt, now)
      )
    );
  
  return 0;
}

export async function clearExpiredPinLockouts(): Promise<number> {
  const now = new Date();
  
  const result = await db.update(userSessions)
    .set({
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    })
    .where(
      and(
        eq(userSessions.isActive, true),
        isNotNull(userSessions.pinLockedUntil),
        lt(userSessions.pinLockedUntil, now)
      )
    );
  
  return 0;
}

export async function runSessionCleanup(): Promise<void> {
  try {
    console.log('[SessionCleanup] Starting session cleanup...');
    
    const sessionsClosed = await cleanupInactiveSessions();
    console.log(`[SessionCleanup] Closed ${sessionsClosed} inactive sessions`);
    
    const bindingsExpired = await cleanupExpiredBindings();
    console.log(`[SessionCleanup] Expired ${bindingsExpired} pending device bindings`);
    
    const lockoutsCleared = await clearExpiredPinLockouts();
    console.log(`[SessionCleanup] Cleared ${lockoutsCleared} expired PIN lockouts`);
    
    console.log('[SessionCleanup] Session cleanup completed');
  } catch (error) {
    console.error('[SessionCleanup] Error during session cleanup:', error);
  }
}
