import { api } from '@/services/api';
import type { CustomerGroup, CreateCustomerGroupRequest, UpdateCustomerGroupRequest } from '@/types/customer-group';

export const customerGroupApi = {
  list: () =>
    api.get<CustomerGroup[]>('/customers/groups/list'),

  getById: (id: string) =>
    api.get<CustomerGroup>(`/customers/groups/${id}`),

  create: (data: CreateCustomerGroupRequest) =>
    api.post<CustomerGroup>('/customers/groups', data),

  update: (id: string, data: UpdateCustomerGroupRequest) =>
    api.put<CustomerGroup>(`/customers/groups/${id}`, data),

  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/customers/groups/${id}`),

  getMemberCount: async (groupId: string): Promise<number> => {
    const response = await api.get<{ count: number }>('/customers/count', {
      queryParams: { groupId },
    });
    return response.data?.count || 0;
  },
};
