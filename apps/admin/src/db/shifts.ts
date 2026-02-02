import type { LocalShift, PendingShiftOperation } from './index';
import { api } from '@/services/api';
import { saveShift } from './index';

export interface OpenShiftData {
  floatAmount: number;
  note?: string;
}

export interface CloseShiftData {
  endingCash: number;
  note?: string;
  varianceReason?: string;
  supervisorApproval?: {
    supervisorId: string;
    approvedAt: string;
  };
}

export async function openShiftOnline(
  _storeId: string,
  _cashierId: string,
  data: OpenShiftData
  ): Promise<{ success: boolean; shift?: LocalShift; error?: string }> {
  try {
    const response = await api.openShift({
      floatAmount: data.floatAmount,
      note: data.note,
    });

    if (response.success && response.data?.shift) {
      const shift: LocalShift = {
        id: response.data.shift.id,
        shiftNumber: response.data.shift.shiftNumber,
        cashierId: response.data.shift.cashierId,
        storeId: response.data.shift.storeId,
        status: response.data.shift.status,
        openingFloat: Number(response.data.shift.openingFloat),
        openingNote: response.data.shift.openingNote ?? null,
        openingImageUrl: response.data.shift.openingImageUrl ?? null,
        openingTimestamp: response.data.shift.openingTimestamp,
        endingCash: response.data.shift.endingCash ? Number(response.data.shift.endingCash) : null,
        endingNote: response.data.shift.endingNote ?? null,
        closingTimestamp: response.data.shift.closingTimestamp ?? null,
        variance: response.data.shift.variance ? Number(response.data.shift.variance) : null,
        varianceReason: response.data.shift.varianceReason ?? null,
        varianceApprovedBy: response.data.shift.varianceApprovedBy ?? null,
        varianceApprovedAt: response.data.shift.varianceApprovedAt ?? null,
        syncStatus: 'synced',
        serverId: response.data.shift.id,
        createdAt: response.data.shift.createdAt,
        updatedAt: response.data.shift.updatedAt,
      };

      await saveShift(shift);

      return { success: true, shift };
    }

    return { success: false, error: response.error || 'Failed to open shift' };
  } catch (error) {
    console.error('Error opening shift online:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function openShiftOffline(
  storeId: string,
  cashierId: string,
  data: OpenShiftData
): Promise<LocalShift> {
  const shiftNumber = generateShiftNumber();
  const now = new Date().toISOString();

  const shift: LocalShift = {
    id: crypto.randomUUID(),
    shiftNumber,
    cashierId,
    storeId,
    status: 'ACTIVE',
    openingFloat: data.floatAmount,
    openingNote: data.note || null,
    openingImageUrl: null,
    openingTimestamp: now,
    endingCash: null,
    endingNote: null,
    closingTimestamp: null,
    variance: null,
    varianceReason: null,
    varianceApprovedBy: null,
    varianceApprovedAt: null,
    syncStatus: 'pending',
    serverId: null,
    createdAt: now,
    updatedAt: now,
  };

  await import('./index').then(db => db.saveShift(shift));

  const operation: PendingShiftOperation = {
    id: crypto.randomUUID(),
    shiftId: shift.id,
    operation: 'OPEN',
    data: shift,
    createdAt: now,
    syncStatus: 'pending',
  };

  await import('./index').then(db => db.savePendingShiftOperation(operation));

  return shift;
}

export async function closeShiftOnline(
  shiftId: string,
  data: CloseShiftData
): Promise<{ success: boolean; shift?: LocalShift; error?: string }> {
  try {
    const response = await api.closeShift({
      shiftId,
      endingCash: data.endingCash,
      note: data.note,
      supervisorApproval: data.supervisorApproval,
      varianceReason: data.varianceReason,
    });

    if (response.success && response.data?.shift) {
      const shift: LocalShift = {
        id: response.data.shift.id,
        shiftNumber: response.data.shift.shiftNumber,
        cashierId: response.data.shift.cashierId,
        storeId: response.data.shift.storeId,
        status: response.data.shift.status,
        openingFloat: Number(response.data.shift.openingFloat),
        openingNote: response.data.shift.openingNote ?? null,
        openingImageUrl: response.data.shift.openingImageUrl ?? null,
        openingTimestamp: response.data.shift.openingTimestamp,
        endingCash: response.data.shift.endingCash ? Number(response.data.shift.endingCash) : null,
        endingNote: response.data.shift.endingNote ?? null,
        closingTimestamp: response.data.shift.closingTimestamp ?? null,
        variance: response.data.shift.variance ? Number(response.data.shift.variance) : null,
        varianceReason: response.data.shift.varianceReason ?? null,
        varianceApprovedBy: response.data.shift.varianceApprovedBy ?? null,
        varianceApprovedAt: response.data.shift.varianceApprovedAt ?? null,
        syncStatus: 'synced',
        serverId: response.data.shift.id,
        createdAt: response.data.shift.createdAt,
        updatedAt: response.data.shift.updatedAt,
      };

      await saveShift(shift);

      return { success: true, shift };
    }

    return { success: false, error: response.error || 'Failed to close shift' };
  } catch (error) {
    console.error('Error closing shift online:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function closeShiftOffline(
  shift: LocalShift,
  data: CloseShiftData
): Promise<LocalShift> {
  const variance = data.endingCash - shift.openingFloat;
  const now = new Date().toISOString();

  const updatedShift: LocalShift = {
    ...shift,
    endingCash: data.endingCash,
    endingNote: data.note || null,
    closingTimestamp: now,
    variance: Math.round(variance * 100) / 100,
    varianceReason: data.varianceReason || null,
    varianceApprovedBy: data.supervisorApproval?.supervisorId || null,
    varianceApprovedAt: data.supervisorApproval?.approvedAt || null,
    status: 'CLOSED',
    updatedAt: now,
  };

  await import('./index').then(db => db.saveShift(updatedShift));

  const operation: PendingShiftOperation = {
    id: crypto.randomUUID(),
    shiftId: shift.id,
    operation: 'CLOSE',
    data: updatedShift,
    createdAt: now,
    syncStatus: 'pending',
  };

  await import('./index').then(db => db.savePendingShiftOperation(operation));

  return updatedShift;
}

export async function getActiveShift(
  storeId: string,
  cashierId: string
): Promise<LocalShift | null> {
  const db = await import('./index');
  const shift = await db.getActiveShift(storeId, cashierId);
  return shift ?? null;
}

export async function syncPendingShiftOperations(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const db = await import('./index');
  const pendingOps = await db.getPendingShiftOperations();
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      const shiftToSync = {
        ...op.data,
        openingNote: op.data.openingNote ?? undefined,
        openingImageUrl: op.data.openingImageUrl ?? undefined,
        endingCash: op.data.endingCash ?? undefined,
        endingNote: op.data.endingNote ?? undefined,
        closingTimestamp: op.data.closingTimestamp ?? undefined,
        variance: op.data.variance ?? undefined,
        varianceReason: op.data.varianceReason ?? undefined,
        varianceApprovedBy: op.data.varianceApprovedBy ?? undefined,
        varianceApprovedAt: op.data.varianceApprovedAt ?? undefined,
        serverId: op.data.serverId ?? undefined,
      };
      const response = await api.syncShifts([shiftToSync as unknown as import('@pos/api-client').Shift]);

      if (response.success && response.data?.shifts && response.data.shifts.length > 0) {
        await db.markShiftAsSynced(op.shiftId, response.data.shifts[0].id);
        await db.deletePendingShiftOperation(op.id);
        synced++;
      }
    } catch (error) {
      console.error(`Failed to sync shift operation ${op.id}:`, error);
      await db.markShiftOperationAsFailed(op.id, error instanceof Error ? error.message : 'Unknown error');
      errors.push(`Shift ${op.shiftId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  return { synced, failed, errors };
}

function generateShiftNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SHIFT-${dateStr}-${random}`;
}

export async function verifySupervisorPin(
  pin: string,
  shiftId: string,
  variance: number
): Promise<{ success: boolean; supervisorId?: string; supervisorName?: string; error?: string }> {
  try {
    const response = await api.verifyPin({
      pin,
      action: 'shift_approve',
      metadata: { shiftId, variance },
    });

    if (response.success) {
      return {
        success: true,
        supervisorId: response.data?.supervisorId,
        supervisorName: response.data?.supervisorName,
      };
    }

    return { success: false, error: response.error || 'Invalid PIN' };
  } catch (error) {
    console.error('Error verifying supervisor PIN:', error);
    return { success: false, error: 'Network error' };
  }
}
