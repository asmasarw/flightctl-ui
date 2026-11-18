import * as React from 'react';

export type EnrollmentPrototypeSection = 'requests' | 'policies' | 'certificates';

export type EnrollmentPrototypeFlags = Record<EnrollmentPrototypeSection, boolean>;

export type FlaggedEnrollmentDevice = {
  deviceId: string;
  requestId: string;
  certificateId: string;
  policyName: string;
  flaggedAt: string;
  clearedAt?: string;
  decommissionedAt?: string;
  reviewNote?: string;
};

export type EnrollmentCertificateStatus = 'Active' | 'Expired' | 'Revoked';

export type EnrollmentCertificate = {
  id: string;
  name: string;
  status: EnrollmentCertificateStatus;
  expires: string;
  daysRemaining: number;
  policies: string;
  privateKeyDownloaded: boolean;
  validityDays: number;
};

export const INITIAL_ENROLLMENT_CERTIFICATES: EnrollmentCertificate[] = [
  {
    id: 'north-factory',
    name: 'north-factory',
    status: 'Active',
    expires: 'Dec 18, 2026',
    daysRemaining: 40,
    policies: 'North onboarding',
    privateKeyDownloaded: false,
    validityDays: 365,
  },
  {
    id: 'warehouse-factory',
    name: 'warehouse-factory',
    status: 'Active',
    expires: 'Nov 30, 2026',
    daysRemaining: 22,
    policies: 'Warehouse edge',
    privateKeyDownloaded: false,
    validityDays: 365,
  },
  {
    id: 'field-service',
    name: 'field-service',
    status: 'Expired',
    expires: 'Oct 12, 2026',
    daysRemaining: -27,
    policies: 'Field service',
    privateKeyDownloaded: true,
    validityDays: 365,
  },
];

type RevocationState = Record<string, { flaggedAt: string; devices: FlaggedEnrollmentDevice[] }>;

export type EnrollmentPrototypePreset =
  | 'Representative data'
  | 'New organization'
  | 'No approval policies yet'
  | 'No certificates yet'
  | 'Requests unavailable'
  | 'Approval policies unavailable'
  | 'Certificates unavailable';

export interface EnrollmentPrototypeStateValue {
  simulatorActive: boolean;
  permissions: EnrollmentPrototypeFlags;
  data: EnrollmentPrototypeFlags;
  setSimulatorActive: (active: boolean) => void;
  setPermissions: (permissions: EnrollmentPrototypeFlags) => void;
  setData: (data: EnrollmentPrototypeFlags) => void;
  applyPreset: (preset: EnrollmentPrototypePreset) => void;
  reset: () => void;
  certificates: EnrollmentCertificate[];
  setCertificates: React.Dispatch<React.SetStateAction<EnrollmentCertificate[]>>;
  deviceCertificateById: Record<string, string>;
  registerDeviceCertificate: (deviceId: string, certificateName: string) => void;
  revocations: RevocationState;
  flaggedDevices: FlaggedEnrollmentDevice[];
  reviewedDevices: FlaggedEnrollmentDevice[];
  showFlaggedDevicesOnly: boolean;
  setShowFlaggedDevicesOnly: (show: boolean) => void;
  revokeCertificate: (
    certificateId: string,
    devices: Omit<FlaggedEnrollmentDevice, 'certificateId' | 'flaggedAt'>[],
  ) => void;
  clearEnrollmentFlag: (deviceId: string, reviewNote: string) => void;
  recordEnrollmentDecommission: (deviceId: string, reviewNote?: string) => void;
  resetRevocations: () => void;
  certificateToOpen?: string;
  setCertificateToOpen: (certificateId?: string) => void;
  requestToOpen?: string;
  setRequestToOpen: (requestId?: string) => void;
  policyToOpen?: string;
  setPolicyToOpen: (policyName?: string) => void;
}

export const ENROLLMENT_PROTOTYPE_SECTIONS: Array<{
  id: EnrollmentPrototypeSection;
  label: string;
}> = [
  { id: 'requests', label: 'Enrollment requests' },
  { id: 'policies', label: 'Approval policies' },
  { id: 'certificates', label: 'Enrollment certificates' },
];

export const ENROLLMENT_PROTOTYPE_PRESETS: Record<
  EnrollmentPrototypePreset,
  { permissions: EnrollmentPrototypeFlags; data: EnrollmentPrototypeFlags }
> = {
  'Representative data': {
    permissions: { requests: true, policies: true, certificates: true },
    data: { requests: true, policies: true, certificates: true },
  },
  'New organization': {
    permissions: { requests: true, policies: true, certificates: true },
    data: { requests: false, policies: false, certificates: false },
  },
  'No approval policies yet': {
    permissions: { requests: true, policies: true, certificates: true },
    data: { requests: true, policies: false, certificates: true },
  },
  'No certificates yet': {
    permissions: { requests: true, policies: true, certificates: true },
    data: { requests: true, policies: false, certificates: false },
  },
  'Requests unavailable': {
    permissions: { requests: false, policies: true, certificates: true },
    data: { requests: true, policies: true, certificates: true },
  },
  'Approval policies unavailable': {
    permissions: { requests: true, policies: false, certificates: true },
    data: { requests: true, policies: true, certificates: true },
  },
  'Certificates unavailable': {
    permissions: { requests: true, policies: true, certificates: false },
    data: { requests: true, policies: true, certificates: true },
  },
};

const STORAGE_KEY = 'rhem-enrollment-prototype-state';
const REVOCATION_STORAGE_KEY = 'rhem-enrollment-revocation-prototype-state';
const allEnabled: EnrollmentPrototypeFlags = { requests: true, policies: true, certificates: true };

const cloneFlags = (flags: EnrollmentPrototypeFlags): EnrollmentPrototypeFlags => ({ ...flags });

const isFlags = (value: unknown): value is EnrollmentPrototypeFlags => {
  if (!value || typeof value !== 'object') return false;
  const flags = value as Record<string, unknown>;
  return ['requests', 'policies', 'certificates'].every((key) => typeof flags[key] === 'boolean');
};

type StoredState = {
  active: boolean;
  permissions: EnrollmentPrototypeFlags;
  data: EnrollmentPrototypeFlags;
};

const readStoredState = (): StoredState | null => {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    const state = parsed as Record<string, unknown>;
    if (typeof state.active !== 'boolean' || !isFlags(state.permissions) || !isFlags(state.data)) return null;
    return { active: state.active, permissions: state.permissions, data: state.data };
  } catch {
    return null;
  }
};

const writeStoredState = (state: StoredState) => {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const readRevocations = (): RevocationState => {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(REVOCATION_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RevocationState) : {};
  } catch {
    return {};
  }
};

const EnrollmentPrototypeStateContext = React.createContext<EnrollmentPrototypeStateValue>({
  simulatorActive: false,
  permissions: allEnabled,
  data: allEnabled,
  setSimulatorActive: () => undefined,
  setPermissions: () => undefined,
  setData: () => undefined,
  applyPreset: () => undefined,
  reset: () => undefined,
  certificates: INITIAL_ENROLLMENT_CERTIFICATES,
  setCertificates: () => undefined,
  deviceCertificateById: {},
  registerDeviceCertificate: () => undefined,
  revocations: {},
  flaggedDevices: [],
  reviewedDevices: [],
  showFlaggedDevicesOnly: false,
  setShowFlaggedDevicesOnly: () => undefined,
  revokeCertificate: () => undefined,
  clearEnrollmentFlag: () => undefined,
  recordEnrollmentDecommission: () => undefined,
  resetRevocations: () => undefined,
  certificateToOpen: undefined,
  setCertificateToOpen: () => undefined,
  requestToOpen: undefined,
  setRequestToOpen: () => undefined,
  policyToOpen: undefined,
  setPolicyToOpen: () => undefined,
});

export const useEnrollmentPrototypeState = () => React.useContext(EnrollmentPrototypeStateContext);

export const EnrollmentPrototypeStateProvider = ({ children }: React.PropsWithChildren) => {
  const storedState = React.useMemo(readStoredState, []);
  const [simulatorActive, setSimulatorActiveRaw] = React.useState(storedState?.active ?? false);
  const [permissions, setPermissionsRaw] = React.useState<EnrollmentPrototypeFlags>(
    storedState?.permissions ?? cloneFlags(allEnabled),
  );
  const [data, setDataRaw] = React.useState<EnrollmentPrototypeFlags>(storedState?.data ?? cloneFlags(allEnabled));
  const [revocations, setRevocations] = React.useState<RevocationState>(readRevocations);
  const [showFlaggedDevicesOnly, setShowFlaggedDevicesOnly] = React.useState(false);
  const [certificateToOpen, setCertificateToOpen] = React.useState<string>();
  const [requestToOpen, setRequestToOpen] = React.useState<string>();
  const [policyToOpen, setPolicyToOpen] = React.useState<string>();
  const [certificates, setCertificates] = React.useState<EnrollmentCertificate[]>(() =>
    storedState?.data.certificates === false ? [] : INITIAL_ENROLLMENT_CERTIFICATES,
  );
  const [deviceCertificateById, setDeviceCertificateById] = React.useState<Record<string, string>>({
    'device-north-001': 'north-factory',
    'device-central-001': 'north-factory',
  });
  React.useEffect(() => {
    setCertificates(data.certificates ? INITIAL_ENROLLMENT_CERTIFICATES : []);
  }, [data.certificates]);
  const registerDeviceCertificate = React.useCallback((deviceId: string, certificateName: string) => {
    setDeviceCertificateById((current) =>
      current[deviceId] === certificateName ? current : { ...current, [deviceId]: certificateName },
    );
  }, []);
  const flaggedDevices = React.useMemo(
    () =>
      Object.values(revocations).flatMap((entry) =>
        entry.devices.filter((device) => !device.clearedAt && !device.decommissionedAt),
      ),
    [revocations],
  );
  const reviewedDevices = React.useMemo(
    () =>
      Object.values(revocations).flatMap((entry) =>
        entry.devices.filter((device) => !!device.clearedAt || !!device.decommissionedAt),
      ),
    [revocations],
  );

  const revokeCertificate = React.useCallback<EnrollmentPrototypeStateValue['revokeCertificate']>(
    (certificateId, devices) => {
      setRevocations((current) => {
        if (current[certificateId]) return current;
        const flaggedAt = new Date().toISOString();
        const next = {
          ...current,
          [certificateId]: {
            flaggedAt,
            devices: devices.map((device) => ({ ...device, certificateId, flaggedAt })),
          },
        };
        window.sessionStorage.setItem(REVOCATION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const clearEnrollmentFlag = React.useCallback<EnrollmentPrototypeStateValue['clearEnrollmentFlag']>(
    (deviceId, reviewNote) => {
      setRevocations((current) => {
        const next = Object.fromEntries(
          Object.entries(current).map(([certificateId, entry]) => [
            certificateId,
            {
              ...entry,
              devices: entry.devices.map((device) =>
                device.deviceId === deviceId && !device.clearedAt && !device.decommissionedAt
                  ? { ...device, clearedAt: new Date().toISOString(), reviewNote: reviewNote.trim() }
                  : device,
              ),
            },
          ]),
        ) as RevocationState;
        window.sessionStorage.setItem(REVOCATION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const recordEnrollmentDecommission = React.useCallback<EnrollmentPrototypeStateValue['recordEnrollmentDecommission']>(
    (deviceId, reviewNote) => {
      setRevocations((current) => {
        const next = Object.fromEntries(
          Object.entries(current).map(([certificateId, entry]) => [
            certificateId,
            {
              ...entry,
              devices: entry.devices.map((device) =>
                device.deviceId === deviceId && !device.clearedAt && !device.decommissionedAt
                  ? { ...device, decommissionedAt: new Date().toISOString(), reviewNote: reviewNote?.trim() }
                  : device,
              ),
            },
          ]),
        ) as RevocationState;
        window.sessionStorage.setItem(REVOCATION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  React.useEffect(() => {
    if (flaggedDevices.length === 0) setShowFlaggedDevicesOnly(false);
  }, [flaggedDevices.length]);

  const resetRevocations = React.useCallback(() => {
    setRevocations({});
    setShowFlaggedDevicesOnly(false);
    window.sessionStorage.removeItem(REVOCATION_STORAGE_KEY);
  }, []);

  const persist = React.useCallback(
    (next: Partial<StoredState>) => {
      writeStoredState({
        active: next.active ?? simulatorActive,
        permissions: next.permissions ?? permissions,
        data: next.data ?? data,
      });
    },
    [data, permissions, simulatorActive],
  );

  const setSimulatorActive = React.useCallback(
    (active: boolean) => {
      setSimulatorActiveRaw(active);
      persist({ active });
    },
    [persist],
  );

  const setPermissions = React.useCallback(
    (nextPermissions: EnrollmentPrototypeFlags) => {
      setPermissionsRaw(nextPermissions);
      setSimulatorActiveRaw(true);
      persist({ active: true, permissions: nextPermissions });
    },
    [persist],
  );

  const setData = React.useCallback(
    (nextData: EnrollmentPrototypeFlags) => {
      setDataRaw(nextData);
      setSimulatorActiveRaw(true);
      persist({ active: true, data: nextData });
    },
    [persist],
  );

  const applyPreset = React.useCallback((preset: EnrollmentPrototypePreset) => {
    const next = ENROLLMENT_PROTOTYPE_PRESETS[preset];
    setPermissionsRaw(cloneFlags(next.permissions));
    setDataRaw(cloneFlags(next.data));
    setSimulatorActiveRaw(true);
    writeStoredState({ active: true, permissions: next.permissions, data: next.data });
  }, []);

  const reset = React.useCallback(() => {
    setPermissionsRaw(cloneFlags(allEnabled));
    setDataRaw(cloneFlags(allEnabled));
    setSimulatorActiveRaw(false);
    writeStoredState({ active: false, permissions: cloneFlags(allEnabled), data: cloneFlags(allEnabled) });
  }, []);

  const value = React.useMemo<EnrollmentPrototypeStateValue>(
    () => ({
      simulatorActive,
      permissions: simulatorActive ? permissions : allEnabled,
      data: simulatorActive ? data : allEnabled,
      setSimulatorActive,
      setPermissions,
      setData,
      applyPreset,
      reset,
      certificates,
      setCertificates,
      deviceCertificateById,
      registerDeviceCertificate,
      revocations,
      flaggedDevices,
      reviewedDevices,
      showFlaggedDevicesOnly,
      setShowFlaggedDevicesOnly,
      revokeCertificate,
      clearEnrollmentFlag,
      recordEnrollmentDecommission,
      resetRevocations,
      certificateToOpen,
      setCertificateToOpen,
      requestToOpen,
      setRequestToOpen,
      policyToOpen,
      setPolicyToOpen,
    }),
    [
      applyPreset,
      certificateToOpen,
      certificates,
      clearEnrollmentFlag,
      recordEnrollmentDecommission,
      data,
      deviceCertificateById,
      flaggedDevices,
      permissions,
      policyToOpen,
      registerDeviceCertificate,
      requestToOpen,
      reset,
      resetRevocations,
      reviewedDevices,
      revokeCertificate,
      revocations,
      setData,
      setPermissions,
      setSimulatorActive,
      showFlaggedDevicesOnly,
      simulatorActive,
    ],
  );

  return <EnrollmentPrototypeStateContext.Provider value={value}>{children}</EnrollmentPrototypeStateContext.Provider>;
};
