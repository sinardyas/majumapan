import { api } from '@/services/api';
import type { Customer, CustomerGroup, CreateCustomerRequest, UpdateCustomerRequest } from '@/types/customer';

export const customerApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<{
      data: Customer[];
      pagination: { total: number; limit: number; offset: number };
    }>('/customers', { queryParams: params }),

  getById: (id: string) =>
    api.get<Customer>(`/customers/${id}`),

  getByPhone: (phone: string) =>
    api.get<Customer>(`/customers/phone/${encodeURIComponent(phone)}`),

  create: (data: CreateCustomerRequest) =>
    api.post<Customer>('/customers', data),

  update: (id: string, data: UpdateCustomerRequest) =>
    api.put<Customer>(`/customers/${id}`, data),

  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/customers/${id}`),

  getVouchers: (customerId: string) =>
    api.get<Customer[]>(`/customers/${customerId}/vouchers`),

  getGroups: () =>
    api.get<CustomerGroup[]>('/customers/groups/list'),

  count: (groupId?: string) => {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (groupId) params.groupId = groupId;
    return api.get<{ count: number }>('/customers/count', { queryParams: params });
  },
};
