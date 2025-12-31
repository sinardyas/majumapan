import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, truncate, generateId } from '../lib/utils';

describe('cn', () => {
  it('joins class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const condition = true;
    expect(cn('base', condition ? 'active' : '')).toBe('base active');
    const falseCondition = false;
    expect(cn('base', falseCondition ? 'active' : '')).toBe('base');
  });

  it('merges tailwind classes', () => {
    expect(cn('p-2 p-4')).toBe('p-4');
    expect(cn('text-red-500 text-blue-500')).toBe('text-blue-500');
  });
});

describe('formatCurrency', () => {
  it('formats number as USD by default', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });

  it('formats with custom currency', () => {
    expect(formatCurrency(100, 'EUR', 'de-DE')).toContain('100');
  });

  it('handles decimals', () => {
    expect(formatCurrency(99.99)).toContain('99');
  });
});

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('formats Date object', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });
});

describe('truncate', () => {
  it('returns original string if shorter than length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('generateId', () => {
  it('generates a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });

  it('generates ids of reasonable length', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(20);
  });
});
