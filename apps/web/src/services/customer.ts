import { api } from '@/services/api';
import type { Customer, CustomerVoucher } from '@/types/customer';

export const customerApi = {
  getByPhone: (phone: string) =>
    api.get<Customer>(`/customers/phone/${encodeURIComponent(phone)}`),

  getById: (id: string) =>
    api.get<Customer>(`/customers/${id}`),

  create: (data: { phone: string; name?: string; email?: string }) =>
    api.post<Customer>('/customers', data),

  getVouchers: (customerId: string) =>
    api.get<CustomerVoucher[]>(`/customers/${customerId}/vouchers`),
};
