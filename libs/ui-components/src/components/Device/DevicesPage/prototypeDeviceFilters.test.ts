import { describe, expect, it } from 'vitest';
import { deviceIdsForCertificate, filterDevicesByPrototypeFilters } from './prototypeDeviceFilters';

const device = (name: string) => ({ metadata: { name } }) as { metadata: { name: string } };

describe('filterDevicesByPrototypeFilters', () => {
  const devices = [device('a'), device('b'), device('c')];

  it('returns all devices when no prototype filters are active', () => {
    expect(
      filterDevicesByPrototypeFilters(devices, {
        reviewOnly: false,
        flaggedDeviceIds: ['a'],
        certificateFilterActive: false,
        certificateDeviceIds: ['b'],
      }),
    ).toEqual(devices);
  });

  it('keeps only flagged devices when reviewOnly is set', () => {
    expect(
      filterDevicesByPrototypeFilters(devices, {
        reviewOnly: true,
        flaggedDeviceIds: ['a', 'c'],
        certificateFilterActive: false,
        certificateDeviceIds: [],
      }).map((d) => d.metadata.name),
    ).toEqual(['a', 'c']);
  });

  it('keeps only certificate-associated devices when certificate filter is set', () => {
    expect(
      filterDevicesByPrototypeFilters(devices, {
        reviewOnly: false,
        flaggedDeviceIds: [],
        certificateFilterActive: true,
        certificateDeviceIds: ['b'],
      }).map((d) => d.metadata.name),
    ).toEqual(['b']);
  });

  it('returns no devices when certificate filter is active but no devices match', () => {
    expect(
      filterDevicesByPrototypeFilters(devices, {
        reviewOnly: false,
        flaggedDeviceIds: [],
        certificateFilterActive: true,
        certificateDeviceIds: [],
      }),
    ).toEqual([]);
  });

  it('intersects review and certificate filters when both are set', () => {
    expect(
      filterDevicesByPrototypeFilters(devices, {
        reviewOnly: true,
        flaggedDeviceIds: ['a', 'b'],
        certificateFilterActive: true,
        certificateDeviceIds: ['b', 'c'],
      }).map((d) => d.metadata.name),
    ).toEqual(['b']);
  });
});

describe('deviceIdsForCertificate', () => {
  const certificates = [
    { id: 'north-factory', name: 'north-factory' },
    { id: 'warehouse-factory', name: 'warehouse-factory' },
  ];

  it('returns empty when no certificate is selected', () => {
    expect(deviceIdsForCertificate(undefined, certificates, { a: 'north-factory' }, [])).toEqual([]);
  });

  it('unions map entries and flagged devices for the certificate', () => {
    expect(
      deviceIdsForCertificate(
        'north-factory',
        certificates,
        { 'device-a': 'north-factory', 'device-b': 'warehouse-factory' },
        [
          { deviceId: 'device-c', certificateId: 'north-factory' },
          { deviceId: 'device-a', certificateId: 'north-factory' },
        ],
      ).sort(),
    ).toEqual(['device-a', 'device-c']);
  });
});
