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

import DeviceOnboardingPanel, {
  ONBOARDING_REQUEST_PARAM,
  ONBOARDING_TAB_PARAM,
} from '../../EnrollmentRequest/DeviceOnboardingPanel';
import PageWithPermissions from '../../common/PageWithPermissions';
import { RESOURCE, VERB } from '../../../types/rbac';
import { usePermissionsContext } from '../../common/PermissionsContext';
import EnrolledDevicesTable from './EnrolledDevicesTable';
import DecommissionedDevicesTable from './DecommissionedDevicesTable';

type DevicesTabKey = 'your-devices' | 'onboarding';

const DevicesPage = ({ canListER }: { canListER: boolean }) => {
  const { t } = useTranslation();
  const {
    router: { useSearchParams },
  } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTabKey: DevicesTabKey =
    canListER && searchParams.get('tab') === 'onboarding' ? 'onboarding' : 'your-devices';

  const setActiveTabKey = (tabKey: DevicesTabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabKey === 'onboarding') {
      nextParams.set('tab', 'onboarding');
    } else {
      nextParams.delete('tab');
      nextParams.delete(ONBOARDING_TAB_PARAM);
      nextParams.delete(ONBOARDING_REQUEST_PARAM);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const {
    filterKey,
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

  const { currentPage, setCurrentPage, onPageFetched, nextContinue, itemCount } = useTablePagination<DeviceList>();

  useResetPaginationOnFilterChange(`${filterKey}|${onlyDecommissioned}`, setCurrentPage);

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

  const pagination = React.useMemo(
    () => ({
      currentPage,
      setCurrentPage,
      itemCount,
    }),
    [currentPage, setCurrentPage, itemCount],
  );

  const yourDevicesContent = (
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
          devices={data}
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
      {canListER ? (
        <Tabs
          activeKey={activeTabKey}
          onSelect={(_event, tabIndex) => setActiveTabKey(tabIndex as DevicesTabKey)}
          aria-label={t('Devices tabs')}
        >
          <Tab eventKey="your-devices" title={<TabTitleText>{t('Your devices')}</TabTitleText>}>
            {yourDevicesContent}
          </Tab>
          <Tab eventKey="onboarding" title={<TabTitleText>{t('Device onboarding')}</TabTitleText>}>
            <DeviceOnboardingPanel refetchDevices={refetch} />
          </Tab>
        </Tabs>
      ) : (
        yourDevicesContent
      )}
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
      {canListDevice ? <DevicesPage canListER={canListER} /> : <DeviceOnboardingPanel isStandalone />}
    </PageWithPermissions>
  );
};

export default DevicesPageWithPermissions;
