import { db } from '../db';
import { messageTemplates, distributionHistory } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  message: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateTemplateInput {
  name: string;
  subject?: string;
  message: string;
  isDefault?: boolean;
}

interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  message?: string;
  isDefault?: boolean;
}

interface DistributionInput {
  voucherId: string;
  channel: 'whatsapp' | 'email' | 'print';
  recipients: Array<{
    phone?: string;
    email?: string;
    name?: string;
  }>;
  templateId: string;
  createdBy: string;
}

export const distributionService = {
  // Template Management
  async getTemplates() {
    return await db.query.messageTemplates.findMany({
      orderBy: [desc(messageTemplates.createdAt)],
    });
  },

  async getTemplateById(id: string) {
    const template = await db.query.messageTemplates.findFirst({
      where: eq(messageTemplates.id, id),
    });
    return template || null;
  },

  async getDefaultTemplate() {
    const template = await db.query.messageTemplates.findFirst({
      where: eq(messageTemplates.isDefault, true),
    });
    return template || null;
  },

  async createTemplate(input: CreateTemplateInput) {
    // If this is marked as default, unset other defaults
    if (input.isDefault) {
      await db.update(messageTemplates)
        .set({ isDefault: false })
        .where(eq(messageTemplates.isDefault, true));
    }

    const [template] = await db.insert(messageTemplates).values({
      name: input.name,
      subject: input.subject || null,
      message: input.message,
      isDefault: input.isDefault || false,
    }).returning();

    return template;
  },

  async updateTemplate(id: string, input: UpdateTemplateInput) {
    // If this is marked as default, unset other defaults
    if (input.isDefault) {
      await db.update(messageTemplates)
        .set({ isDefault: false })
        .where(eq(messageTemplates.isDefault, true));
    }

    const [template] = await db.update(messageTemplates)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.message && { message: input.message }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      })
      .where(eq(messageTemplates.id, id))
      .returning();

    return template;
  },

  async deleteTemplate(id: string) {
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
    return true;
  },

  // Link Generation
  generateWhatsAppLink(phone: string, message: string): string {
    const cleanPhone = phone.replace(/^0/, '62'); // Convert 08xx to 62xx
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  },

  generateEmailLink(
    emails: string[],
    subject: string,
    body: string
  ): string {
    return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  // Template Rendering
  renderTemplate(
    template: string,
    data: {
      name?: string;
      code?: string;
      discount?: string;
      expires?: string;
      store_name?: string;
    }
  ): string {
    let result = template;
    
    if (data.name) {
      result = result.replace(/\{name\}/g, data.name);
    }
    if (data.code) {
      result = result.replace(/\{code\}/g, data.code);
    }
    if (data.discount) {
      result = result.replace(/\{discount\}/g, data.discount);
    }
    if (data.expires) {
      result = result.replace(/\{expires\}/g, data.expires);
    }
    if (data.store_name) {
      result = result.replace(/\{store_name\}/g, data.store_name);
    }

    return result;
  },

  // Format voucher discount for template
  formatDiscount(voucher: {
    type: string;
    discountType?: string | null;
    percentageValue?: string | null;
    fixedValue?: string | null;
    currentBalance?: string | null;
  }): string {
    if (voucher.type === 'GC') {
      return `Rp ${Number(voucher.currentBalance || 0).toLocaleString('id-ID')}`;
    }
    
    switch (voucher.discountType) {
      case 'PERCENTAGE':
        return `${voucher.percentageValue}% OFF`;
      case 'FIXED':
        return `Rp ${Number(voucher.fixedValue || 0).toLocaleString('id-ID')} OFF`;
      case 'FREE_ITEM':
        return 'FREE ITEM';
      default:
        return 'Discount';
    }
  },

  // Distribution History
  async getDistributionHistory(limit = 50) {
    return await db.query.distributionHistory.findMany({
      orderBy: [desc(distributionHistory.createdAt)],
      limit,
    });
  },

  async recordDistribution(input: DistributionInput) {
    const [record] = await db.insert(distributionHistory).values({
      voucherId: input.voucherId,
      channel: input.channel,
      recipientCount: input.recipients.length,
      createdBy: input.createdBy,
    }).returning();

    return record;
  },

  // Generate distribution links
  async generateDistributionLinks(
    recipients: Array<{ phone?: string; email?: string; name?: string }>,
    template: MessageTemplate,
    voucher: {
      code: string;
      type: string;
      discountType?: string | null;
      percentageValue?: string | null;
      fixedValue?: string | null;
      expiresAt?: Date | string | null;
    },
    storeName = 'Majumapan'
  ): Promise<Array<{ channel: string; link: string; recipient: string }>> {
    const links: Array<{ channel: string; link: string; recipient: string }> = [];
    
    const discount = this.formatDiscount(voucher);
    const expires = voucher.expiresAt 
      ? new Date(voucher.expiresAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'No expiration';

    const subject = this.renderTemplate(template.subject || '', {
      name: '',
      code: voucher.code,
      discount,
      expires,
      store_name: storeName,
    });

    const message = this.renderTemplate(template.message, {
      name: '{name}', // Keep placeholder for individual names
      code: voucher.code,
      discount,
      expires,
      store_name: storeName,
    });

    for (const recipient of recipients) {
      const personalizedMessage = this.renderTemplate(message, {
        name: recipient.name || 'Customer',
        code: voucher.code,
        discount,
        expires,
        store_name: storeName,
      });

      const personalizedSubject = this.renderTemplate(subject, {
        name: recipient.name || 'Customer',
        code: voucher.code,
        discount,
        expires,
        store_name: storeName,
      });

      if (recipient.phone) {
        links.push({
          channel: 'whatsapp',
          link: this.generateWhatsAppLink(recipient.phone, personalizedMessage),
          recipient: recipient.phone,
        });
      }

      if (recipient.email) {
        links.push({
          channel: 'email',
          link: this.generateEmailLink([recipient.email], personalizedSubject, personalizedMessage),
          recipient: recipient.email,
        });
      }
    }

    return links;
  },
};
