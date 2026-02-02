export interface CustomerGroup {
  id: string;
  name: string;
  minSpend: string;
  minVisits: number;
  priority: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customerGroupId: string | null;
  totalSpend: string;
  visitCount: number;
  createdAt: Date;
  updatedAt?: Date;
  group?: CustomerGroup | null;
}

export interface CustomerFormData {
  phone: string;
  name: string;
  email: string;
  customerGroupId?: string;
}

export interface CreateCustomerRequest {
  phone: string;
  name?: string;
  email?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  customerGroupId?: string;
}
