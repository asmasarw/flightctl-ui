import { type DeviceUpdatePolicySpec } from '@flightctl/types';
import { describe, expect, it } from 'vitest';

import { type UpdatePolicyForm } from '../../types/deviceSpec';
import { getUpdatePolicyValues } from '../../components/Fleet/CreateFleet/fleetSpecUtils';
import { getUpdatePolicyPatches } from './patch';

const UPDATE_POLICY_PATH = '/spec/updatePolicy';

describe('getUpdatePolicyPatches - advanced cron preservation', () => {
  describe('when advanced cron is unchanged', () => {
    it('returns no patches when complex cron is loaded and unchanged', () => {
      // A complex cron that isn't representable in the structured UI
      const currentPolicy: DeviceUpdatePolicySpec = {
        downloadSchedule: {
          at: '0 0-9 * * *', // Every hour from midnight to 9 AM
          startGraceDuration: '1h',
        },
        updateSchedule: {
          at: '0 0-9 * * *',
          startGraceDuration: '1h',
        },
      };

      // Load form from current policy
      const form = {
        ...getUpdatePolicyValues(currentPolicy),
        isCustomized: true,
      } as Required<UpdatePolicyForm>;

      // No changes to the form - should produce no patches
      const patches = getUpdatePolicyPatches(UPDATE_POLICY_PATH, currentPolicy, form);

      expect(patches).toEqual([]);
    });
  });

  describe('when advanced cron is edited', () => {
    it('emits the new raw cron string when advanced block is modified', () => {
      // Start with a complex cron
      const currentPolicy: DeviceUpdatePolicySpec = {
        downloadSchedule: {
          at: '0 0-9 * * *',
          startGraceDuration: '1h',
        },
        updateSchedule: {
          at: '0 0-9 * * *',
          startGraceDuration: '1h',
        },
      };

      // Load form and modify the advanced cron
      const form = {
        ...getUpdatePolicyValues(currentPolicy),
        isCustomized: true,
        downloadCron: '0 0-12 * * *', // Changed: now every hour from midnight to noon
        installCron: '0 0-12 * * *',
      } as Required<UpdatePolicyForm>;

      const patches = getUpdatePolicyPatches(UPDATE_POLICY_PATH, currentPolicy, form);

      // Should produce a patch with the new raw cron
      expect(patches).toEqual([
        {
          op: 'replace',
          path: UPDATE_POLICY_PATH,
          value: {
            downloadSchedule: {
              at: '0 0-12 * * *',
              startGraceDuration: '1h',
              timeZone: undefined,
            },
            updateSchedule: {
              at: '0 0-12 * * *',
              startGraceDuration: '1h',
              timeZone: undefined,
            },
          },
        },
      ]);
    });
  });

  describe('when structured mode is used', () => {
    it('emits computed cron expression from structured fields', () => {
      // Start with a simple, representable cron
      const currentPolicy: DeviceUpdatePolicySpec = {
        downloadSchedule: {
          at: '0 2 * * *', // 2 AM daily
          startGraceDuration: '0s',
        },
        updateSchedule: {
          at: '0 2 * * *',
          startGraceDuration: '0s',
        },
      };

      // Load form and modify the structured field
      const form = {
        ...getUpdatePolicyValues(currentPolicy),
        isCustomized: true,
        downloadStartsAt: '03:00', // Changed to 3 AM
        installStartsAt: '03:00',
      } as Required<UpdatePolicyForm>;

      const patches = getUpdatePolicyPatches(UPDATE_POLICY_PATH, currentPolicy, form);

      // Should produce a patch with the computed cron expression
      expect(patches).toEqual([
        {
          op: 'replace',
          path: UPDATE_POLICY_PATH,
          value: {
            downloadSchedule: {
              at: '0 3 * * 0,1,2,3,4,5,6', // Computed from 03:00 daily
              startGraceDuration: '0s',
              timeZone: undefined,
            },
            updateSchedule: {
              at: '0 3 * * 0,1,2,3,4,5,6',
              startGraceDuration: '0s',
              timeZone: undefined,
            },
          },
        },
      ]);
    });
  });
});
