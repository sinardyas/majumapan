import type { DayClose, DailySalesReport } from '@pos/shared';

interface EmailAttachment {
  filename: string;
  content: Buffer | Uint8Array;
  contentType: string;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

const getConfig = (): EmailConfig => ({
  smtpHost: process.env.SMTP_HOST || 'smtp.example.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  fromEmail: process.env.FROM_EMAIL || 'pos@company.com',
  fromName: process.env.FROM_NAME || 'POS System',
});

export const emailService = {
  async sendEODNotification(
    recipients: string[],
    dayClose: DayClose,
    salesReport: DailySalesReport,
    pdfBuffer?: Buffer | Uint8Array
  ): Promise<boolean> {
    const config = getConfig();
    
    if (!config.smtpUser || !recipients.length) {
      console.log('[Email] EOD Notification - Config not set or no recipients, skipping');
      return false;
    }

    const subject = `[POS Alert] Day Closed - ${dayClose.operationalDate}`;
    
    const htmlBody = this.generateEODEmailHTML(dayClose, salesReport);
    const textBody = this.generateEODEmailText(dayClose, salesReport);

    const attachments: EmailAttachment[] = [];
    if (pdfBuffer) {
      const dateStr = dayClose.operationalDate.replace(/-/g, '');
      attachments.push({
        filename: `eod-report-${dateStr}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    try {
      for (const recipient of recipients) {
        await this.sendEmail(config, recipient, subject, textBody, htmlBody, attachments);
      }
      console.log(`[Email] EOD notification sent to ${recipients.length} recipients`);
      if (attachments.length > 0) {
        console.log(`[Email] PDF attachment included`);
      }
      return true;
    } catch (error) {
      console.error('[Email] Failed to send EOD notification:', error);
      return false;
    }
  },

  async sendEmail(
    config: EmailConfig,
    to: string,
    subject: string,
    textBody: string,
    htmlBody: string,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    const body: Record<string, any> = {
      from: `${config.fromName} <${config.fromEmail}>`,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    };

    if (attachments && attachments.length > 0) {
      body.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        contentType: att.contentType,
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY || ''}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }
  },

  generateEODEmailHTML(dayClose: DayClose, sales: DailySalesReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day Close Notification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .summary-item { background: white; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .summary-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Day Closed Successfully</h1>
      <p>${dayClose.operationalDate}</p>
    </div>
    <div class="content">
      <p>End of Day has been completed for the following day:</p>
      
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${dayClose.dayCloseNumber}</div>
          <div class="summary-label">Day Close #</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${dayClose.totalTransactions}</div>
          <div class="summary-label">Transactions</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">$${Number(dayClose.totalSales).toFixed(2)}</div>
          <div class="summary-label">Total Sales</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${dayClose.completedTransactions}</div>
          <div class="summary-label">Completed</div>
        </div>
      </div>
      
      <h3>Payment Breakdown</h3>
      <p>
        <strong>Cash:</strong> $${Number(dayClose.cashRevenue).toFixed(2)}<br>
        <strong>Card:</strong> $${Number(dayClose.cardRevenue).toFixed(2)}
      </p>
      
      <h3>Summary</h3>
      <ul>
        <li>Completed Transactions: ${dayClose.completedTransactions}</li>
        <li>Voided Transactions: ${dayClose.voidedTransactions}</li>
        <li>Total Variance: $${Number(dayClose.totalVariance).toFixed(2)}</li>
      </ul>
      
      <p>
        View detailed reports in the POS Admin Panel:
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/day-close/${dayClose.id}">
          View Report
        </a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message from the POS System.</p>
      <p>Store ID: ${dayClose.storeId}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  generateEODEmailText(dayClose: DayClose, sales: DailySalesReport): string {
    return `
END OF DAY SUMMARY
==================
Store: ${dayClose.storeId}
Operational Date: ${dayClose.operationalDate}
Day Close #: ${dayClose.dayCloseNumber}
Closed At: ${dayClose.closedAt?.toString() || 'N/A'}

TRANSACTIONS
- Total: ${dayClose.totalTransactions}
- Completed: ${dayClose.completedTransactions}
- Voided: ${dayClose.voidedTransactions}

REVENUE
- Total Sales: $${Number(dayClose.totalSales).toFixed(2)}
- Cash: $${Number(dayClose.cashRevenue).toFixed(2)}
- Card: $${Number(dayClose.cardRevenue).toFixed(2)}
- Refunds: $${Number(dayClose.totalRefunds).toFixed(2)}
- Discounts: $${Number(dayClose.totalDiscounts).toFixed(2)}

VARIANCE
- Total Variance: $${Number(dayClose.totalVariance).toFixed(2)}
- Status: ${dayClose.syncStatus}

View detailed reports in the POS Admin Panel:
${process.env.APP_URL || 'http://localhost:3000'}/admin/day-close/${dayClose.id}

---
This is an automated message from the POS System.
    `.trim();
  },
};

export default emailService;
