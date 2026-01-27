import PDFDocument from 'pdfkit';
import type {
  DailySalesReport,
  CashReconReport,
  InventoryMovementReport,
  TransactionAuditLogReport,
  ShiftAggregationReport,
  DayClose,
} from '@pos/shared';
import { createWriteStream, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface PDFBuffers {
  sales: DailySalesReport | null;
  cash: CashReconReport | null;
  inventory: InventoryMovementReport | null;
  audit: TransactionAuditLogReport | null;
  shifts: ShiftAggregationReport | null;
  dayClose: DayClose | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const pdfExportService = {
  async generateAllReportsPDF(buffers: PDFBuffers): Promise<Buffer> {
    const tempDir = '/tmp';
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPath = join(tempDir, `eod-report-${Date.now()}.pdf`);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const writeStream = doc.pipe(createWriteStream(tempPath));

    const { sales, cash, inventory, audit, shifts, dayClose } = buffers;

    if (!dayClose) {
      doc.fontSize(20).text('Day Close Report Not Found', 50, 50);
      doc.end();
      return Buffer.from('Day Close Report Not Found');
    }

    doc.fontSize(24).text('MAJUMAPAN', 50, 50, { align: 'center' });
    doc.fontSize(16).text('DAY CLOSE REPORT', 50, 80, { align: 'center' });

    doc.moveTo(50, 105).lineTo(545, 105).stroke();

    doc.fontSize(12);
    doc.text(`Date: ${formatDate(dayClose.operationalDate)}`, 50, 120);
    doc.text(`Store: ${dayClose.storeName || 'Unknown Store'}`, 50, 140);
    doc.text(`Day Close #: ${dayClose.dayCloseNumber}`, 50, 160);
    doc.text(`Closed By: ${dayClose.closedByUserName || 'N/A'}`, 50, 180);
    doc.text(`Closed At: ${formatTime(String(dayClose.closedAt))}`, 50, 200);

    doc.addPage();

    doc.fontSize(18).text('1. SUMMARY', 50, 50);
    doc.moveTo(50, 70).lineTo(545, 70).stroke();

    doc.fontSize(12);
    let y = 90;

    doc.font('Helvetica-Bold').text('Overview', 50, y);
    doc.font('Helvetica').text(`Total Transactions: ${dayClose.totalTransactions}`, 70, y + 20);
    doc.text(`Completed: ${dayClose.completedTransactions}`, 70, y + 40);
    doc.text(`Voided: ${dayClose.voidedTransactions}`, 70, y + 60);

    y += 100;
    doc.font('Helvetica-Bold').text('Revenue', 50, y);
    doc.font('Helvetica').text(`Total Sales: ${formatCurrency(Number(dayClose.totalSales))}`, 70, y + 20);
    doc.text(`Cash Revenue: ${formatCurrency(Number(dayClose.cashRevenue))}`, 70, y + 40);
    doc.text(`Card Revenue: ${formatCurrency(Number(dayClose.cardRevenue))}`, 70, y + 60);

    if (sales) {
      doc.addPage();
      doc.fontSize(18).text('2. DAILY SALES', 50, 50);
      doc.moveTo(50, 70).lineTo(545, 70).stroke();

      doc.fontSize(12);
      y = 90;

      doc.font('Helvetica-Bold').text('Revenue Summary', 50, y);
      doc.font('Helvetica').text(`Gross Sales: ${formatCurrency(sales.revenue.grossSales)}`, 70, y + 20);
      doc.text(`Refunds: ${formatCurrency(sales.revenue.refunds)}`, 70, y + 40);
      doc.text(`Discounts: ${formatCurrency(sales.revenue.discounts)}`, 70, y + 60);
      doc.text(`Net Revenue: ${formatCurrency(sales.revenue.netRevenue)}`, 70, y + 80);

      y += 120;
      doc.font('Helvetica-Bold').text('Payment Methods', 50, y);
      doc.font('Helvetica').text(`Cash: ${formatCurrency(sales.paymentMethods.cash)} (${sales.paymentMethods.cashPercentage}%)`, 70, y + 20);
      doc.text(`Card: ${formatCurrency(sales.paymentMethods.card)} (${sales.paymentMethods.cardPercentage}%)`, 70, y + 40);

      y += 80;
      doc.font('Helvetica-Bold').text('Top Products', 50, y);
      doc.font('Helvetica').text(`Sold by Quantity`, 70, y + 20);
      sales.topProducts.forEach((product, i) => {
        y += 20;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(`${i + 1}. ${product.productName}: ${product.quantitySold} sold`, 70, y);
      });
    }

    if (cash) {
      doc.addPage();
      doc.fontSize(18).text('3. CASH RECONCILIATION', 50, 50);
      doc.moveTo(50, 70).lineTo(545, 70).stroke();

      doc.fontSize(12);
      y = 90;

      doc.font('Helvetica-Bold').text('Cash Handling', 50, y);
      doc.font('Helvetica').text(`Opening Float: ${formatCurrency(cash.cashHandling.openingFloat)}`, 70, y + 20);
      doc.text(`Cash Sales: ${formatCurrency(cash.cashHandling.cashSales)}`, 70, y + 40);
      doc.text(`Cash Refunds: ${formatCurrency(cash.cashHandling.cashRefunds)}`, 70, y + 60);
      doc.text(`Expected Cash: ${formatCurrency(cash.cashHandling.expectedCash)}`, 70, y + 80);

      y += 110;
      doc.font('Helvetica-Bold').text('Summary', 50, y);
      doc.font('Helvetica').text(`Total Expected: ${formatCurrency(cash.summary.totalExpected)}`, 70, y + 20);
      doc.text(`Total Actual: ${formatCurrency(cash.summary.totalActual)}`, 70, y + 40);
      doc.text(`Total Variance: ${formatCurrency(cash.summary.totalVariance)}`, 70, y + 60);

      y += 90;
      doc.font('Helvetica-Bold').text('Shift Breakdown', 50, y);
      cash.shifts.forEach((shift) => {
        y += 20;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.font('Helvetica').text(`${shift.cashierName}: Opening ${formatCurrency(shift.openingFloat)}, Closing ${formatCurrency(shift.closingCash)}, Variance ${formatCurrency(shift.variance)}`, 70, y);
      });
    }

    if (inventory) {
      doc.addPage();
      doc.fontSize(18).text('4. INVENTORY MOVEMENT', 50, 50);
      doc.moveTo(50, 70).lineTo(545, 70).stroke();

      doc.fontSize(12);
      y = 90;

      doc.font('Helvetica-Bold').text('Items Sold', 50, y);
      doc.font('Helvetica').text(`Top selling items by quantity`, 70, y + 20);
      inventory.itemsSold.forEach((item, i) => {
        y += 20;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(`${i + 1}. ${item.productName}: ${item.quantitySold} sold`, 70, y);
      });

      y += 40;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.font('Helvetica-Bold').text('Low Stock Alerts', 50, y);
      doc.font('Helvetica').text(`Items below reorder threshold`, 70, y + 20);
      inventory.lowStockAlerts.forEach((item, i) => {
        y += 20;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(`${item.productName}: ${item.currentStock} remaining (threshold: ${item.threshold})`, 70, y);
      });
    }

    if (audit && audit.transactions.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('5. TRANSACTIONS', 50, 50);
      doc.moveTo(50, 70).lineTo(545, 70).stroke();

      doc.fontSize(10);
      y = 90;

      doc.font('Helvetica-Bold');
      doc.text('#', 50, y);
      doc.text('Time', 90, y);
      doc.text('Cashier', 140, y);
      doc.text('Items', 230, y);
      doc.text('Total', 270, y);
      doc.text('Payment', 320, y);
      doc.text('Status', 380, y);
      doc.moveTo(50, y + 15).lineTo(545, y + 15).stroke();

      y += 20;
      doc.font('Helvetica');

      audit.transactions.forEach((txn) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
          doc.font('Helvetica-Bold');
          doc.text('#', 50, y);
          doc.text('Time', 90, y);
          doc.text('Cashier', 140, y);
          doc.text('Items', 230, y);
          doc.text('Total', 270, y);
          doc.text('Payment', 320, y);
          doc.text('Status', 380, y);
          doc.moveTo(50, y + 15).lineTo(545, y + 15).stroke();
          y += 20;
          doc.font('Helvetica');
        }
        doc.text(txn.transactionNumber, 50, y);
        doc.text(formatTime(txn.timestamp), 90, y);
        doc.text(txn.cashierName || 'N/A', 140, y);
        doc.text('', 230, y);
        doc.text(formatCurrency(txn.amount), 270, y);
        doc.text(txn.paymentMethod, 320, y);
        doc.text(txn.status, 380, y);
        y += 15;
      });
    }

    if (shifts) {
      doc.addPage();
      doc.fontSize(18).text('6. SHIFTS', 50, 50);
      doc.moveTo(50, 70).lineTo(545, 70).stroke();

      doc.fontSize(12);
      y = 90;

      doc.font('Helvetica-Bold').text('Daily Totals', 50, y);
      doc.font('Helvetica').text(`Total Sales: ${formatCurrency(shifts.dailyTotals.totalSales)}`, 70, y + 20);
      doc.text(`Total Transactions: ${shifts.dailyTotals.totalTransactions}`, 70, y + 40);
      doc.text(`Combined Variance: ${formatCurrency(shifts.dailyTotals.combinedVariance)}`, 70, y + 60);

      y += 90;
      doc.font('Helvetica-Bold').text('Shift Details', 50, y);
      shifts.shifts.forEach((shift) => {
        y += 20;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.font('Helvetica').text(`${shift.cashierName}: Sales ${formatCurrency(shift.sales)}, Transactions ${shift.transactions}, Variance ${formatCurrency(shift.variance)}`, 70, y);
      });
    }

    doc.fontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, doc.page.height - 40);

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      writeStream.on('finish', () => {
        try {
          const buffer = readFileSync(tempPath);
          unlinkSync(tempPath);
          resolve(buffer);
        } catch (e) {
          reject(e);
        }
      });
      writeStream.on('error', (e) => {
        try {
          if (existsSync(tempPath)) {
            unlinkSync(tempPath);
          }
        } catch {}
        reject(e);
      });
    });
  },
};

export default pdfExportService;
