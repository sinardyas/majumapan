import { Hono } from 'hono';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { db, stores, users, registeredDevices, deviceAuditLogs, appSettings, companies } from '../db';
import { generateOTP, setOTP, verifyOTPRequest, getOTPExpiry, getOTPAttemptsRemaining, resendOTP } from '../utils/otp';
import { encryptDeviceToken, decryptDeviceToken, hashDeviceToken, generateDeviceToken, createDeviceTokenPayload } from '../utils/encryption';
import { getDeviceFingerprint, fingerprintToHash, generateDeviceName } from '../utils/deviceFingerprint';

const devices = new Hono();

// Helper to get client IP
function getClientIP(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 
         c.req.header('x-real-ip') || 
         'unknown';
}

// Helper to get app setting
async function getAppSetting(key: string): Promise<string | null> {
  const setting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, key),
  });
  return setting?.value || null;
}

// Helper to create audit log
async function createDeviceAuditLog(deviceId: string, userId: string | null, action: string, details: object, ipAddress: string) {
  await db.insert(deviceAuditLogs).values({
    deviceId: deviceId as any,
    userId: userId as any,
    action: action as any,
    details: JSON.stringify(details),
    ipAddress,
  });
}

// POST /devices/register/init - Initiate device registration
devices.post('/register/init', async (c) => {
  try {
    const body = await c.req.json();
    const { storeCode } = body;

    if (!storeCode || storeCode.length < 3) {
      return c.json(
        { success: false, error: 'STORE_CODE_REQUIRED', message: 'Store code is required' },
        400
      );
    }

    const brandEmail = await getAppSetting('brand_email');
    if (!brandEmail) {
      return c.json(
        { success: false, error: 'BRAND_EMAIL_NOT_CONFIGURED', message: 'Brand email must be configured before device registration. Contact your administrator.' },
        400
      );
    }

    const store = await db.query.stores.findFirst({
      where: and(eq(stores.name, storeCode), eq(stores.isActive, true)),
    });

    if (!store) {
      return c.json(
        { success: false, error: 'STORE_NOT_FOUND', message: 'Store not found. Please check the store code.' },
        404
      );
    }

    const otp = generateOTP();
    setOTP(store.name, otp);

    console.log(`[Device Registration] OTP sent to ${brandEmail} for store: ${store.name}`);

    const expiresAt = getOTPExpiry(store.name);
    const attemptsRemaining = getOTPAttemptsRemaining(store.name);

    return c.json({
      success: true,
      data: {
        requiresOtp: true,
        message: 'OTP sent to brand email',
        expiresAt: expiresAt?.toISOString(),
        attemptsRemaining,
      },
    });
  } catch (error) {
    console.error('Device registration init error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /devices/register/verify - Verify OTP and complete device registration
devices.post('/register/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { storeCode, otp, deviceInfo } = body;

    if (!storeCode || !otp) {
      return c.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Store code and OTP are required' },
        400
      );
    }

    const store = await db.query.stores.findFirst({
      where: and(eq(stores.name, storeCode), eq(stores.isActive, true)),
    });

    if (!store) {
      return c.json(
        { success: false, error: 'STORE_NOT_FOUND', message: 'Store not found.' },
        404
      );
    }

    const otpResult = verifyOTPRequest(store.name, otp);

    if (otpResult.expired) {
      return c.json(
        { success: false, error: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' },
        400
      );
    }

    if (!otpResult.success) {
      return c.json(
        { success: false, error: 'INVALID_OTP', message: otpResult.error || 'Invalid OTP. Please try again.', attemptsRemaining: otpResult.attemptsRemaining },
        400
      );
    }

    let company = await db.query.companies.findFirst();
    if (!company) {
      return c.json(
        { success: false, error: 'BRAND_NOT_CONFIGURED', message: 'Brand not configured. Please set up the brand first.' },
        400
      );
    }

    const deviceToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(deviceToken);

    const fingerprint = deviceInfo ? getDeviceFingerprint(
      deviceInfo.userAgent || 'unknown',
      {
        width: parseInt(deviceInfo.screen?.split('x')[0]) || 0,
        height: parseInt(deviceInfo.screen?.split('x')[1]) || 0,
        colorDepth: deviceInfo.colorDepth || 24,
      },
      deviceInfo.timezone || 'unknown',
      deviceInfo.language || 'unknown'
    ) : null;

    const deviceName = generateDeviceName(store.name, deviceInfo?.userAgent || 'unknown');

    const [device] = await db.insert(registeredDevices).values({
      companyId: company.id,
      storeId: store.id,
      deviceTokenHash: tokenHash,
      deviceName,
      deviceFingerprint: fingerprint ? JSON.stringify(fingerprint) : null,
      ipAddress: getClientIP(c),
      isActive: false,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      approvalStatus: 'PENDING',
    }).returning();

    await createDeviceAuditLog(
      device.id,
      null,
      'REGISTERED',
      { storeCode, deviceName, fingerprint: fingerprint ? fingerprintToHash(fingerprint) : null },
      getClientIP(c)
    );

    return c.json({
      success: true,
      data: {
        deviceId: device.id,
        deviceToken: null,
        deviceName,
        approvalStatus: 'PENDING',
        message: 'Device registration submitted. Waiting for manager approval.',
      },
    });
  } catch (error) {
    console.error('Device registration verify error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /devices/register/resend - Resend OTP
devices.post('/register/resend', async (c) => {
  try {
    const body = await c.req.json();
    const { storeCode } = body;

    if (!storeCode) {
      return c.json(
        { success: false, error: 'STORE_CODE_REQUIRED', message: 'Store code is required' },
        400
      );
    }

    const store = await db.query.stores.findFirst({
      where: and(eq(stores.name, storeCode), eq(stores.isActive, true)),
    });

    if (!store) {
      return c.json(
        { success: false, error: 'STORE_NOT_FOUND', message: 'Store not found.' },
        404
      );
    }

    const newOTP = generateOTP();
    const result = resendOTP(store.name, newOTP);

    if (!result) {
      return c.json(
        { success: false, error: 'NO_PENDING_OTP', message: 'No pending OTP. Please start registration again.' },
        400
      );
    }

    const brandEmail = await getAppSetting('brand_email');
    console.log(`[Device Registration] OTP resent to ${brandEmail} for store: ${store.name}`);

    return c.json({
      success: true,
      data: {
        message: 'OTP resent to brand email',
        expiresAt: result.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Device registration resend error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Manager auth middleware
const managerAuth = async (c: any, next: any) => {
  const userId = c.req.header('x-user-id');
  const userRole = c.req.header('x-user-role');
  const storeId = c.req.header('x-user-store-id');

  if (!userId || (userRole !== 'manager' && userRole !== 'admin')) {
    return c.json(
      { success: false, error: 'NOT_AUTHORIZED', message: 'Only managers can perform this action.' },
      403
    );
  }

  (c as any).userId = userId;
  (c as any).userRole = userRole;
  (c as any).userStoreId = storeId;
  await next();
};

// POST /devices/approve - Manager approves/rejects pending device
devices.post('/approve', managerAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { deviceId, approve } = body;
    const userId = (c as any).userId;
    const userStoreId = (c as any).userStoreId;

    if (!deviceId || approve === undefined) {
      return c.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Device ID and approve status are required' },
        400
      );
    }

    const device = await db.query.registeredDevices.findFirst({
      where: eq(registeredDevices.id, deviceId),
    });

    if (!device) {
      return c.json(
        { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found.' },
        404
      );
    }

    if (device.storeId !== userStoreId && (c as any).userRole !== 'admin') {
      return c.json(
        { success: false, error: 'NOT_AUTHORIZED', message: 'You can only manage devices for your store.' },
        403
      );
    }

    if (device.approvalStatus !== 'PENDING') {
      return c.json(
        { success: false, error: 'NOT_PENDING', message: 'Device is not pending approval.' },
        400
      );
    }

    if (approve) {
      const deviceToken = generateDeviceToken();
      const deviceTokenPayload = createDeviceTokenPayload(device.id, Date.now());
      const encryptedToken = encryptDeviceToken(deviceTokenPayload);
      const tokenHash = hashDeviceToken(deviceToken);

      const expiryDays = parseInt(await getAppSetting('device_token_expiry_days') || '30');
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

      await db.update(registeredDevices)
        .set({
          deviceTokenHash: tokenHash,
          isActive: true,
          expiresAt,
          approvedByUserId: userId as any,
          approvalStatus: 'APPROVED',
          updatedAt: new Date(),
        })
        .where(eq(registeredDevices.id, deviceId));

      await createDeviceAuditLog(
        device.id,
        userId,
        'APPROVED',
        { expiresAt: expiresAt.toISOString() },
        getClientIP(c)
      );

      return c.json({
        success: true,
        data: {
          deviceId: device.id,
          deviceToken: encryptedToken,
          deviceName: device.deviceName,
          expiresAt: expiresAt.toISOString(),
          message: 'Device approved successfully.',
        },
      });
    } else {
      await db.update(registeredDevices)
        .set({
          isActive: false,
          approvalStatus: 'REJECTED',
          updatedAt: new Date(),
        })
        .where(eq(registeredDevices.id, deviceId));

      await createDeviceAuditLog(
        device.id,
        userId,
        'REJECTED',
        {},
        getClientIP(c)
      );

      return c.json({
        success: true,
        data: {
          deviceId: device.id,
          message: 'Device registration rejected.',
        },
      });
    }
  } catch (error) {
    console.error('Device approve error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /devices/pending - Get pending devices for manager's store
devices.get('/pending', managerAuth, async (c) => {
  try {
    const userStoreId = (c as any).userStoreId;

    const pendingDevices = await db.query.registeredDevices.findMany({
      where: and(
        eq(registeredDevices.storeId, userStoreId),
        eq(registeredDevices.approvalStatus, 'PENDING')
      ),
      orderBy: [desc(registeredDevices.createdAt)],
      limit: 50,
    });

    return c.json({
      success: true,
      data: pendingDevices.map(device => ({
        id: device.id,
        deviceName: device.deviceName,
        deviceFingerprint: device.deviceFingerprint ? JSON.parse(device.deviceFingerprint) : null,
        ipAddress: device.ipAddress,
        createdAt: device.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get pending devices error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /devices - Get all devices for manager's store
devices.get('/', managerAuth, async (c) => {
  try {
    const userStoreId = (c as any).userStoreId;
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const status = c.req.query('status');
    const search = c.req.query('search');

    const conditions: any[] = [eq(registeredDevices.storeId, userStoreId)];

    if (status === 'active') {
      conditions.push(eq(registeredDevices.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(registeredDevices.isActive, false));
    }

    if (search) {
      conditions.push(like(registeredDevices.deviceName, `%${search}%`));
    }

    const offset = (page - 1) * limit;

    const [devicesList, total] = await Promise.all([
      db.query.registeredDevices.findMany({
        where: and(...conditions),
        orderBy: [desc(registeredDevices.createdAt)],
        limit,
        offset,
      }),
      db.$count(registeredDevices, and(...conditions)),
    ]);

    const approverIds = devicesList.filter(d => d.approvedByUserId).map(d => d.approvedByUserId!);
    const approvers = approverIds.length > 0 ? await db.query.users.findMany({
      where: sql`${users.id} IN ${approverIds}`,
    }) : [];

    const approverMap = new Map(approvers.map(u => [u.id, u]));

    return c.json({
      success: true,
      data: devicesList.map(device => {
        const approver = device.approvedByUserId ? approverMap.get(device.approvedByUserId) : null;
        return {
          id: device.id,
          deviceName: device.deviceName,
          isActive: device.isActive,
          lastUsedAt: device.lastUsedAt,
          expiresAt: device.expiresAt,
          approvalStatus: device.approvalStatus,
          approvedBy: approver ? {
            id: approver.id,
            name: approver.name,
            email: approver.email,
          } : null,
          createdAt: device.createdAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get devices error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /devices/:id - Get device details
devices.get('/:id', managerAuth, async (c) => {
  try {
    const deviceId = c.req.param('id');
    const userStoreId = (c as any).userStoreId;

    const device = await db.query.registeredDevices.findFirst({
      where: eq(registeredDevices.id, deviceId),
    });

    if (!device) {
      return c.json(
        { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found.' },
        404
      );
    }

    if (device.storeId !== userStoreId && (c as any).userRole !== 'admin') {
      return c.json(
        { success: false, error: 'NOT_AUTHORIZED', message: 'You can only view devices for your store.' },
        403
      );
    }

    const approver = device.approvedByUserId ? await db.query.users.findFirst({
      where: eq(users.id, device.approvedByUserId),
    }) : null;

    const auditLogs = await db.query.deviceAuditLogs.findMany({
      where: eq(deviceAuditLogs.deviceId, device.id),
      orderBy: [desc(deviceAuditLogs.createdAt)],
      limit: 50,
    });

    return c.json({
      success: true,
      data: {
        id: device.id,
        deviceName: device.deviceName,
        deviceFingerprint: device.deviceFingerprint ? JSON.parse(device.deviceFingerprint) : null,
        ipAddress: device.ipAddress,
        isActive: device.isActive,
        lastUsedAt: device.lastUsedAt,
        expiresAt: device.expiresAt,
        approvalStatus: device.approvalStatus,
        approvedBy: approver ? {
          id: approver.id,
          name: approver.name,
          email: approver.email,
        } : null,
        createdAt: device.createdAt,
        auditLog: auditLogs.map(log => ({
          action: log.action,
          userId: log.userId,
          details: log.details,
          createdAt: log.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get device details error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /devices/:id - Rename device
devices.put('/:id', managerAuth, async (c) => {
  try {
    const deviceId = c.req.param('id');
    const body = await c.req.json();
    const { deviceName } = body;
    const userStoreId = (c as any).userStoreId;

    if (!deviceName || deviceName.length < 1 || deviceName.length > 100) {
      return c.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Device name must be 1-100 characters' },
        400
      );
    }

    const device = await db.query.registeredDevices.findFirst({
      where: eq(registeredDevices.id, deviceId),
    });

    if (!device) {
      return c.json(
        { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found.' },
        404
      );
    }

    if (device.storeId !== userStoreId && (c as any).userRole !== 'admin') {
      return c.json(
        { success: false, error: 'NOT_AUTHORIZED', message: 'You can only manage devices for your store.' },
        403
      );
    }

    await db.update(registeredDevices)
      .set({
        deviceName,
        updatedAt: new Date(),
      })
      .where(eq(registeredDevices.id, deviceId));

    await createDeviceAuditLog(
      device.id,
      (c as any).userId,
      'RENAMED',
      { oldName: device.deviceName, newName: deviceName },
      getClientIP(c)
    );

    return c.json({
      success: true,
      data: {
        id: device.id,
        deviceName,
      },
    });
  } catch (error) {
    console.error('Rename device error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /devices/:id/revoke - Revoke device access
devices.post('/:id/revoke', managerAuth, async (c) => {
  try {
    const deviceId = c.req.param('id');
    const body = await c.req.json();
    const { reason } = body || {};
    const userStoreId = (c as any).userStoreId;

    const device = await db.query.registeredDevices.findFirst({
      where: eq(registeredDevices.id, deviceId),
    });

    if (!device) {
      return c.json(
        { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found.' },
        404
      );
    }

    if (device.storeId !== userStoreId && (c as any).userRole !== 'admin') {
      return c.json(
        { success: false, error: 'NOT_AUTHORIZED', message: 'You can only manage devices for your store.' },
        403
      );
    }

    await db.update(registeredDevices)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(registeredDevices.id, deviceId));

    await createDeviceAuditLog(
      device.id,
      (c as any).userId,
      'REVOKED',
      { reason },
      getClientIP(c)
    );

    return c.json({
      success: true,
      data: {
        message: 'Device revoked successfully.',
      },
    });
  } catch (error) {
    console.error('Revoke device error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /devices/:id/transfer - Transfer device to another store
devices.post('/:id/transfer', managerAuth, async (c) => {
  try {
    const deviceId = c.req.param('id');
    const body = await c.req.json();
    const { targetStoreId } = body;
    const userId = (c as any).userId;
    const userStoreId = (c as any).userStoreId;

    if (!targetStoreId) {
      return c.json(
        { success: false, error: 'TARGET_STORE_REQUIRED', message: 'Target store ID is required' },
        400
      );
    }

    const device = await db.query.registeredDevices.findFirst({
      where: eq(registeredDevices.id, deviceId),
    });

    if (!device) {
      return c.json(
        { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found.' },
        404
      );
    }

    if (device.storeId !== userStoreId && (c as any).userRole !== 'admin') {
      return c.json(
        { success: false, error: 'NOT_AUTHORIZED', message: 'You can only manage devices for your store.' },
        403
      );
    }

    const targetStore = await db.query.stores.findFirst({
      where: eq(stores.id, targetStoreId),
    });

    if (!targetStore) {
      return c.json(
        { success: false, error: 'TARGET_STORE_INVALID', message: 'Target store not found.' },
        404
      );
    }

    if (!targetStore.isActive) {
      return c.json(
        { success: false, error: 'TARGET_STORE_INACTIVE', message: 'Target store is inactive.' },
        400
      );
    }

    await db.update(registeredDevices)
      .set({
        storeId: targetStoreId,
        isActive: false,
        approvalStatus: 'PENDING',
        updatedAt: new Date(),
      })
      .where(eq(registeredDevices.id, deviceId));

    await createDeviceAuditLog(
      device.id,
      userId,
      'TRANSFERRED',
      { fromStoreId: device.storeId, toStoreId: targetStoreId, toStoreName: targetStore.name },
      getClientIP(c)
    );

    return c.json({
      success: true,
      data: {
        message: `Device transferred to ${targetStore.name}. Manager approval required at new store.`,
      },
    });
  } catch (error) {
    console.error('Transfer device error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /devices/my - Get current device status
devices.get('/my', async (c) => {
  try {
    const deviceToken = c.req.header('x-device-token');

    if (!deviceToken) {
      return c.json(
        { success: false, error: 'DEVICE_NOT_REGISTERED', message: 'Device token is required.' },
        401
      );
    }

    try {
      const tokenData = decryptDeviceToken(deviceToken);
      const device = await db.query.registeredDevices.findFirst({
        where: eq(registeredDevices.id, tokenData.deviceId),
      });

      if (!device) {
        return c.json(
          { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found.' },
          404
        );
      }

      const store = await db.query.stores.findFirst({
        where: eq(stores.id, device.storeId),
      });

      if (device.approvalStatus === 'PENDING') {
        return c.json(
          { success: false, error: 'DEVICE_PENDING_APPROVAL', message: 'Device is waiting for manager approval.' },
          403
        );
      }

      if (device.approvalStatus === 'REJECTED') {
        return c.json(
          { success: false, error: 'DEVICE_REJECTED', message: 'Device registration was rejected.' },
          403
        );
      }

      if (!device.isActive) {
        return c.json(
          { success: false, error: 'DEVICE_REVOKED', message: 'Device access has been revoked.' },
          403
        );
      }

      if (new Date() > device.expiresAt) {
        return c.json(
          { success: false, error: 'DEVICE_EXPIRED', message: 'Device registration has expired.' },
          403
        );
      }

      await db.update(registeredDevices)
        .set({ lastUsedAt: new Date() })
        .where(eq(registeredDevices.id, device.id));

      return c.json({
        success: true,
        data: {
          deviceId: device.id,
          deviceName: device.deviceName,
          storeId: device.storeId,
          storeName: store?.name || 'Unknown',
          isActive: device.isActive,
          expiresAt: device.expiresAt.toISOString(),
          approvalStatus: device.approvalStatus,
        },
      });
    } catch (decryptError) {
      return c.json(
        { success: false, error: 'INVALID_DEVICE_TOKEN', message: 'Device token is invalid or expired.' },
        401
      );
    }
  } catch (error) {
    console.error('Get device status error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default devices;
