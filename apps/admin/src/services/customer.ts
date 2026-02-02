import type { ApiResponse } from '@pos/api-client';

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customerGroupId: string | null;
  totalSpend: string;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
  group?: CustomerGroup | null;
}

export interface CustomerGroup {
  id: string;
  name: string;
  minSpend: string;
  minVisits: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  phone: string;
  name?: string;
  email?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  customerGroupId?: string;
}

export interface CreateGroupInput {
  name: string;
  minSpend?: number;
  minVisits?: number;
  priority?: number;
}

export interface UpdateGroupInput {
  name?: string;
  minSpend?: number;
  minVisits?: number;
  priority?: number;
}

class CustomerApiService {
  private baseUrl = '/api/v1/customers';

  async list(options?: {
    search?: string;
    groupId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Customer[]>> {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.groupId) params.append('groupId', options.groupId);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    const data = await response.json();
    return data;
  }

  async count(options?: { groupId?: string }): Promise<ApiResponse<{ count: number }>> {
    const params = new URLSearchParams();
    if (options?.groupId) params.append('groupId', options.groupId);
    
    const response = await fetch(`${this.baseUrl}/count?${params.toString()}`);
    return response.json();
  }

  async getById(id: string): Promise<ApiResponse<Customer>> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    return response.json();
  }

  async getByPhone(phone: string): Promise<ApiResponse<Customer>> {
    const response = await fetch(`${this.baseUrl}/phone/${encodeURIComponent(phone)}`);
    return response.json();
  }

  async create(input: CreateCustomerInput): Promise<ApiResponse<Customer>> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async update(id: string, input: UpdateCustomerInput): Promise<ApiResponse<Customer>> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getVouchers(customerId: string): Promise<ApiResponse<any[]>> {
    const response = await fetch(`${this.baseUrl}/${customerId}/vouchers`);
    return response.json();
  }

  // Customer Groups
  async getGroups(): Promise<ApiResponse<CustomerGroup[]>> {
    const response = await fetch(`${this.baseUrl}/groups/list`);
    return response.json();
  }

  async createGroup(input: CreateGroupInput): Promise<ApiResponse<CustomerGroup>> {
    const response = await fetch(`${this.baseUrl}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async updateGroup(id: string, input: UpdateGroupInput): Promise<ApiResponse<CustomerGroup>> {
    const response = await fetch(`${this.baseUrl}/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async deleteGroup(id: string): Promise<ApiResponse<null>> {
    const response = await fetch(`${this.baseUrl}/groups/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }
}

export const customerApi = new CustomerApiService();
