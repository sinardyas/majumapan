import type { ApiResponse } from '@pos/api-client';

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  message: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionHistory {
  id: string;
  voucherId: string;
  channel: string;
  recipientCount: number;
  createdAt: string;
}

export interface VoucherInfo {
  code: string;
  type: 'GC' | 'PR';
  discountType: string | null;
  percentageValue: string | null;
  fixedValue: string | null;
  currentBalance: string | null;
  expiresAt: string | null;
}

export interface DistributionResult {
  recipientCount: number;
  links: Array<{
    channel: string;
    link: string;
    recipient: string;
  }>;
}

export interface DistributeInput {
  voucherCode: string;
  channel: 'whatsapp' | 'email' | 'print';
  recipientType: 'all' | 'group' | 'individual' | 'manual';
  groupId?: string;
  individualPhone?: string;
  manualPhones?: string[];
  templateId?: string;
}

class DistributionApiService {
  private baseUrl = '/api/v1/distribution';

  async getTemplates(): Promise<ApiResponse<MessageTemplate[]>> {
    const response = await fetch(`${this.baseUrl}/templates`);
    return response.json();
  }

  async getTemplateById(id: string): Promise<ApiResponse<MessageTemplate>> {
    const response = await fetch(`${this.baseUrl}/templates/${id}`);
    return response.json();
  }

  async createTemplate(input: {
    name: string;
    subject?: string;
    message: string;
    isDefault?: boolean;
  }): Promise<ApiResponse<MessageTemplate>> {
    const response = await fetch(`${this.baseUrl}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async updateTemplate(
    id: string,
    input: {
      name?: string;
      subject?: string;
      message?: string;
      isDefault?: boolean;
    }
  ): Promise<ApiResponse<MessageTemplate>> {
    const response = await fetch(`${this.baseUrl}/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async deleteTemplate(id: string): Promise<ApiResponse<null>> {
    const response = await fetch(`${this.baseUrl}/templates/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async distribute(input: DistributeInput): Promise<ApiResponse<DistributionResult>> {
    const response = await fetch(`${this.baseUrl}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async getHistory(limit = 50): Promise<ApiResponse<DistributionHistory[]>> {
    const response = await fetch(`${this.baseUrl}/history?limit=${limit}`);
    return response.json();
  }

  async preview(input: {
    templateId: string;
    voucherCode: string;
    customerName?: string;
  }): Promise<ApiResponse<{ preview: string }>> {
    const response = await fetch(`${this.baseUrl}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }
}

export const distributionApi = new DistributionApiService();
