import type {
  DailySalesReport,
  CashReconReport,
  InventoryMovementReport,
  TransactionAuditLogReport,
  ShiftAggregationReport,
} from '@pos/shared';

export const csvExportService = {
  generateDailySalesCSV(report: DailySalesReport): string {
    const lines: string[] = [];
    
    lines.push(`"DAILY SALES REPORT - ${report.operationalDate}"`);
    lines.push('');
    lines.push('OVERVIEW');
    lines.push(`"Total Transactions","${report.overview.totalTransactions}"`);
    lines.push(`"Completed Transactions","${report.overview.completedTransactions}"`);
    lines.push(`"Voided Transactions","${report.overview.voidedTransactions}"`);
    lines.push('');
    lines.push('REVENUE');
    lines.push(`"Gross Sales","${report.revenue.grossSales.toFixed(2)}"`);
    lines.push(`"Refunds","${report.revenue.refunds.toFixed(2)}"`);
    lines.push(`"Discounts","${report.revenue.discounts.toFixed(2)}"`);
    lines.push(`"Net Revenue","${report.revenue.netRevenue.toFixed(2)}"`);
    lines.push('');
    lines.push('PAYMENT METHODS');
    lines.push(`"Cash","${report.paymentMethods.cash.toFixed(2)}","${report.paymentMethods.cashPercentage}%"`);
    lines.push(`"Card","${report.paymentMethods.card.toFixed(2)}","${report.paymentMethods.cardPercentage}%"`);
    lines.push('');
    lines.push('SALES BY HOUR');
    lines.push('"Period","Amount"');
    report.salesByHour.forEach(hour => {
      lines.push(`"${hour.period}","${hour.amount.toFixed(2)}"`);
    });
    lines.push('');
    lines.push('TOP PRODUCTS');
    lines.push('"Product","Quantity Sold"');
    report.topProducts.forEach(product => {
      lines.push(`"${product.productName}","${product.quantitySold}"`);
    });
    
    return lines.join('\n');
  },

  generateCashReconCSV(report: CashReconReport): string {
    const lines: string[] = [];
    
    lines.push(`"CASH RECONCILIATION REPORT - ${report.operationalDate}"`);
    lines.push('');
    lines.push('CASH HANDLING');
    lines.push(`"Opening Float","${report.cashHandling.openingFloat.toFixed(2)}"`);
    lines.push(`"Cash Sales","${report.cashHandling.cashSales.toFixed(2)}"`);
    lines.push(`"Cash Refunds","${report.cashHandling.cashRefunds.toFixed(2)}"`);
    lines.push(`"Paid Outs","${report.cashHandling.paidOuts.toFixed(2)}"`);
    lines.push(`"Expected Cash","${report.cashHandling.expectedCash.toFixed(2)}"`);
    lines.push('');
    lines.push('SHIFT BREAKDOWN');
    lines.push('"Shift ID","Cashier","Opening Float","Closing Cash","Variance","Status"');
    report.shifts.forEach(shift => {
      lines.push(`"${shift.shiftId}","${shift.cashierName}","${shift.openingFloat.toFixed(2)}","${shift.closingCash.toFixed(2)}","${shift.variance.toFixed(2)}","${shift.status}"`);
    });
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`"Total Expected","${report.summary.totalExpected.toFixed(2)}"`);
    lines.push(`"Total Actual","${report.summary.totalActual.toFixed(2)}"`);
    lines.push(`"Total Variance","${report.summary.totalVariance.toFixed(2)}"`);
    lines.push(`"Status","${report.summary.status}"`);
    
    return lines.join('\n');
  },

  generateInventoryCSV(report: InventoryMovementReport): string {
    const lines: string[] = [];
    
    lines.push(`"INVENTORY MOVEMENT REPORT - ${report.operationalDate}"`);
    lines.push('');
    lines.push('ITEMS SOLD');
    lines.push('"Product","Quantity Sold"');
    report.itemsSold.forEach(item => {
      lines.push(`"${item.productName}","${item.quantitySold}"`);
    });
    lines.push('');
    lines.push('LOW STOCK ALERTS');
    lines.push('"Product","Current Stock","Threshold"');
    report.lowStockAlerts.forEach(item => {
      lines.push(`"${item.productName}","${item.currentStock}","${item.threshold}"`);
    });
    lines.push('');
    lines.push('REORDER RECOMMENDATIONS');
    lines.push('"Product","Recommended Quantity","Reason"');
    report.reorderRecommendations.forEach(item => {
      lines.push(`"${item.productName}","${item.recommendedQuantity}","${item.reason}"`);
    });
    
    return lines.join('\n');
  },

  generateAuditLogCSV(report: TransactionAuditLogReport): string {
    const lines: string[] = [];
    
    lines.push(`"TRANSACTION AUDIT LOG - ${report.operationalDate}"`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`"Total Transactions","${report.summary.totalTransactions}"`);
    lines.push(`"Total Volume","${report.summary.totalVolume.toFixed(2)}"`);
    lines.push(`"Void Count","${report.summary.voidCount}"`);
    lines.push('');
    lines.push('TRANSACTIONS');
    lines.push('"Transaction Number","Timestamp","Amount","Payment Method","Cashier","Status"');
    report.transactions.forEach(txn => {
      lines.push(`"${txn.transactionNumber}","${txn.timestamp}","${txn.amount.toFixed(2)}","${txn.paymentMethod}","${txn.cashierName}","${txn.status}"`);
    });
    
    return lines.join('\n');
  },

  generateShiftAggregationCSV(report: ShiftAggregationReport): string {
    const lines: string[] = [];
    
    lines.push(`"SHIFT AGGREGATION REPORT - ${report.operationalDate}"`);
    lines.push('');
    lines.push('SHIFTS');
    lines.push('"Shift ID","Cashier ID","Cashier Name","Opened At","Closed At","Sales","Transactions","Opening Float","Closing Cash","Variance","Status"');
    report.shifts.forEach(shift => {
      lines.push(`"${shift.shiftId}","${shift.cashierId}","${shift.cashierName}","${shift.openedAt}","${shift.closedAt}","${shift.sales.toFixed(2)}","${shift.transactions}","${shift.openingFloat.toFixed(2)}","${shift.closingCash.toFixed(2)}","${shift.variance.toFixed(2)}","${shift.status}"`);
    });
    lines.push('');
    lines.push('DAILY TOTALS');
    lines.push(`"Total Sales","${report.dailyTotals.totalSales.toFixed(2)}"`);
    lines.push(`"Total Transactions","${report.dailyTotals.totalTransactions}"`);
    lines.push(`"Total Opening Float","${report.dailyTotals.totalOpeningFloat.toFixed(2)}"`);
    lines.push(`"Total Closing Cash","${report.dailyTotals.totalClosingCash.toFixed(2)}"`);
    lines.push(`"Combined Variance","${report.dailyTotals.combinedVariance.toFixed(2)}"`);
    lines.push(`"Status","${report.dailyTotals.status}"`);
    
    return lines.join('\n');
  },

  generateAllReportsCSV(
    sales: DailySalesReport,
    cash: CashReconReport,
    inventory: InventoryMovementReport,
    audit: TransactionAuditLogReport,
    shifts: ShiftAggregationReport
  ): string {
    const parts: string[] = [];
    
    parts.push(this.generateDailySalesCSV(sales));
    parts.push('\n\n========================================\n\n');
    parts.push(this.generateCashReconCSV(cash));
    parts.push('\n\n========================================\n\n');
    parts.push(this.generateInventoryCSV(inventory));
    parts.push('\n\n========================================\n\n');
    parts.push(this.generateAuditLogCSV(audit));
    parts.push('\n\n========================================\n\n');
    parts.push(this.generateShiftAggregationCSV(shifts));
    
    return parts.join('');
  },
};

export default csvExportService;
