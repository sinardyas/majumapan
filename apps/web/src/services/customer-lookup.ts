import { db } from '@/db';
import { customerApi, type Customer, type CustomerGroup } from './customer';

export interface CustomerVoucher {
  id: string;
  code: string;
  type: 'GC' | 'PR';
  discountType?: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  value?: string;
  currentBalance?: string;
  minPurchase?: string;
  expiresAt: string | null;
  isActive: boolean;
}

export interface CustomerWithGroup {
  customer: Customer;
  group: CustomerGroup | null;
  vouchers: CustomerVoucher[];
}

/**
 * Customer Lookup Service
 * Provides hybrid online/offline lookup for customers by phone number
 * Supports caching API results for offline use
 */
class CustomerLookupService {
  /**
   * Find a customer by phone number
   * 1. First checks local IndexedDB
   * 2. Falls back to API if online and not found locally
   * 3. Caches API results for future offline use
   */
  async findByPhone(phone: string): Promise<CustomerWithGroup | null> {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = this.normalizePhone(phone);

    // Try local lookup first
    const localCustomer = await this.getLocalByPhone(normalizedPhone);
    if (localCustomer) {
      const group = localCustomer.customerGroupId
        ? await this.getLocalGroup(localCustomer.customerGroupId)
        : null;

      // Try to get vouchers from API (online) or local cache
      const vouchers = await this.getVouchers(localCustomer.id);

      return {
        customer: {
          id: localCustomer.id,
          phone: localCustomer.phone,
          name: localCustomer.name,
          email: localCustomer.email,
          customerGroupId: localCustomer.customerGroupId,
          totalSpend: localCustomer.totalSpend,
          visitCount: localCustomer.visitCount,
          createdAt: localCustomer.createdAt,
          updatedAt: localCustomer.updatedAt,
        },
        group: group ? {
          id: group.id,
          name: group.name,
          minSpend: group.minSpend,
          minVisits: group.minVisits,
          priority: group.priority,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        } : null,
        vouchers,
      };
    }

    // Online fallback
    if (navigator.onLine) {
      const response = await customerApi.getByPhone(normalizedPhone);
      if (response.success && response.data) {
        // Cache the customer for offline use
        await this.cacheCustomer(response.data);

        // Try to get vouchers from API
        const vouchers = await this.getVouchers(response.data.id);

        return {
          customer: response.data,
          group: response.data.group || null,
          vouchers,
        };
      }
    }

    return null;
  }

  /**
   * Register a new customer
   * 1. Creates online first
   * 2. Caches for offline use
   * 3. Falls back to offline registration if offline
   */
  async register(input: { phone: string; name: string; email?: string }): Promise<CustomerWithGroup> {
    const normalizedPhone = this.normalizePhone(input.phone);

    // Try online registration first
    if (navigator.onLine) {
      try {
        const response = await customerApi.create({
          phone: normalizedPhone,
          name: input.name,
          email: input.email,
        });

        if (response.success && response.data) {
          // Cache the new customer
          await this.cacheCustomer(response.data);

          return {
            customer: response.data,
            group: response.data.group || null,
            vouchers: [],
          };
        }
      } catch (error) {
        console.error('Online registration failed, falling back to offline:', error);
      }
    }

    // Offline registration - create pending sync record
    const now = new Date().toISOString();
    const offlineCustomer = {
      id: crypto.randomUUID(),
      phone: normalizedPhone,
      name: input.name,
      email: input.email || null,
      customerGroupId: null, // Will be assigned by server
      totalSpend: '0',
      visitCount: 0,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_create' as const,
    };

    await db.customers.put(offlineCustomer);

    return {
      customer: {
        id: offlineCustomer.id,
        phone: offlineCustomer.phone,
        name: offlineCustomer.name,
        email: offlineCustomer.email,
        customerGroupId: offlineCustomer.customerGroupId,
        totalSpend: offlineCustomer.totalSpend,
        visitCount: offlineCustomer.visitCount,
        createdAt: offlineCustomer.createdAt,
        updatedAt: offlineCustomer.updatedAt,
      },
      group: null,
      vouchers: [],
    };
  }

  /**
   * Get customer's vouchers
   * First checks local cache, then falls back to API
   */
  async getVouchers(customerId: string): Promise<CustomerVoucher[]> {
    // TODO: Implement local voucher cache if needed
    // For now, always fetch from API when online

    if (navigator.onLine) {
      try {
        const response = await customerApi.getVouchers(customerId);
        if (response.success && response.data) {
          return response.data.map((v: Record<string, unknown>) => ({
            id: v.id as string,
            code: v.code as string,
            type: v.type as 'GC' | 'PR',
            discountType: v.discountType as 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM' | undefined,
            value: v.value as string | undefined,
            currentBalance: v.currentBalance as string | undefined,
            minPurchase: v.minPurchase as string | undefined,
            expiresAt: v.expiresAt as string | null,
            isActive: (v.isActive as boolean) ?? true,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch vouchers:', error);
      }
    }

    return [];
  }

  /**
   * Cache a customer from API response for offline use
   */
  private async cacheCustomer(customer: Customer): Promise<void> {
    await db.customers.put({
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      customerGroupId: customer.customerGroupId,
      totalSpend: customer.totalSpend,
      visitCount: customer.visitCount,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      syncStatus: 'synced',
    });

    // Also cache the group if present
    if (customer.group) {
      await db.customerGroups.put({
        id: customer.group.id,
        name: customer.group.name,
        minSpend: customer.group.minSpend,
        minVisits: customer.group.minVisits,
        priority: customer.group.priority,
        createdAt: customer.group.createdAt,
        updatedAt: customer.group.updatedAt,
      });
    }
  }

  /**
   * Get customer from local IndexedDB by phone
   */
  private async getLocalByPhone(phone: string) {
    return db.customers
      .where('phone')
      .equals(phone)
      .first();
  }

  /**
   * Get customer group from local IndexedDB
   */
  private async getLocalGroup(groupId: string) {
    return db.customerGroups.get(groupId);
  }

  /**
   * Normalize phone number for consistent lookup
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  }
}

export const customerLookupService = new CustomerLookupService();
