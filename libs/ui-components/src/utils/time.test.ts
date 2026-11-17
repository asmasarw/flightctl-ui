import { describe, expect, it } from 'vitest';
import { UpdateScheduleMode, cronToStructuredSchedule, isUpdateCronRepresentable, structuredToCron } from './time';

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

describe('cronToStructuredSchedule', () => {
  it('converts weekly cron to structured schedule', () => {
    const result = cronToStructuredSchedule('30 14 * * 1,3,5');
    expect(result).toEqual({
      startsAt: '14:30',
      endsAt: '15:00', // 14:30 + 30m default duration
      scheduleMode: UpdateScheduleMode.Weekly,
      weekDays: [false, true, false, true, false, true, false], // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    });
  });

  it('converts daily cron to structured schedule with all days selected', () => {
    const result = cronToStructuredSchedule('0 2 * * *');
    expect(result).toEqual({
      startsAt: '02:00',
      endsAt: '02:30', // 02:00 + 30m default duration
      scheduleMode: UpdateScheduleMode.Daily,
      weekDays: [true, true, true, true, true, true, true],
    });
  });

  it('uses startGraceDuration when provided', () => {
    const result = cronToStructuredSchedule('30 14 * * 1,3,5', '1h');
    expect(result).toEqual({
      startsAt: '14:30',
      endsAt: '15:30', // 14:30 + 1h
      scheduleMode: UpdateScheduleMode.Weekly,
      weekDays: [false, true, false, true, false, true, false],
    });
  });
});

describe('structuredToCron', () => {
  it('converts structured daily schedule to cron', () => {
    const result = structuredToCron('02:00', UpdateScheduleMode.Daily, [true, true, true, true, true, true, true]);
    expect(result).toBe('0 2 * * 0,1,2,3,4,5,6');
  });

  it('converts structured weekly schedule to cron', () => {
    const result = structuredToCron('14:30', UpdateScheduleMode.Weekly, [false, true, false, true, false, true, false]);
    expect(result).toBe('30 14 * * 1,3,5');
  });
});
