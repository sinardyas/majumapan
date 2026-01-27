import { describe, it, expect } from 'vitest';
import { 
  generateVoucherCode, 
  generateCheckDigits, 
  validateCheckDigits, 
  parseVoucherCode,
  toNumber
} from './voucher-service';

describe('Voucher Code Generation', () => {
  describe('generateCheckDigits', () => {
    it('generates valid check digits for a given prefix', () => {
      const prefix = 'GC123456789012';
      const check = generateCheckDigits(prefix);
      expect(check).toHaveLength(2);
    });

    it('generates consistent check digits for the same input', () => {
      const prefix = 'GC123456789012';
      const check1 = generateCheckDigits(prefix);
      const check2 = generateCheckDigits(prefix);
      expect(check1).toBe(check2);
    });

    it('generates different check digits for different inputs', () => {
      const check1 = generateCheckDigits('GC123456789012');
      const check2 = generateCheckDigits('GC123456789013');
      expect(check1).not.toBe(check2);
    });
  });

  describe('validateCheckDigits', () => {
    it('returns true for a valid voucher code', () => {
      const code = generateVoucherCode('GC');
      expect(validateCheckDigits(code)).toBe(true);
    });

    it('returns true for a code without dashes', () => {
      const code = generateVoucherCode('GC').replace(/-/g, '');
      expect(validateCheckDigits(code)).toBe(true);
    });

    it('returns false for an invalid voucher code', () => {
      const code = generateVoucherCode('GC');
      const invalidCode = code.slice(0, -1) + 'X';
      expect(validateCheckDigits(invalidCode)).toBe(false);
    });
  });

  describe('generateVoucherCode', () => {
    it('generates a code with correct prefix for Gift Card', () => {
      const code = generateVoucherCode('GC');
      expect(code.startsWith('GC')).toBe(true);
    });

    it('generates a code with correct prefix for Promo', () => {
      const code = generateVoucherCode('PR');
      expect(code.startsWith('PR')).toBe(true);
    });

    it('generates a code in XXXX-XXXX-XXXX-XXXX format', () => {
      const code = generateVoucherCode('GC');
      const parts = code.split('-');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toHaveLength(4);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
    });

    it('generates unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateVoucherCode('GC'));
        codes.add(generateVoucherCode('PR'));
      }
      expect(codes.size).toBe(200);
    });

    it('generates valid check digits', () => {
      const gcCode = generateVoucherCode('GC');
      expect(validateCheckDigits(gcCode)).toBe(true);

      const prCode = generateVoucherCode('PR');
      expect(validateCheckDigits(prCode)).toBe(true);
    });
  });

  describe('parseVoucherCode', () => {
    it('parses a valid Gift Card code', () => {
      const code = generateVoucherCode('GC');
      const parsed = parseVoucherCode(code);
      expect(parsed.type).toBe('GC');
      expect(parsed.valid).toBe(true);
      expect(parsed.randomPart).toHaveLength(12);
    });

    it('parses a valid Promo code', () => {
      const code = generateVoucherCode('PR');
      const parsed = parseVoucherCode(code);
      expect(parsed.type).toBe('PR');
      expect(parsed.valid).toBe(true);
    });

    it('handles lowercase input', () => {
      const code = generateVoucherCode('GC').toLowerCase();
      const parsed = parseVoucherCode(code);
      expect(parsed.valid).toBe(true);
    });

    it('handles code with spaces', () => {
      const code = generateVoucherCode('GC').split('-').join(' ');
      const parsed = parseVoucherCode(code);
      expect(parsed.valid).toBe(true);
    });

    it('returns invalid for code with wrong length', () => {
      const parsed = parseVoucherCode('GC123');
      expect(parsed.valid).toBe(false);
    });
  });
});

describe('toNumber', () => {
  it('converts string number to number', () => {
    expect(toNumber('123.45')).toBe(123.45);
  });

  it('returns number as-is', () => {
    expect(toNumber(123.45)).toBe(123.45);
  });

  it('returns 0 for null', () => {
    expect(toNumber(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it('returns 0 for invalid string', () => {
    expect(toNumber('abc')).toBe(0);
  });

  it('handles empty string', () => {
    expect(toNumber('')).toBe(0);
  });
});
