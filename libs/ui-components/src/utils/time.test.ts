import { describe, it, expect } from 'vitest';
import { isUpdateCronRepresentable } from './time';

describe('isUpdateCronRepresentable', () => {
  it('returns true for undefined', () => {
    expect(isUpdateCronRepresentable(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isUpdateCronRepresentable('')).toBe(true);
  });

  it('returns true for valid simple daily cron', () => {
    expect(isUpdateCronRepresentable('0 2 * * *')).toBe(true);
  });

  it('returns true for valid weekly cron with specific days', () => {
    expect(isUpdateCronRepresentable('30 14 * * 1,3,5')).toBe(true);
  });

  it('returns true for valid cron with all weekdays', () => {
    expect(isUpdateCronRepresentable('0 0 * * 0,1,2,3,4,5,6')).toBe(true);
  });

  it('returns false for hour range', () => {
    expect(isUpdateCronRepresentable('0 0-9 * * *')).toBe(false);
  });

  it('returns false for weekday range', () => {
    expect(isUpdateCronRepresentable('0 2 * * 1-5')).toBe(false);
  });

  it('returns false for weekday step', () => {
    expect(isUpdateCronRepresentable('0 2 * * */2')).toBe(false);
  });

  it('returns false for specific day-of-month', () => {
    expect(isUpdateCronRepresentable('0 2 1 * *')).toBe(false);
  });

  it('returns false for specific month', () => {
    expect(isUpdateCronRepresentable('0 2 * 6 *')).toBe(false);
  });

  it('returns false for weekday name', () => {
    expect(isUpdateCronRepresentable('0 2 * * MON')).toBe(false);
  });

  it('returns false for minute out of range', () => {
    expect(isUpdateCronRepresentable('60 2 * * *')).toBe(false);
  });

  it('returns false for hour out of range', () => {
    expect(isUpdateCronRepresentable('0 24 * * *')).toBe(false);
  });

  it('returns false for 4 tokens', () => {
    expect(isUpdateCronRepresentable('0 2 * *')).toBe(false);
  });
});
