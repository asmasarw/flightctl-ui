import * as React from 'react';

import { type DeviceList } from '@flightctl/types';
import { Tab, TabTitleText, Tabs } from '@patternfly/react-core';

import ListPage from '../../ListPage/ListPage';
import ListPageBody from '../../ListPage/ListPageBody';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppContext } from '../../../hooks/useAppContext';
import { useResetPaginationOnFilterChange, useTablePagination } from '../../../hooks/useTablePagination';
import { useDevices } from './useDevices';
import { useDeviceBackendFilters } from './useDeviceBackendFilters';

import EnrollmentRequestList from '../../EnrollmentRequest/EnrollmentRequestList';
import EnrollmentAutoApprovalPage from '../../Enrollment/EnrollmentAutoApprovalPage';
import OnboardingRequests from '../../Enrollment/OnboardingRequests';
import {
  EnrollmentPrototypeStateProvider,
  useEnrollmentPrototypeState,
} from '../../Enrollment/EnrollmentPrototypeState';
import PageWithPermissions from '../../common/PageWithPermissions';
import { RESOURCE, VERB } from '../../../types/rbac';
import { usePermissionsContext } from '../../common/PermissionsContext';
import EnrolledDevicesTable from './EnrolledDevicesTable';
import DecommissionedDevicesTable from './DecommissionedDevicesTable';
import { deviceIdsForCertificate, filterDevicesByPrototypeFilters } from './prototypeDeviceFilters';

type DevicesTabKey = 'your-devices' | 'onboarding';

const DevicesPage = ({ canListER }: { canListER: boolean }) => {
  const { t } = useTranslation();
  const {
    permissions,
    certificates,
    flaggedDevices,
    reviewedDevices,
    deviceCertificateById,
  } = useEnrollmentPrototypeState();
  const {
    router: { useSearchParams },
  } = useAppContext();
  const [searchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = React.useState<DevicesTabKey>(
    searchParams.get('tab') === 'onboarding' ? 'onboarding' : 'your-devices',
  );

  const {
    filterKey,
    reviewOnly,
    setReviewOnly,
    certificateName,
    setCertificateFilter,
    textFilters,
    clearTextFilters,
    setTextFilter,
    ownerFleets,
    onlyFleetless,
    activeStatuses,
    hasFiltersEnabled,
    setOwnerFleets,
    setOnlyFleetless,
    setActiveStatuses,
    selectedFeatures,
    selectedFeaturesCount,
    setSelectedFeatures,
    selectedLabels,
    setSelectedLabels,
  } = useDeviceBackendFilters();
  const [onlyDecommissioned, setOnlyDecommissioned] = React.useState<boolean>(false);

  const activeCertificate = permissions.certificates ? certificateName : undefined;
  React.useEffect(() => {
    if (!permissions.certificates && certificateName) setCertificateFilter(undefined);
  }, [certificateName, permissions.certificates, setCertificateFilter]);

  const { currentPage, setCurrentPage, onPageFetched, nextContinue, itemCount } = useTablePagination<DeviceList>();

  useResetPaginationOnFilterChange(
    `${filterKey}|${onlyDecommissioned}|${reviewOnly}|${activeCertificate || ''}`,
    setCurrentPage,
  );

  const {
    devices: data,
    isLoading: loading,
    error,
    isUpdating: updating,
    refetch,
  } = useDevices({
    textFilters,
    ownerFleets,
    onlyFleetless,
    onlyDecommissioned,
    activeStatuses,
    selectedFeatures,
    labels: selectedLabels,
    nextContinue,
    onPageFetched,
  });

  const certificateDeviceIds = React.useMemo(
    () =>
      deviceIdsForCertificate(activeCertificate, certificates, deviceCertificateById, [
        ...flaggedDevices,
        ...reviewedDevices,
      ]),
    [activeCertificate, certificates, deviceCertificateById, flaggedDevices, reviewedDevices],
  );

  const devices = React.useMemo(
    () =>
      onlyDecommissioned
        ? data
        : filterDevicesByPrototypeFilters(data, {
            reviewOnly,
            flaggedDeviceIds: flaggedDevices.map((flag) => flag.deviceId),
            certificateFilterActive: !!activeCertificate,
            certificateDeviceIds,
          }),
    [activeCertificate, certificateDeviceIds, data, flaggedDevices, onlyDecommissioned, reviewOnly],
  );

  const pagination = React.useMemo(
    () => ({
      currentPage,
      setCurrentPage,
      itemCount: reviewOnly || activeCertificate ? devices.length : itemCount,
    }),
    [activeCertificate, currentPage, devices.length, itemCount, reviewOnly, setCurrentPage],
  );

  const devicesTabContent = (
    // When searching for decommissioned devices we want to avoid showing the enrolled devices
    <ListPageBody error={error} loading={loading || (onlyDecommissioned && updating && !hasFiltersEnabled)}>
      {onlyDecommissioned ? (
        <DecommissionedDevicesTable
          devices={data}
          refetch={refetch}
          setTextFilter={setTextFilter}
          hasFiltersEnabled={hasFiltersEnabled || updating}
          setOnlyDecommissioned={setOnlyDecommissioned}
          isFilterUpdating={updating}
          pagination={pagination}
        />
      ) : (
        <EnrolledDevicesTable
          showEnrollmentReviewOnly={reviewOnly}
          setShowEnrollmentReviewOnly={setReviewOnly}
          certificateFilter={{
            name: activeCertificate,
            options: permissions.certificates ? certificates.map((certificate) => certificate.name) : undefined,
            select: setCertificateFilter,
          }}
          devices={devices}
          textFilters={textFilters}
          setTextFilter={setTextFilter}
          clearTextFilters={clearTextFilters}
          hasFiltersEnabled={hasFiltersEnabled || updating}
          ownerFleets={ownerFleets}
          onlyFleetless={onlyFleetless}
          setOnlyDecommissioned={setOnlyDecommissioned}
          activeStatuses={activeStatuses}
          setOwnerFleets={setOwnerFleets}
          setOnlyFleetless={setOnlyFleetless}
          setActiveStatuses={setActiveStatuses}
          selectedFeatures={selectedFeatures}
          selectedFeaturesCount={selectedFeaturesCount}
          setSelectedFeatures={setSelectedFeatures}
          selectedLabels={selectedLabels}
          setSelectedLabels={setSelectedLabels}
          isFilterUpdating={updating}
          pagination={pagination}
          refetchDevices={refetch}
        />
      )}
    </ListPageBody>
  );

  return (
    <ListPage title={t('Devices')}>
      <Tabs
        activeKey={activeTabKey}
        onSelect={(_event, tabKey) => setActiveTabKey(tabKey as DevicesTabKey)}
        aria-label={t('Devices tabs')}
      >
        <Tab
          eventKey="your-devices"
          title={<TabTitleText>{t('Your devices')}</TabTitleText>}
          data-testid="devices-tab-your-devices"
        >
          {devicesTabContent}
        </Tab>
        <Tab
          eventKey="onboarding"
          title={<TabTitleText>{t('Device onboarding')}</TabTitleText>}
          data-testid="devices-tab-onboarding"
        >
          <EnrollmentAutoApprovalPage
            embedded
            onViewFlaggedDevices={() => setActiveTabKey('your-devices')}
            onViewCertificateDevices={(name, needsReview) => {
              setCertificateFilter(name, true, needsReview);
              setCurrentPage(1);
              setOnlyDecommissioned(false);
              setActiveTabKey('your-devices');
            }}
            requestsContent={canListER ? <OnboardingRequests refetchDevices={refetch} /> : undefined}
          />
        </Tab>
      </Tabs>
    </ListPage>
  );
};

const DevicesPageWithPermissions = () => {
  const { checkPermissions, loading } = usePermissionsContext();
  const [canListDevice, canListER] = checkPermissions([
    { kind: RESOURCE.DEVICE, verb: VERB.LIST },
    { kind: RESOURCE.ENROLLMENT_REQUEST, verb: VERB.LIST },
  ]);

  return (
    <PageWithPermissions loading={loading} allowed={canListDevice || canListER}>
      <EnrollmentPrototypeStateProvider>
        {canListDevice ? <DevicesPage canListER={canListER} /> : <EnrollmentRequestList isStandalone />}
      </EnrollmentPrototypeStateProvider>
    </PageWithPermissions>
  );
};

export default DevicesPageWithPermissions;
