type NamedDevice = { metadata: { name?: string } };

export type PrototypeDeviceFilterArgs = {
  reviewOnly: boolean;
  flaggedDeviceIds: string[];
  /** When true, restrict to `certificateDeviceIds` (may be empty → no matches). */
  certificateFilterActive: boolean;
  certificateDeviceIds: string[];
};

/** Client-side Devices filters for enrollment prototype (no backend field selectors). */
export const filterDevicesByPrototypeFilters = <T extends NamedDevice>(
  devices: T[],
  { reviewOnly, flaggedDeviceIds, certificateFilterActive, certificateDeviceIds }: PrototypeDeviceFilterArgs,
): T[] => {
  if (!reviewOnly && !certificateFilterActive) {
    return devices;
  }

  const flagged = new Set(flaggedDeviceIds);
  const byCertificate = new Set(certificateDeviceIds);

  return devices.filter((device) => {
    const name = device.metadata.name || '';
    if (reviewOnly && !flagged.has(name)) {
      return false;
    }
    if (certificateFilterActive && !byCertificate.has(name)) {
      return false;
    }
    return true;
  });
};

export const deviceIdsForCertificate = (
  certificateName: string | undefined,
  certificates: Array<{ id: string; name: string }>,
  deviceCertificateById: Record<string, string>,
  flaggedAndReviewed: Array<{ deviceId: string; certificateId: string }>,
): string[] => {
  if (!certificateName) {
    return [];
  }
  const certificate = certificates.find((c) => c.name === certificateName);
  const fromMap = Object.entries(deviceCertificateById)
    .filter(([, name]) => name === certificateName)
    .map(([deviceId]) => deviceId);
  const fromFlags = certificate
    ? flaggedAndReviewed.filter((d) => d.certificateId === certificate.id).map((d) => d.deviceId)
    : [];
  return [...new Set([...fromMap, ...fromFlags])];
};
