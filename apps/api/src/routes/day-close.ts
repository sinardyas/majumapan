import { Hono } from 'hono';
import { z } from 'zod';
import { db, appSettings } from '../db';
import { dayCloses, dayCloseShifts, operationalDays, pendingCartsQueue, shifts, transactions, stores, users } from '../db/schema';
import { eq, and, gte, lte, desc, asc, or, sql, isNull } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import type { JwtPayload } from '@pos/shared';
import { dayCloseService } from '../services/day-close-service';
import { csvExportService } from '../services/csv-export-service';
import { pdfExportService } from '../services/pdf-export-service';
import { emailService } from '../services/email-service';

const dayCloseRouter = new Hono();

async function getEODSettings() {
  const [startHourResult, autoTransitionResult] = await Promise.all([
    db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'eod_operational_day_start_hour'),
    }),
    db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'eod_allow_auto_transition'),
    }),
  ]);

  return {
    operationalDayStartHour: parseInt(startHourResult?.value || '6'),
    allowAutoDayTransition: autoTransitionResult?.value === 'true',
  };
}

const previewQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  timezoneOffset: z.coerce.number().optional(),
  allStores: z.coerce.boolean().optional().default(false),
});

const executeBodySchema = z.object({
  storeId: z.string().uuid(),
  operationalDate: z.string(),
  pendingCarts: z.array(z.object({
    cartId: z.string(),
    storeId: z.string(),
    cashierId: z.string(),
    customerName: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      productName: z.string(),
      productSku: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      subtotal: z.number(),
    })),
    subtotal: z.number(),
    taxAmount: z.number(),
    total: z.number(),
    createdAt: z.string(),
  })).optional(),
});

const historyQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  allStores: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET /api/v1/day-close/preview
dayCloseRouter.get(
  '/preview',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const query = c.req.query();
      const validation = previewQuerySchema.safeParse(query);

      if (!validation.success) {
        return c.json({ success: false, error: 'Invalid query parameters' }, 400);
      }

      const { storeId: queryStoreId, allStores, timezoneOffset } = validation.data;

      // Preview requires a specific store - reject allStores mode
      if (allStores) {
        return c.json({
          success: false,
          error: 'Preview requires a specific store. Please select a store.',
        }, 400);
      }

      // Determine the store ID to use
      let effectiveStoreId = queryStoreId;
      if (!effectiveStoreId) {
        const user = c.get('user');
        if (user.storeId) {
          effectiveStoreId = user.storeId;
        } else {
          return c.json({ success: false, error: 'storeId is required' }, 400);
        }
      }

      // Get store name
      const store = await db.query.stores.findFirst({
        where: eq(stores.id, effectiveStoreId),
      });

      const today = new Date();
      const { operationalDayStartHour } = await getEODSettings();

      // Calculate local hours based on timezone offset from frontend
      const utcHours = today.getUTCHours();
      const offsetMinutes = timezoneOffset ? Number(timezoneOffset) : 0;
      const localHours = (utcHours * 60 + offsetMinutes) / 60;

      const operationalDate = localHours < operationalDayStartHour
        ? new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0]
        : today.toISOString().split('T')[0];

      const periodStart = new Date(operationalDate);
      periodStart.setHours(operationalDayStartHour, 0, 0, 0);

      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);

      const periodTransactions = await db.select()
        .from(transactions)
        .where(and(
          eq(transactions.storeId, effectiveStoreId),
          gte(transactions.createdAt, periodStart),
          lte(transactions.createdAt, periodEnd)
        ));

      let totalSales = 0;
      let cashRevenue = 0;
      let cardRevenue = 0;
      let totalRefunds = 0;
      let totalDiscounts = 0;
      let completedCount = 0;
      let voidedCount = 0;

      for (const txn of periodTransactions) {
        if (txn.status === 'completed') {
          completedCount++;
          const txnTotal = Number(txn.total || 0);
          totalSales += txnTotal;
          if (txn.paymentMethod === 'cash') {
            cashRevenue += txnTotal;
          } else if (txn.paymentMethod === 'card') {
            cardRevenue += txnTotal;
          }
          totalDiscounts += Number(txn.discountAmount || 0);
        } else if (txn.status === 'voided') {
          voidedCount++;
        }
      }

      const transactionCount = periodTransactions.length;

      const shiftsData = await db.query.shifts.findMany({
        where: and(
          eq(shifts.storeId, effectiveStoreId),
          or(
            and(
              gte(shifts.openingTimestamp, periodStart),
              lte(shifts.openingTimestamp, periodEnd)
            ),
            eq(shifts.status, 'ACTIVE')
          )
        ),
        orderBy: [asc(shifts.openingTimestamp)],
      });

      const pendingTransactions = await db.$count(
        transactions,
        and(
          eq(transactions.storeId, effectiveStoreId),
          eq(transactions.syncStatus, 'pending')
        )
      );

      const totalVariance = shiftsData.reduce((sum, shift) => {
        return sum + (Number(shift.variance) || 0);
      }, 0);

      return c.json({
        success: true,
        data: {
          storeId: effectiveStoreId,
          storeName: store?.name || 'Unknown Store',
          operationalDate,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          transactions: {
            total: transactionCount,
            completed: completedCount,
            voided: voidedCount,
          },
          revenue: {
            totalSales,
            cashRevenue,
            cardRevenue,
            refunds: totalRefunds,
            discounts: totalDiscounts,
          },
          shifts: {
            activeCount: shiftsData.filter(s => s.status === 'ACTIVE').length,
            totalVariance,
            shifts: shiftsData.map(s => ({
              shiftId: s.id,
              cashierId: s.cashierId,
              status: s.status,
            })),
          },
          syncStatus: {
            pendingTransactions,
            pendingCarts: 0,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching pre-EOD summary:', error);
      return c.json({ success: false, error: 'Failed to fetch pre-EOD summary' }, 500);
    }
  }
);

// POST /api/v1/day-close/execute
dayCloseRouter.post(
  '/execute',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const body = await c.req.json();
      const validation = executeBodySchema.safeParse(body);
      
      if (!validation.success) {
        return c.json({ success: false, error: 'Invalid request body' }, 400);
      }
      
      const user = c.get('user') as JwtPayload;
      const { storeId, operationalDate, pendingCarts } = validation.data;
      
      const { operationalDayStartHour } = await getEODSettings();
      const date = new Date(operationalDate);
      const periodStart = new Date(date);
      periodStart.setHours(operationalDayStartHour, 0, 0, 0);
      
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);
      
      const periodTransactions = await db.select()
        .from(transactions)
        .where(and(
          eq(transactions.storeId, storeId),
          gte(transactions.createdAt, periodStart),
          lte(transactions.createdAt, periodEnd)
        ));
      
      let summary = { total: 0, completed: 0, voided: 0, totalSales: 0, cashRevenue: 0, cardRevenue: 0 };
      for (const txn of periodTransactions) {
        if (txn.status === 'completed') {
          summary.completed++;
          summary.totalSales += Number(txn.total || 0);
          summary.cashRevenue += txn.paymentMethod === 'cash' ? Number(txn.total || 0) : 0;
          summary.cardRevenue += txn.paymentMethod === 'card' ? Number(txn.total || 0) : 0;
        } else if (txn.status === 'voided') {
          summary.voided++;
        }
        summary.total++;
      }

      const periodShifts = await db.select()
        .from(shifts)
        .where(and(
          eq(shifts.storeId, storeId),
          or(
            and(
              gte(shifts.openingTimestamp, periodStart),
              lte(shifts.openingTimestamp, periodEnd)
            ),
            and(
              lte(shifts.openingTimestamp, periodStart),
              or(
                gte(shifts.closingTimestamp, periodStart),
                isNull(shifts.closingTimestamp)
              )
            )
          )
        ));

      const pendingCount = periodTransactions.filter(t => t.syncStatus === 'pending').length;

      const dateStr = operationalDate.replace(/-/g, '');
      const uniqueId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const dayCloseNumber = `DC-${dateStr}-${uniqueId}`;

      const result = await db.transaction(async (tx) => {
        const [operationalDayRecord] = await tx.insert(operationalDays).values({
          storeId,
          operationalDate,
          periodStart,
          periodEnd,
          status: 'CLOSED',
          closedByUserId: user.userId,
          closedByUserName: '',
          closedAt: new Date(),
        }).returning({ id: operationalDays.id });

        const [dayCloseRecord] = await tx.insert(dayCloses).values({
          storeId,
          operationalDayId: operationalDayRecord.id,
          operationalDate,
          dayCloseNumber,
          periodStart,
          periodEnd,
          totalTransactions: summary.total,
          completedTransactions: summary.completed,
          voidedTransactions: summary.voided,
          totalSales: summary.totalSales,
          cashRevenue: summary.cashRevenue,
          cardRevenue: summary.cardRevenue,
          totalRefunds: 0,
          totalDiscounts: 0,
          totalVariance: 0,
          pendingTransactionsAtClose: pendingCount,
          syncStatus: pendingCount > 0 ? 'warning' : 'clean',
          closedByUserId: user.userId,
          closedByUserName: '',
          closedAt: new Date(),
        } as any).returning({ id: dayCloses.id });

        const dayCloseId = dayCloseRecord.id;

        for (const shift of periodShifts) {
          const cashier = await tx.query.users.findFirst({
            where: eq(users.id, shift.cashierId),
          });

          await tx.insert(dayCloseShifts).values({
            dayCloseId,
            shiftId: shift.id,
            cashierId: shift.cashierId,
            cashierName: cashier?.name || shift.cashierId,
            openingFloat: Number(shift.openingFloat),
            closingCash: Number(shift.endingCash || 0),
            variance: Number(shift.variance || 0),
          } as any);

          if (shift.status === 'ACTIVE') {
            await tx.update(shifts)
              .set({
                status: 'CLOSED',
                closingTimestamp: periodEnd,
              })
              .where(eq(shifts.id, shift.id));
          }
        }

        if (pendingCarts && pendingCarts.length > 0) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          for (const cart of pendingCarts) {
            await tx.insert(pendingCartsQueue).values({
              storeId,
              cartId: cart.cartId,
              cartData: JSON.stringify(cart),
              operationalDate,
              expiresAt,
            });
          }
        }

        return {
          dayCloseId,
          dayCloseNumber,
          operationalDate,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          totalTransactions: summary.total,
          completedTransactions: summary.completed,
          voidedTransactions: summary.voided,
          totalSales: summary.totalSales,
          cashRevenue: summary.cashRevenue,
          cardRevenue: summary.cardRevenue,
          totalRefunds: 0,
          totalDiscounts: 0,
          totalVariance: 0,
          pendingTransactionsAtClose: pendingCount,
          syncStatus: pendingCount > 0 ? 'warning' : 'clean',
          closedByUserId: user.userId,
          closedByUserName: '',
          closedAt: new Date().toISOString(),
        };
      });

      return c.json({ success: true, data: result });
    } catch (error) {
      console.error('Error executing EOD:', error);
      return c.json({ success: false, error: 'Failed to execute EOD' }, 500);
    }
  }
);

// GET /api/v1/day-close/history
dayCloseRouter.get(
  '/history',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const query = c.req.query();
      const validation = historyQuerySchema.safeParse(query);

      if (!validation.success) {
        return c.json({ success: false, error: 'Invalid query parameters' }, 400);
      }

      const user = c.get('user');
      const { storeId, allStores, page, pageSize } = validation.data;

      // Fetch day closes based on mode
      let dayClosesData;
      if (allStores && user.role === 'admin') {
        // For "All Stores" mode, query without where clause
        dayClosesData = await db.query.dayCloses.findMany({
          orderBy: [desc(dayCloses.closedAt)],
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
      } else {
        // For specific store
        const storeFilter = storeId || user.storeId;
        if (!storeFilter) {
          return c.json({
            success: false,
            error: 'Store access denied. Please contact administrator.',
          }, 403);
        }
        dayClosesData = await db.query.dayCloses.findMany({
          where: eq(dayCloses.storeId, storeFilter),
          orderBy: [desc(dayCloses.closedAt)],
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
      }

      // Count total
      const effectiveStoreId = storeId || user.storeId;
      const total = allStores && user.role === 'admin'
        ? await db.$count(dayCloses)
        : effectiveStoreId
          ? await db.$count(dayCloses, eq(dayCloses.storeId, effectiveStoreId))
          : 0;

      return c.json({
        success: true,
        data: {
          dayCloses: dayClosesData,
          total,
          page,
          pageSize,
          isAllStores: allStores && user.role === 'admin',
        },
      });
    } catch (error) {
      console.error('Error fetching day close history:', error);
      return c.json({ success: false, error: 'Failed to fetch history' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id
  dayCloseRouter.get(
    '/:id',
    authMiddleware,
    requireRole('manager', 'admin'),
    async (c) => {
      try {
        const dayCloseId = c.req.param('id');

        const dayClose = await db.query.dayCloses.findFirst({
          where: eq(dayCloses.id, dayCloseId),
          with: {
            shifts: true,
          },
        });

        if (!dayClose) {
          return c.json({ success: false, error: 'Day close not found' }, 404);
        }

        // Get store name
        const store = await db.query.stores.findFirst({
          where: eq(stores.id, dayClose.storeId),
        });

        return c.json({
          success: true,
          data: {
            ...dayClose,
            storeName: store?.name || 'Unknown Store',
          },
        });
      } catch (error) {
        console.error('Error fetching day close:', error);
        return c.json({ success: false, error: 'Failed to fetch day close' }, 500);
      }
    }
  );

// GET /api/v1/day-close/:id/report/sales
dayCloseRouter.get(
  '/:id/report/sales',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getDailySalesReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      return c.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating sales report:', error);
      return c.json({ success: false, error: 'Failed to generate report' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/report/cash
dayCloseRouter.get(
  '/:id/report/cash',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getCashReconReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      return c.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating cash recon report:', error);
      return c.json({ success: false, error: 'Failed to generate report' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/report/inventory
dayCloseRouter.get(
  '/:id/report/inventory',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getInventoryMovementReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      return c.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating inventory report:', error);
      return c.json({ success: false, error: 'Failed to generate report' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/report/audit
dayCloseRouter.get(
  '/:id/report/audit',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getTransactionAuditLogReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      return c.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating audit report:', error);
      return c.json({ success: false, error: 'Failed to generate report' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/report/shifts
dayCloseRouter.get(
  '/:id/report/shifts',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getShiftAggregationReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      return c.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating shift report:', error);
      return c.json({ success: false, error: 'Failed to generate report' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/csv/sales
dayCloseRouter.get(
  '/:id/export/csv/sales',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getDailySalesReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      const csv = csvExportService.generateDailySalesCSV(report);
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sales-report-${report.operationalDate}.csv"`,
      });
    } catch (error) {
      console.error('Error exporting sales CSV:', error);
      return c.json({ success: false, error: 'Failed to export CSV' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/csv/cash
dayCloseRouter.get(
  '/:id/export/csv/cash',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getCashReconReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      const csv = csvExportService.generateCashReconCSV(report);
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="cash-recon-${report.operationalDate}.csv"`,
      });
    } catch (error) {
      console.error('Error exporting cash recon CSV:', error);
      return c.json({ success: false, error: 'Failed to export CSV' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/csv/inventory
dayCloseRouter.get(
  '/:id/export/csv/inventory',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getInventoryMovementReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      const csv = csvExportService.generateInventoryCSV(report);
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-${report.operationalDate}.csv"`,
      });
    } catch (error) {
      console.error('Error exporting inventory CSV:', error);
      return c.json({ success: false, error: 'Failed to export CSV' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/csv/audit
dayCloseRouter.get(
  '/:id/export/csv/audit',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getTransactionAuditLogReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      const csv = csvExportService.generateAuditLogCSV(report);
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-log-${report.operationalDate}.csv"`,
      });
    } catch (error) {
      console.error('Error exporting audit CSV:', error);
      return c.json({ success: false, error: 'Failed to export CSV' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/csv/shifts
dayCloseRouter.get(
  '/:id/export/csv/shifts',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const report = await dayCloseService.getShiftAggregationReport(dayCloseId);
      
      if (!report) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      const csv = csvExportService.generateShiftAggregationCSV(report);
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="shifts-${report.operationalDate}.csv"`,
      });
    } catch (error) {
      console.error('Error exporting shifts CSV:', error);
      return c.json({ success: false, error: 'Failed to export CSV' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/csv/all
dayCloseRouter.get(
  '/:id/export/csv/all',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      
      const [sales, cash, inventory, audit, shifts] = await Promise.all([
        dayCloseService.getDailySalesReport(dayCloseId),
        dayCloseService.getCashReconReport(dayCloseId),
        dayCloseService.getInventoryMovementReport(dayCloseId),
        dayCloseService.getTransactionAuditLogReport(dayCloseId),
        dayCloseService.getShiftAggregationReport(dayCloseId),
      ]);
      
      if (!sales || !cash || !inventory || !audit || !shifts) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      const csv = csvExportService.generateAllReportsCSV(sales, cash, inventory, audit, shifts);
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="eod-report-${sales.operationalDate}.csv"`,
      });
    } catch (error) {
      console.error('Error exporting all CSV:', error);
      return c.json({ success: false, error: 'Failed to export CSV' }, 500);
    }
  }
);

// POST /api/v1/day-close/:id/email
dayCloseRouter.post(
  '/:id/email',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const body = await c.req.json();
      const { recipients } = body;
      
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return c.json({ success: false, error: 'recipients array is required' }, 400);
      }
      
      const [dayCloseData, sales, cash, inventory, audit, shifts] = await Promise.all([
        db.query.dayCloses.findFirst({
          where: eq(dayCloses.id, dayCloseId),
          with: { store: true },
        }),
        dayCloseService.getDailySalesReport(dayCloseId),
        dayCloseService.getCashReconReport(dayCloseId),
        dayCloseService.getInventoryMovementReport(dayCloseId),
        dayCloseService.getTransactionAuditLogReport(dayCloseId),
        dayCloseService.getShiftAggregationReport(dayCloseId),
      ]);
      
      if (!dayCloseData) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      if (!sales) {
        return c.json({ success: false, error: 'Failed to generate sales report' }, 500);
      }

      const dayClose = {
        ...dayCloseData,
        storeName: (dayCloseData as any).store?.name || 'Unknown Store',
      } as any;

      const pdfBuffer = await pdfExportService.generateAllReportsPDF({
        sales,
        cash,
        inventory,
        audit,
        shifts,
        dayClose,
      });
      
      const success = await emailService.sendEODNotification(
        recipients,
        dayClose,
        sales,
        pdfBuffer
      );
      
      if (success) {
        return c.json({ success: true, message: 'Email sent successfully with PDF attachment' });
      } else {
        return c.json({ success: false, error: 'Failed to send email' }, 500);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return c.json({ success: false, error: 'Failed to send email' }, 500);
    }
  }
);

// GET /api/v1/day-close/sync-status
dayCloseRouter.get(
  '/sync-status',
  authMiddleware,
  async (c) => {
    try {
      const storeId = c.req.query('storeId');
      
      if (!storeId) {
        return c.json({ success: false, error: 'storeId is required' }, 400);
      }
      
      const pendingTransactions = await db.$count(
        transactions,
        and(
          eq(transactions.storeId, storeId),
          eq(transactions.syncStatus, 'pending')
        )
      );
      
      return c.json({
        success: true,
        data: {
          pendingTransactions,
          lastSyncAt: null,
        },
      });
    } catch (error) {
      console.error('Error fetching sync status:', error);
      return c.json({ success: false, error: 'Failed to fetch sync status' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/transactions
dayCloseRouter.get(
  '/:id/transactions',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');
      const query = c.req.query();
      
      const page = parseInt(query.page as string) || 1;
      const pageSize = parseInt(query.pageSize as string) || 25;
      const status = query.status as string || 'all';
      const paymentMethod = query.paymentMethod as string || 'all';
      const search = query.search as string || '';
      
      const result = await dayCloseService.getDayCloseTransactions(
        dayCloseId,
        { status, paymentMethod, search },
        { page, pageSize }
      );
      
      if (!result) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }
      
      return c.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return c.json({ success: false, error: 'Failed to fetch transactions' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/transactions/:txId
dayCloseRouter.get(
  '/:id/transactions/:txId',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const transactionId = c.req.param('txId');
      
      const result = await dayCloseService.getTransactionDetails(transactionId);
      
      if (!result) {
        return c.json({ success: false, error: 'Transaction not found' }, 404);
      }
      
      return c.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return c.json({ success: false, error: 'Failed to fetch transaction details' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/transactions/:txId/items
dayCloseRouter.get(
  '/:id/transactions/:txId/items',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const transactionId = c.req.param('txId');
      const query = c.req.query();
      
      const page = parseInt(query.page as string) || 1;
      const pageSize = parseInt(query.pageSize as string) || 20;
      
      const result = await dayCloseService.getTransactionItems(
        transactionId,
        { page, pageSize }
      );
      
      if (!result) {
        return c.json({ success: false, error: 'Transaction not found' }, 404);
      }
      
      return c.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching transaction items:', error);
      return c.json({ success: false, error: 'Failed to fetch transaction items' }, 500);
    }
  }
);

// GET /api/v1/day-close/:id/export/pdf/all
dayCloseRouter.get(
  '/:id/export/pdf/all',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (c) => {
    try {
      const dayCloseId = c.req.param('id');

      const [dayClose, sales, cash, inventory, audit, shifts] = await Promise.all([
        db.query.dayCloses.findFirst({
          where: eq(dayCloses.id, dayCloseId),
          with: {
            store: true,
          },
        }),
        dayCloseService.getDailySalesReport(dayCloseId),
        dayCloseService.getCashReconReport(dayCloseId),
        dayCloseService.getInventoryMovementReport(dayCloseId),
        dayCloseService.getTransactionAuditLogReport(dayCloseId),
        dayCloseService.getShiftAggregationReport(dayCloseId),
      ]);

      if (!dayClose) {
        return c.json({ success: false, error: 'Day close not found' }, 404);
      }

      const dayCloseWithStore = {
        ...dayClose,
        storeName: (dayClose as any).store?.name || 'Unknown Store',
      } as any;

      const pdfBuffer = await pdfExportService.generateAllReportsPDF({
        sales,
        cash,
        inventory,
        audit,
        shifts,
        dayClose: dayCloseWithStore,
      });

      const dateStr = dayClose.operationalDate.replace(/-/g, '');
      const filename = `eod-report-${dateStr}.pdf`;

      return c.body(new Uint8Array(pdfBuffer), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      return c.json({ success: false, error: 'Failed to export PDF' }, 500);
    }
  }
);

export { dayCloseRouter as default };
