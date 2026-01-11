import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.DEVICE_ENCRYPTION_KEY || 'default-32-byte-encryption-key-!!';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

interface EncryptedData {
  iv: string;
  encryptedData: string;
}

export function encryptDeviceToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
    iv
  );
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const encryptedData: EncryptedData = {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
  
  return JSON.stringify(encryptedData);
}

export function decryptDeviceToken(encryptedString: string): { deviceId: string; createdAt?: number } {
  try {
    const parsed = JSON.parse(encryptedString) as EncryptedData;
    
    if (!parsed.iv || !parsed.encryptedData) {
      throw new Error('Invalid encrypted data format');
    }
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      Buffer.from(parsed.iv, 'hex')
    );
    
    let decrypted = decipher.update(parsed.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt device token');
  }
}

export function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createDeviceTokenPayload(deviceId: string, createdAt?: number): string {
  const payload = {
    deviceId,
    createdAt: createdAt || Date.now(),
  };
  
  return JSON.stringify(payload);
}
