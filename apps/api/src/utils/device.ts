const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateBindingCode(length: number = 6): string {
  const chars = CODE_CHARS;
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}

export function generateDeviceName(): string {
  const id = generateBindingCode(5);
  return `POS-${id}`;
}

export function calculateExpiryTime(expiresIn: 'never' | '24h' | '7d' | '30d'): Date | null {
  if (expiresIn === 'never') return null;
  
  const now = new Date();
  switch (expiresIn) {
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export interface QrCodeData {
  bindingCode: string;
  storeId: string;
  expiresAt: string | null;
}

export function createQrData(storeId: string, bindingCode: string, expiresAt: Date | null): string {
  const data: QrCodeData = {
    bindingCode,
    storeId,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
  return JSON.stringify(data);
}

export function parseQrData(qrData: string): QrCodeData | null {
  try {
    const data = JSON.parse(qrData);
    if (data.bindingCode && data.storeId) {
      return data as QrCodeData;
    }
    return null;
  } catch {
    return null;
  }
}
