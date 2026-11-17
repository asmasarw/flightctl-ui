import { describe, expect, it } from 'vitest';
import { getUpdatePolicyValues } from './fleetSpecUtils';
import type { DeviceUpdatePolicySpec } from '@flightctl/types';

describe('getUpdatePolicyValues', () => {
  it('should mark representable download cron as not advanced and preserve raw cron', () => {
    const updateSpec: DeviceUpdatePolicySpec = {
      downloadSchedule: { at: '0 2 * * *' },
    };

    const result = getUpdatePolicyValues(updateSpec);

    expect(result.downloadIsAdvanced).toBe(false);
    expect(result.downloadCron).toBe('0 2 * * *');
    expect(result.downloadStartsAt).toBe('02:00');
  });

  it('should mark complex download cron as advanced and preserve raw cron', () => {
    const updateSpec: DeviceUpdatePolicySpec = {
      downloadSchedule: { at: '0 0-9 * * *' },
    };

    const result = getUpdatePolicyValues(updateSpec);

    expect(result.downloadIsAdvanced).toBe(true);
    expect(result.downloadCron).toBe('0 0-9 * * *');
  });

  it('should handle undefined spec with default values', () => {
    const result = getUpdatePolicyValues(undefined);

    expect(result.downloadIsAdvanced).toBe(false);
    expect(result.installIsAdvanced).toBe(false);
    expect(result.downloadCron).toBe('');
    expect(result.installCron).toBe('');
    expect(result.isCustomized).toBe(false);
  });

  it('should handle differing schedules with mixed advanced states', () => {
    const updateSpec: DeviceUpdatePolicySpec = {
      downloadSchedule: { at: '0 2 * * *' },
      updateSchedule: { at: '0 2 * * 1-5' },
    };

    const result = getUpdatePolicyValues(updateSpec);

    expect(result.downloadAndInstallDiffer).toBe(true);
    expect(result.downloadIsAdvanced).toBe(false);
    expect(result.installIsAdvanced).toBe(true);
    expect(result.installCron).toBe('0 2 * * 1-5');
  });
});
