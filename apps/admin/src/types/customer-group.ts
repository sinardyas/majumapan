export interface CustomerGroup {
  id: string;
  name: string;
  minSpend: string;
  minVisits: number;
  priority: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CustomerGroupFormData {
  name: string;
  minSpend: string;
  minVisits: string;
  priority: string;
}

export interface CreateCustomerGroupRequest {
  name: string;
  minSpend?: number;
  minVisits?: number;
  priority?: number;
}

export interface UpdateCustomerGroupRequest {
  name?: string;
  minSpend?: number;
  minVisits?: number;
  priority?: number;
}
