import { db } from '../db';
import { 
  dayCloses, 
  dayCloseShifts, 
  transactions, 
  transactionItems,
  shifts,
  stock as stocks,
  products
} from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { 
  DailySalesReport,
  CashReconReport,
  InventoryMovementReport,
  TransactionAuditLogReport,
  ShiftAggregationReport
} from '@pos/shared';

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}

export const dayCloseService = {
  async getDailySalesReport(dayCloseId: string): Promise<DailySalesReport | null> {
    const dayCloseRecord = await db.query.dayCloses.findFirst({
      where: eq(dayCloses.id, dayCloseId),
    });

    if (!dayCloseRecord) return null;

    const dayClose = dayCloseRecord as any;
    const storeId = dayClose.storeId;

    const periodTransactions = await db
      .select({
        id: transactions.id,
        createdAt: transactions.createdAt,
        total: transactions.total,
        paymentMethod: transactions.paymentMethod,
        status: transactions.status,
      })
      .from(transactions)
      .where(eq(transactions.storeId, storeId))
      .orderBy(transactions.createdAt);

    let cashRevenue = 0;
    let cardRevenue = 0;

    periodTransactions.forEach((txn) => {
      if (txn.status === 'completed') {
        const amount = toNumber(txn.total);
        if (txn.paymentMethod === 'cash') {
          cashRevenue += amount;
        } else if (txn.paymentMethod === 'card') {
          cardRevenue += amount;
        }
      }
    });

    const totalSales = cashRevenue + cardRevenue;
    const cashPercentage = totalSales > 0 ? (cashRevenue / totalSales) * 100 : 0;
    const cardPercentage = totalSales > 0 ? (cardRevenue / totalSales) * 100 : 0;

    const salesByHour = Array.from({ length: 24 }, (_, i) => ({
      period: `${i.toString().padStart(2, '0')}:00`,
      amount: 0,
    }));

    periodTransactions.forEach((txn) => {
      if (txn.status === 'completed') {
        const hour = new Date(txn.createdAt).getHours();
        salesByHour[hour].amount += toNumber(txn.total);
      }
    });

    const topProductsResult = await db
      .select({
        productName: transactionItems.productName,
        quantitySold: sql<number>`sum(${transactionItems.quantity})`,
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.status, 'completed')
      ))
      .groupBy(transactionItems.productName)
      .orderBy(desc(sql`sum(${transactionItems.quantity})`))
      .limit(10);

    return {
      dayCloseId,
      operationalDate: dayClose.operationalDate,
      periodStart: dayClose.periodStart?.toISOString() || '',
      periodEnd: dayClose.periodEnd?.toISOString() || '',
      overview: {
        totalTransactions: dayClose.totalTransactions || 0,
        completedTransactions: dayClose.completedTransactions || 0,
        voidedTransactions: dayClose.voidedTransactions || 0,
      },
      revenue: {
        grossSales: toNumber(dayClose.totalSales),
        refunds: toNumber(dayClose.totalRefunds),
        discounts: toNumber(dayClose.totalDiscounts),
        netRevenue: toNumber(dayClose.totalSales) - toNumber(dayClose.totalRefunds) - toNumber(dayClose.totalDiscounts),
      },
      paymentMethods: {
        cash: cashRevenue,
        cashPercentage: Math.round(cashPercentage * 100) / 100,
        card: cardRevenue,
        cardPercentage: Math.round(cardPercentage * 100) / 100,
      },
      salesByHour,
      topProducts: topProductsResult.map((p) => ({
        productName: p.productName,
        quantitySold: Number(p.quantitySold) || 0,
      })),
    };
  },

  async getCashReconReport(dayCloseId: string): Promise<CashReconReport | null> {
    const dayCloseRecord = await db.query.dayCloses.findFirst({
      where: eq(dayCloses.id, dayCloseId),
      with: {
        shifts: true,
      },
    });

    if (!dayCloseRecord) return null;

    const dayClose = dayCloseRecord as any;
    const storeId = dayClose.storeId;
    const shiftsData = dayClose.shifts || [];

    const periodTransactions = await db
      .select({
        total: transactions.total,
        paymentMethod: transactions.paymentMethod,
        status: transactions.status,
        amountPaid: transactions.amountPaid,
      })
      .from(transactions)
      .where(eq(transactions.storeId, storeId));

    const cashTransactions = periodTransactions.filter(
      (t) => t.status === 'completed' && t.paymentMethod === 'cash'
    );

    const totalCashSales = cashTransactions.reduce((sum, t) => sum + toNumber(t.total), 0);
    const totalCashRefunds = periodTransactions
      .filter((t) => t.status === 'completed' && t.paymentMethod === 'cash')
      .reduce((sum, t) => {
        const refundAmount = toNumber(t.total);
        const paidAmount = toNumber(t.amountPaid);
        return sum + Math.max(0, refundAmount - paidAmount);
      }, 0);

    const totalExpected = shiftsData.reduce((sum: number, s: any) => sum + (s.openingFloat || 0), 0);
    const totalActual = shiftsData.reduce((sum: number, s: any) => sum + (s.closingCash || 0), 0);
    const totalVariance = toNumber(dayClose.totalVariance);

    const shiftSummaries = shiftsData.map((shift: any) => ({
      shiftId: shift.shiftId,
      cashierName: shift.cashierName || '',
      openedAt: '',
      closedAt: '',
      sales: (shift.closingCash || 0) - (shift.openingFloat || 0) + (shift.variance || 0),
      transactions: 0,
      openingFloat: shift.openingFloat || 0,
      closingCash: shift.closingCash || 0,
      variance: shift.variance || 0,
      status: shift.variance === 0 ? 'Balanced' : 'Variance',
    }));

    return {
      dayCloseId,
      operationalDate: dayClose.operationalDate,
      cashHandling: {
        openingFloat: totalExpected,
        cashSales: totalCashSales,
        cashRefunds: totalCashRefunds,
        paidOuts: 0,
        expectedCash: totalExpected + totalCashSales - totalCashRefunds,
      },
      shifts: shiftSummaries,
      summary: {
        totalExpected,
        totalActual,
        totalVariance,
        status: Math.abs(totalVariance) < 5 ? 'Within tolerance' : 'Requires review',
      },
    };
  },

  async getInventoryMovementReport(dayCloseId: string): Promise<InventoryMovementReport | null> {
    const dayCloseRecord = await db.query.dayCloses.findFirst({
      where: eq(dayCloses.id, dayCloseId),
    });

    if (!dayCloseRecord) return null;

    const dayClose = dayCloseRecord as any;
    const storeId = dayClose.storeId;

    const itemsSoldResult = await db
      .select({
        productId: transactionItems.productId,
        productName: transactionItems.productName,
        quantitySold: sql<number>`sum(${transactionItems.quantity})`,
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .where(and(
        eq(transactions.storeId, storeId),
        eq(transactions.status, 'completed')
      ))
      .groupBy(transactionItems.productId, transactionItems.productName)
      .orderBy(desc(sql`sum(${transactionItems.quantity})`));

    const lowStockItems = await db
      .select({
        productId: stocks.productId,
        productName: products.name,
        currentStock: stocks.quantity,
        lowStockThreshold: stocks.lowStockThreshold,
      })
      .from(stocks)
      .innerJoin(products, eq(stocks.productId, products.id))
      .where(and(
        eq(stocks.storeId, storeId),
        sql`${stocks.quantity} <= ${stocks.lowStockThreshold}`
      ));

    const reorderRecommendations = lowStockItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      recommendedQuantity: Math.max(10, (item.lowStockThreshold || 10) * 2 - (item.currentStock || 0)),
      reason: `Current stock (${item.currentStock}) below threshold (${item.lowStockThreshold})`,
    }));

    return {
      dayCloseId,
      operationalDate: dayClose.operationalDate,
      itemsSold: itemsSoldResult.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantitySold: Number(item.quantitySold) || 0,
      })),
      lowStockAlerts: lowStockItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        currentStock: item.currentStock || 0,
        threshold: item.lowStockThreshold || 0,
      })),
      reorderRecommendations,
    };
  },

  async getTransactionAuditLogReport(dayCloseId: string): Promise<TransactionAuditLogReport | null> {
    const dayCloseRecord = await db.query.dayCloses.findFirst({
      where: eq(dayCloses.id, dayCloseId),
    });

    if (!dayCloseRecord) return null;

    const dayClose = dayCloseRecord as any;
    const storeId = dayClose.storeId;

    const periodTransactions = await db
      .select({
        transactionNumber: transactions.transactionNumber,
        createdAt: transactions.createdAt,
        total: transactions.total,
        paymentMethod: transactions.paymentMethod,
        status: transactions.status,
      })
      .from(transactions)
      .where(eq(transactions.storeId, storeId))
      .orderBy(transactions.createdAt);

    const voidTransactions = periodTransactions.filter((t) => t.status === 'voided');

    const totalVolume = periodTransactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + toNumber(t.total), 0);

    return {
      dayCloseId,
      operationalDate: dayClose.operationalDate,
      transactions: periodTransactions.map((txn) => ({
        transactionNumber: txn.transactionNumber,
        timestamp: txn.createdAt.toISOString(),
        amount: toNumber(txn.total),
        paymentMethod: txn.paymentMethod || 'unknown',
        cashierName: '',
        status: txn.status,
      })),
      summary: {
        totalTransactions: periodTransactions.length,
        totalVolume,
        voidCount: voidTransactions.length,
        voidTransactionNumbers: voidTransactions.map((t) => t.transactionNumber),
      },
    };
  },

  async getShiftAggregationReport(dayCloseId: string): Promise<ShiftAggregationReport | null> {
    const dayCloseRecord = await db.query.dayCloses.findFirst({
      where: eq(dayCloses.id, dayCloseId),
      with: {
        shifts: true,
      },
    });

    if (!dayCloseRecord) return null;

    const dayClose = dayCloseRecord as any;
    const shiftsData = dayClose.shifts || [];

    const totalOpeningFloat = shiftsData.reduce((sum: number, s: any) => sum + (s.openingFloat || 0), 0);
    const totalClosingCash = shiftsData.reduce((sum: number, s: any) => sum + (s.closingCash || 0), 0);
    const totalVariance = toNumber(dayClose.totalVariance);

    const shiftDetails = shiftsData.map((shift: any) => ({
      shiftId: shift.shiftId,
      cashierId: shift.cashierId,
      cashierName: shift.cashierName || '',
      openedAt: '',
      closedAt: '',
      sales: (shift.closingCash || 0) - (shift.openingFloat || 0) + (shift.variance || 0),
      transactions: 0,
      openingFloat: shift.openingFloat || 0,
      closingCash: shift.closingCash || 0,
      variance: shift.variance || 0,
      status: shift.variance === 0 ? 'Balanced' : 'Variance',
    }));

    return {
      dayCloseId,
      operationalDate: dayClose.operationalDate,
      shifts: shiftDetails,
      dailyTotals: {
        totalSales: toNumber(dayClose.totalSales),
        totalTransactions: dayClose.totalTransactions || 0,
        totalOpeningFloat,
        totalClosingCash,
        combinedVariance: totalVariance,
        status: Math.abs(totalVariance) < 5 ? 'Within tolerance' : 'Requires review',
      },
    };
  },
};

export default dayCloseService;
