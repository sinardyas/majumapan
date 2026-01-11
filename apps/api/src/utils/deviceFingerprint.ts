export interface DeviceFingerprint {
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface ParsedDeviceFingerprint {
  browser: string;
  os: string;
  screen: string;
  timezone: string;
  language: string;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export function getDeviceFingerprint(userAgent: string, screenInfo: {
  width: number;
  height: number;
  colorDepth: number;
}, timezone: string, language: string): DeviceFingerprint {
  return {
    userAgent,
    screen: `${screenInfo.width}x${screenInfo.height}`,
    timezone,
    language,
    platform: getOS(userAgent),
    colorDepth: screenInfo.colorDepth,
    deviceMemory: (globalThis.navigator as any)?.deviceMemory,
    hardwareConcurrency: globalThis.navigator?.hardwareConcurrency,
  };
}

export function fingerprintToHash(fingerprint: DeviceFingerprint): string {
  const data = JSON.stringify({
    userAgent: fingerprint.userAgent,
    screen: fingerprint.screen,
    timezone: fingerprint.timezone,
    language: fingerprint.language,
    platform: fingerprint.platform,
    colorDepth: fingerprint.colorDepth,
    deviceMemory: fingerprint.deviceMemory,
    hardwareConcurrency: fingerprint.hardwareConcurrency,
  });
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16);
}

export function parseDeviceFingerprint(fingerprint: DeviceFingerprint): ParsedDeviceFingerprint {
  return {
    browser: getBrowser(fingerprint.userAgent),
    os: fingerprint.platform,
    screen: fingerprint.screen,
    timezone: fingerprint.timezone,
    language: fingerprint.language,
    colorDepth: fingerprint.colorDepth,
    deviceMemory: fingerprint.deviceMemory,
    hardwareConcurrency: fingerprint.hardwareConcurrency,
  };
}

export function generateDeviceName(storeName: string, userAgent: string): string {
  const browser = getBrowser(userAgent);
  const date = new Date();
  const monthYear = date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  
  return `${storeName} - ${browser} - ${monthYear}`;
}

export function getBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident')) return 'IE';
  return 'Unknown';
}

export function getOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Unknown';
}

export function formatDeviceNameForDisplay(fingerprint: ParsedDeviceFingerprint): string {
  const parts = [fingerprint.browser, fingerprint.os];
  
  if (fingerprint.deviceMemory) {
    parts.push(`${fingerprint.deviceMemory}GB RAM`);
  }
  
  parts.push(fingerprint.screen);
  
  return parts.join(' | ');
}

export function areFingerprintsSimilar(
  fp1: DeviceFingerprint,
  fp2: DeviceFingerprint,
  tolerance: number = 2
): boolean {
  let matchCount = 0;
  let totalFields = 0;
  
  if (fp1.userAgent === fp2.userAgent) matchCount++;
  totalFields++;
  
  if (fp1.screen === fp2.screen) matchCount++;
  totalFields++;
  
  if (fp1.timezone === fp2.timezone) matchCount++;
  totalFields++;
  
  if (fp1.language === fp2.language) matchCount++;
  totalFields++;
  
  if (fp1.platform === fp2.platform) matchCount++;
  totalFields++;
  
  if (fp1.colorDepth === fp2.colorDepth) matchCount++;
  totalFields++;
  
  if (fp1.deviceMemory === fp2.deviceMemory) matchCount++;
  totalFields++;
  
  if (fp1.hardwareConcurrency === fp2.hardwareConcurrency) matchCount++;
  totalFields++;
  
  return matchCount >= totalFields - tolerance;
}
