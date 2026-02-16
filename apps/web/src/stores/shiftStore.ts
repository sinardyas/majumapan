import { create } from 'zustand';
import type { LocalShift } from '@/db';
import { saveShift } from '@/db';
import {
  openShiftOnline,
  openShiftOffline,
  closeShiftOnline,
  closeShiftOffline,
  getActiveShift,
  verifySupervisorPin,
  type OpenShiftData,
  type CloseShiftData,
} from '@/db/shifts';
import { useAuthStore } from './authStore';
import { api } from '@/services/api';

const SHIFT_SYNC_CHANNEL = 'pos-shift-sync';
const channel = typeof BroadcastChannel !== undefined
  ? new BroadcastChannel(SHIFT_SYNC_CHANNEL)
  : null;

export type ShiftStatus = 'none' | 'loading' | 'active' | 'error';

interface ShiftState {
  activeShift: LocalShift | null;
  status: ShiftStatus;
  error: string | null;
  isOpening: boolean;
  isClosing: boolean;
  requiresSupervisorApproval: boolean;
  pendingVariance: number | null;

  openShift: (storeId: string, data: OpenShiftData) => Promise<{ success: boolean; error?: string }>;
  closeShift: (data: CloseShiftData) => Promise<{ success: boolean; error?: string }>;
  loadActiveShift: () => Promise<void>;
  loadActiveShiftFromServer: () => Promise<void>;
  verifySupervisorAndClose: (
    pin: string,
    data: Omit<CloseShiftData, 'supervisorApproval'>
  ) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  clearShift: () => void;
}

interface ShiftSyncMessage {
  type: 'SHIFT_SYNC';
  payload: {
    activeShift: LocalShift | null;
    status: ShiftStatus;
  };
}

function broadcastShiftState(state: ShiftState) {
  if (!channel) return;

  const message: ShiftSyncMessage = {
    type: 'SHIFT_SYNC',
    payload: {
      activeShift: state.activeShift,
      status: state.status,
    },
  };

  channel.postMessage(message);
}

if (channel) {
  channel.onmessage = (event: MessageEvent<ShiftSyncMessage>) => {
    if (event.data.type === 'SHIFT_SYNC') {
      const { payload } = event.data;
      useShiftStore.setState({
        activeShift: payload.activeShift,
        status: payload.status,
      });
    }
  };
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  activeShift: null,
  status: 'none',
  error: null,
  isOpening: false,
  isClosing: false,
  requiresSupervisorApproval: false,
  pendingVariance: null,

  openShift: async (storeId, data) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    set({ isOpening: true, error: null, status: 'loading' });

    try {
      const result = await openShiftOnline(storeId, user.id, data);

      if (result.success && result.shift) {
        set({
          activeShift: result.shift,
          isOpening: false,
          status: 'active',
        });
        broadcastShiftState(get());
        return { success: true };
      }

      if (result.error) {
        set({
          isOpening: false,
          status: 'error',
          error: result.error,
        });
        return { success: false, error: result.error };
      }
    } catch {
      // If online fails, try offline
    }

    // Try offline mode
    try {
      const shift = await openShiftOffline(storeId, user.id, data);
      set({
        activeShift: shift,
        isOpening: false,
        status: 'active',
      });
      broadcastShiftState(get());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open shift offline';
      set({
        isOpening: false,
        status: 'error',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  },

  closeShift: async (data) => {
    const { activeShift } = get();
    if (!activeShift) {
      return { success: false, error: 'No active shift' };
    }

    const variance = data.endingCash - activeShift.openingFloat;

    if (variance >= 5) {
      set({
        isClosing: true,
        requiresSupervisorApproval: true,
        pendingVariance: variance,
      });
      return { success: false, error: 'Supervisor approval required for variance >= $5' };
    }

    return get().verifySupervisorAndClose('', { ...data });
  },

  loadActiveShift: async () => {
    const { user } = useAuthStore.getState();
    if (!user || !user.storeId) {
      set({ activeShift: null, status: 'none' });
      return;
    }

    set({ status: 'loading' });

    try {
      const shift = await getActiveShift(user.storeId, user.id);

      if (shift) {
        set({
          activeShift: shift,
          status: shift.status === 'ACTIVE' ? 'active' : 'none',
        });
      } else {
        set({
          activeShift: null,
          status: 'none',
        });
      }

      broadcastShiftState(get());
    } catch (error) {
      console.error('Error loading active shift:', error);
      set({
        activeShift: null,
        status: 'error',
        error: 'Failed to load active shift',
      });
    }
  },

  loadActiveShiftFromServer: async () => {
    const { user } = useAuthStore.getState();
    if (!user || !user.storeId) {
      return;
    }

    try {
      const response = await api.get<any>('/shifts/active');
      
      if (response.success && response.data?.shift) {
        const serverShift = response.data.shift;
        
        const localShift: LocalShift = {
          id: serverShift.id,
          serverId: serverShift.id,
          shiftNumber: serverShift.shiftNumber,
          cashierId: serverShift.cashierId,
          storeId: serverShift.storeId,
          status: serverShift.status,
          openingFloat: parseFloat(serverShift.openingFloat),
          openingNote: serverShift.openingNote ?? null,
          openingImageUrl: null,
          openingTimestamp: new Date(serverShift.openingTimestamp).toISOString(),
          endingCash: serverShift.endingCash ? parseFloat(serverShift.endingCash) : null,
          endingNote: serverShift.endingNote ?? null,
          closingTimestamp: serverShift.closingTimestamp ? new Date(serverShift.closingTimestamp).toISOString() : null,
          variance: serverShift.variance ? parseFloat(serverShift.variance) : null,
          varianceReason: serverShift.varianceReason ?? null,
          varianceApprovedBy: serverShift.varianceApprovedBy ?? null,
          varianceApprovedAt: serverShift.varianceApprovedAt ? new Date(serverShift.varianceApprovedAt).toISOString() : null,
          syncStatus: 'synced',
          createdAt: new Date(serverShift.createdAt).toISOString(),
          updatedAt: new Date(serverShift.updatedAt).toISOString(),
        };

        await saveShift(localShift);
        
        set({
          activeShift: localShift,
          status: localShift.status === 'ACTIVE' ? 'active' : 'none',
        });
        
        broadcastShiftState(get());
      }
    } catch (error) {
      console.error('Error loading active shift from server:', error);
    }
  },

  verifySupervisorAndClose: async (pin, data) => {
    const { activeShift, pendingVariance } = get();
    if (!activeShift) {
      return { success: false, error: 'No active shift' };
    }

    set({ isClosing: true, error: null, status: 'loading' });

    let supervisorApproval: { supervisorId: string; approvedAt: string } | undefined;

    if (pin) {
      const verifyResult = await verifySupervisorPin(pin, activeShift.id, pendingVariance ?? 0);

      if (!verifyResult.success) {
        set({
          isClosing: false,
          status: activeShift.status === 'ACTIVE' ? 'active' : 'none',
          error: verifyResult.error || 'Invalid supervisor PIN',
        });
        return { success: false, error: verifyResult.error };
      }

      supervisorApproval = {
        supervisorId: verifyResult.supervisorId!,
        approvedAt: new Date().toISOString(),
      };
    }

    const closeData: CloseShiftData = {
      ...data,
      supervisorApproval,
    };

    try {
      const result = await closeShiftOnline(activeShift.id, closeData);

      if (result.success && result.shift) {
        set({
          activeShift: null,
          isClosing: false,
          status: 'none',
          requiresSupervisorApproval: false,
          pendingVariance: null,
        });
        broadcastShiftState(get());
        return { success: true };
      }

      if (result.error) {
        // Try offline mode
      }
    } catch {
      // If online fails, try offline
    }

    try {
      await closeShiftOffline(activeShift, closeData);
      set({
        activeShift: null,
        isClosing: false,
        status: 'none',
        requiresSupervisorApproval: false,
        pendingVariance: null,
      });
      broadcastShiftState(get());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to close shift';
      set({
        isClosing: false,
        status: activeShift.status === 'ACTIVE' ? 'active' : 'none',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearShift: () => {
    set({
      activeShift: null,
      status: 'none',
      error: null,
      requiresSupervisorApproval: false,
      pendingVariance: null,
    });
    broadcastShiftState(get());
  },
}));
