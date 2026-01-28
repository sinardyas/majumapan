import { db } from '../db';
import { customers, customerGroups, vouchers, voucherTransactions, orderVouchers } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

interface CreateCustomerInput {
  phone: string;
  name?: string;
  email?: string;
}

interface UpdateCustomerInput {
  name?: string;
  email?: string;
  customerGroupId?: string;
}

interface CustomerWithGroup {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  totalSpend: string;
  visitCount: number;
  createdAt: Date;
  group: {
    id: string;
    name: string;
  } | null;
}

export const customerService = {
  async create(input: CreateCustomerInput) {
    const now = new Date();
    
    // Get Bronze group as default
    const bronzeGroup = await db.query.customerGroups.findFirst({
      where: eq(customerGroups.priority, 0),
    });

    const [customer] = await db.insert(customers).values({
      phone: input.phone,
      name: input.name || null,
      email: input.email || null,
      customerGroupId: bronzeGroup?.id || null,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return customer;
  },

  async getById(id: string) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, id),
      with: {
        group: true,
      },
    });
    return customer || null;
  },

  async getByPhone(phone: string) {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.phone, phone),
      with: {
        group: true,
      },
    });
    return customer || null;
  },

  async list(options?: { 
    search?: string;
    groupId?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.query.customers.findMany({
      with: {
        group: true,
      },
      orderBy: [desc(customers.createdAt)],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      const customersList = await query;
      return customersList.filter(c => 
        c.phone.includes(options.search!) || 
        (c.name && c.name.toLowerCase().includes(searchLower))
      );
    }

    if (options?.groupId) {
      const customersList = await query;
      return customersList.filter(c => c.customerGroupId === options.groupId);
    }

    return await query;
  },

  async count(options?: { groupId?: string }) {
    if (options?.groupId) {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(eq(customers.customerGroupId, options.groupId));
      return Number(result[0]?.count || 0);
    }
    
    const result = await db.select({ count: sql<number>`count(*)` }).from(customers);
    return Number(result[0]?.count || 0);
  },

  async update(id: string, input: UpdateCustomerInput) {
    const now = new Date();
    
    const [customer] = await db.update(customers)
      .set({
        ...input,
        updatedAt: now,
      })
      .where(eq(customers.id, id))
      .returning();

    return customer;
  },

  async delete(id: string) {
    await db.delete(customers).where(eq(customers.id, id));
    return true;
  },

  async updateSpendAndVisits(
    customerId: string, 
    amountSpent: number
  ) {
    const customer = await this.getById(customerId);
    if (!customer) return null;

    const now = new Date();
    const newSpend = Number(customer.totalSpend) + amountSpent;
    const newVisits = customer.visitCount + 1;

    // Auto-assign to appropriate group based on new spend and visits
    const matchingGroup = await db.query.customerGroups.findFirst({
      where: and(
        sql`${customerGroups.minSpend} <= ${newSpend}`,
        sql`${customerGroups.minVisits} <= ${newVisits}`
      ),
      orderBy: [desc(customerGroups.priority)],
    });

    const [updated] = await db.update(customers)
      .set({
        totalSpend: String(newSpend),
        visitCount: newVisits,
        customerGroupId: matchingGroup?.id || customer.customerGroupId,
        updatedAt: now,
      })
      .where(eq(customers.id, customerId))
      .returning();

    return updated;
  },

  async getGroups() {
    return await db.query.customerGroups.findMany({
      orderBy: [desc(customerGroups.priority)],
    });
  },

  async getGroupById(id: string) {
    const group = await db.query.customerGroups.findFirst({
      where: eq(customerGroups.id, id),
    });
    return group || null;
  },

  async createGroup(data: {
    name: string;
    minSpend?: number;
    minVisits?: number;
    priority?: number;
  }) {
    const [group] = await db.insert(customerGroups).values({
      name: data.name,
      minSpend: data.minSpend ? String(data.minSpend) : '0',
      minVisits: data.minVisits || 0,
      priority: data.priority || 0,
    }).returning();
    return group;
  },

  async updateGroup(
    id: string,
    data: {
      name?: string;
      minSpend?: number;
      minVisits?: number;
      priority?: number;
    }
  ) {
    const [group] = await db.update(customerGroups)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.minSpend !== undefined && { minSpend: String(data.minSpend) }),
        ...(data.minVisits !== undefined && { minVisits: data.minVisits }),
        ...(data.priority !== undefined && { priority: data.priority }),
      })
      .where(eq(customerGroups.id, id))
      .returning();
    return group;
  },

  async deleteGroup(id: string) {
    // Check if any customers are in this group
    const customersInGroup = await db.select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(eq(customers.customerGroupId, id));
    
    if (Number(customersInGroup[0]?.count || 0) > 0) {
      throw new Error('Cannot delete group with assigned customers');
    }

    await db.delete(customerGroups).where(eq(customerGroups.id, id));
    return true;
  },

  async getCustomerVouchers(customerId: string) {
    const customer = await this.getById(customerId);
    if (!customer) return null;

    const customerVouchers = await db.query.vouchers.findMany({
      where: and(
        eq(vouchers.customerId, customerId),
        eq(vouchers.isVoid, false),
        sql`${vouchers.expiresAt} IS NULL OR ${vouchers.expiresAt} > NOW()`
      ),
      orderBy: [desc(vouchers.createdAt)],
    });

    return customerVouchers;
  },

  async assignVoucherToCustomer(voucherId: string, customerId: string) {
    const [voucher] = await db.update(vouchers)
      .set({
        customerId,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, voucherId))
      .returning();

    return voucher;
  },

  async bulkAssignVoucher(voucherId: string, customerIds: string[]) {
    const results = await Promise.all(
      customerIds.map(customerId => 
        this.assignVoucherToCustomer(voucherId, customerId)
      )
    );
    return results;
  },
};
