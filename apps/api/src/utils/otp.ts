import crypto from 'crypto';

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function verifyOTP(inputOTP: string, storedHash: string): boolean {
  return hashOTP(inputOTP) === storedHash;
}

export interface OTPStore {
  storeCode: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
}

const OTP_CACHE = new Map<string, OTPStore>();
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

export function setOTP(storeCode: string, otp: string): OTPStore {
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  const store: OTPStore = {
    storeCode,
    otpHash,
    expiresAt,
    attempts: 0,
  };
  
  OTP_CACHE.set(storeCode, store);
  
  return store;
}

export function verifyOTPRequest(storeCode: string, inputOTP: string): { success: boolean; expired: boolean; attemptsRemaining: number; error?: string } {
  const otpStore = OTP_CACHE.get(storeCode);
  
  if (!otpStore) {
    return { success: false, expired: true, attemptsRemaining: 0, error: 'OTP not found or expired' };
  }
  
  if (new Date() > otpStore.expiresAt) {
    OTP_CACHE.delete(storeCode);
    return { success: false, expired: true, attemptsRemaining: 0, error: 'OTP has expired' };
  }
  
  otpStore.attempts += 1;
  const attemptsRemaining = MAX_OTP_ATTEMPTS - otpStore.attempts;
  
  if (otpStore.attempts > MAX_OTP_ATTEMPTS) {
    OTP_CACHE.delete(storeCode);
    return { success: false, expired: false, attemptsRemaining: 0, error: 'Maximum attempts exceeded' };
  }
  
  if (!verifyOTP(inputOTP, otpStore.otpHash)) {
    return { success: false, expired: false, attemptsRemaining, error: 'Invalid OTP' };
  }
  
  OTP_CACHE.delete(storeCode);
  return { success: true, expired: false, attemptsRemaining };
}

export function getOTPExpiry(storeCode: string): Date | null {
  const otpStore = OTP_CACHE.get(storeCode);
  return otpStore?.expiresAt || null;
}

export function getOTPAttemptsRemaining(storeCode: string): number {
  const otpStore = OTP_CACHE.get(storeCode);
  if (!otpStore) return 0;
  return Math.max(0, MAX_OTP_ATTEMPTS - otpStore.attempts);
}

export function resendOTP(storeCode: string, newOTP: string): OTPStore | null {
  const existingStore = OTP_CACHE.get(storeCode);
  if (!existingStore) return null;
  
  return setOTP(storeCode, newOTP);
}

export function clearOTP(storeCode: string): void {
  OTP_CACHE.delete(storeCode);
}

export function getOTPExpiryMinutes(): number {
  return OTP_EXPIRY_MINUTES;
}

export function getMaxOTPAttempts(): number {
  return MAX_OTP_ATTEMPTS;
}
