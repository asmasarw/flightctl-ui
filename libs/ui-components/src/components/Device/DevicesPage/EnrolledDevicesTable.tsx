import * as React from 'react';
import { Button, EmptyState, EmptyStateBody, EmptyStateFooter, Switch, ToolbarItem } from '@patternfly/react-core';
import SearchIcon from '@patternfly/react-icons/dist/js/icons/search-icon';
import { Tbody } from '@patternfly/react-table';
import { type TFunction } from 'react-i18next';

import {
  type Device,
  type DeviceDecommission,
  DeviceDecommissionTargetType,
  type DeviceList,
  ResourceKind,
} from '@flightctl/types';

import { type FilterStatusMap } from './types';
import { type FlightCtlLabel } from '../../../types/extraTypes';
import { type PaginationDetails } from '../../../hooks/useTablePagination';
import { useTranslation } from '../../../hooks/useTranslation';
import { useTableSelect } from '../../../hooks/useTableSelect';
import { usePermissionsContext } from '../../common/PermissionsContext';
import { useFetch } from '../../../hooks/useFetch';
import { RESOURCE, VERB } from '../../../types/rbac';
import {
  getApplicationStatusHelperText,
  getDeviceStatusHelperText,
  getUpdateStatusHelperText,
} from '../../Status/utils';

import Table from '../../Table/Table';
import { useDecommissionListAction, useResumeListAction } from '../../ListPage/ListPageActions';
import TablePagination from '../../Table/TablePagination';
import MassDecommissionDeviceModal from '../../modals/massModals/MassDecommissionDeviceModal/MassDecommissionDeviceModal';
import AddDeviceModal from '../AddDeviceModal/AddDeviceModal';
import { EnrolledDevicesEmptyState } from './DevicesEmptyStates';
import DeviceTableToolbar from './DeviceTableToolbar';
import EnrolledDeviceTableRow from './EnrolledDeviceTableRow';
import { type DeviceFeatureFilter, type DeviceTextFilterKey, FilterSearchParams } from '../../../utils/status/devices';
import { GlobalSystemRestoreBanners } from '../../SystemRestore/SystemRestoreBanners';
import { type DeviceCertificateFilter } from './DeviceToolbarFilters';

interface EnrolledDeviceTableProps {
  certificateFilter: DeviceCertificateFilter;
  showEnrollmentReviewOnly: boolean;
  setShowEnrollmentReviewOnly: (enabled: boolean) => void;
  devices: Array<Device>;
  ownerFleets: string[];
  onlyFleetless: boolean;
  activeStatuses: FilterStatusMap;
  hasFiltersEnabled: boolean;
  textFilters: Partial<Record<DeviceTextFilterKey, string>>;
  setTextFilter: (key: DeviceTextFilterKey, value: string) => void;
  clearTextFilters: VoidFunction;
  setOnlyDecommissioned: (check: boolean) => void;
  setOwnerFleets: (ownerFleets: string[]) => void;
  setOnlyFleetless: (enabled: boolean) => void;
  setActiveStatuses: (activeStatuses: FilterStatusMap) => void;
  selectedFeatures: DeviceFeatureFilter[];
  selectedFeaturesCount: number;
  setSelectedFeatures: (filters: DeviceFeatureFilter[]) => void;
  selectedLabels: FlightCtlLabel[];
  setSelectedLabels: (labels: FlightCtlLabel[]) => void;
  isFilterUpdating: boolean;
  pagination: Pick<PaginationDetails<DeviceList>, 'currentPage' | 'setCurrentPage' | 'itemCount'>;
  refetchDevices: VoidFunction;
}

const getDeviceTableColumns = (t: TFunction) => [
  {
    id: 'alias',
    name: t('Alias'),
  },
  {
    id: 'name',
    name: t('Name'),
  },
  {
    id: 'fleet',
    name: t('Fleet'),
  },
  {
    id: 'appStatus',
    name: t('Application status'),
    helperText: getApplicationStatusHelperText(t),
  },
  {
    id: 'deviceStatus',
    name: t('Device status'),
    helperText: getDeviceStatusHelperText(t),
  },
  {
    id: 'updateStatus',
    name: t('Update status'),
    helperText: getUpdateStatusHelperText(t),
  },
];

const enrolledDevicesPermissions = [
  { kind: RESOURCE.DEVICE, verb: VERB.PATCH },
  { kind: RESOURCE.DEVICE_DECOMMISSION, verb: VERB.UPDATE },
  { kind: RESOURCE.DEVICE_RESUME, verb: VERB.UPDATE },
];

const EnrolledDevicesTable = ({
  certificateFilter,
  showEnrollmentReviewOnly,
  setShowEnrollmentReviewOnly,
  devices,
  textFilters,
  setTextFilter,
  clearTextFilters,
  ownerFleets,
  setOwnerFleets,
  onlyFleetless,
  setOnlyFleetless,
  activeStatuses,
  setActiveStatuses,
  setOnlyDecommissioned,
  selectedFeatures,
  selectedFeaturesCount,
  setSelectedFeatures,
  selectedLabels,
  setSelectedLabels,
  hasFiltersEnabled,
  isFilterUpdating,
  pagination,
  refetchDevices,
}: EnrolledDeviceTableProps) => {
  const { t } = useTranslation();
  const { put } = useFetch();

  const [addDeviceModal, setAddDeviceModal] = React.useState(false);
  const [isMassDecommissionModalOpen, setIsMassDecommissionModalOpen] = React.useState(false);
  const deviceColumns = React.useMemo(() => getDeviceTableColumns(t), [t]);

  const { onRowSelect, hasSelectedRows, isAllSelected, isRowSelected, setAllSelected } = useTableSelect();

  const { action: resumeDeviceAction, modal: resumeDeviceModal } = useResumeListAction(refetchDevices);
  const { action: decommissionDeviceAction, modal: decommissionDeviceModal } = useDecommissionListAction({
    resourceType: ResourceKind.DEVICE,
    onConfirm: async (deviceId: string, params) => {
      await put<DeviceDecommission>(`devices/${deviceId}/decommission`, {
        target: params?.target || DeviceDecommissionTargetType.DeviceDecommissionTargetTypeUnenroll,
      });
      setOnlyDecommissioned(true);
    },
  });

  const { checkPermissions } = usePermissionsContext();
  const [canEdit, canDecommission, canResume] = checkPermissions(enrolledDevicesPermissions);

  const clearAllFilters = () => {
    certificateFilter.select();
    setShowEnrollmentReviewOnly(false);
    if (hasFiltersEnabled) {
      setActiveStatuses({
        [FilterSearchParams.AppStatus]: [],
        [FilterSearchParams.DeviceStatus]: [],
        [FilterSearchParams.UpdatedStatus]: [],
      });
      setOwnerFleets([]);
      setOnlyFleetless(false);
      clearTextFilters();
      setSelectedLabels([]);
      setSelectedFeatures([]);
    }
  };

  return (
    <>
      <GlobalSystemRestoreBanners onResumeComplete={refetchDevices} />

      <DeviceTableToolbar
        certificateFilter={certificateFilter}
        showEnrollmentReviewOnly={showEnrollmentReviewOnly}
        setShowEnrollmentReviewOnly={setShowEnrollmentReviewOnly}
        textFilters={textFilters}
        setTextFilter={setTextFilter}
        clearTextFilters={clearTextFilters}
        ownerFleets={ownerFleets}
        setOwnerFleets={setOwnerFleets}
        onlyFleetless={onlyFleetless}
        setOnlyFleetless={setOnlyFleetless}
        activeStatuses={activeStatuses}
        setActiveStatuses={setActiveStatuses}
        selectedFeatures={selectedFeatures}
        selectedFeaturesCount={selectedFeaturesCount}
        setSelectedFeatures={setSelectedFeatures}
        selectedLabels={selectedLabels}
        setSelectedLabels={setSelectedLabels}
        isFilterUpdating={isFilterUpdating}
      >
        <ToolbarItem>
          <Button aria-label={t('Add devices')} onClick={() => setAddDeviceModal(true)}>
            {t('Add devices')}
          </Button>
        </ToolbarItem>
        {canDecommission && (
          <ToolbarItem>
            <Button
              isDisabled={!hasSelectedRows}
              onClick={() => setIsMassDecommissionModalOpen(true)}
              variant="secondary"
              data-testid="toolbar-decommission-devices"
            >
              {t('Decommission devices')}
            </Button>
          </ToolbarItem>
        )}
        <ToolbarItem alignSelf="center">
          <Switch
            id="enrolled-devices-switch"
            label={<span className="fctl-switch__label">{t('Show decommissioned devices')}</span>}
            isChecked={false}
            aria-checked={false}
            onChange={() => {
              clearAllFilters();
              setOnlyDecommissioned(true);
            }}
            ouiaId={t('Show decommissioned devices')}
            data-testid="show-decommissioned-devices-switch"
          />
        </ToolbarItem>
      </DeviceTableToolbar>
      {showEnrollmentReviewOnly && !devices.length && !isFilterUpdating ? (
        <EmptyState
          titleText={t('No devices need onboarding review')}
          headingLevel="h2"
          variant="full"
          icon={SearchIcon}
        >
          {(certificateFilter.name || hasFiltersEnabled) && (
            <EmptyStateBody>{t('No devices match the review filter and your other selected filters.')}</EmptyStateBody>
          )}
          <EmptyStateFooter>
            <Button variant="link" onClick={() => setShowEnrollmentReviewOnly(false)}>
              {t('Clear review filter')}
            </Button>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <Table
          aria-label={t('Enrolled devices table')}
          loading={isFilterUpdating}
          columns={deviceColumns}
          hasFilters={hasFiltersEnabled || showEnrollmentReviewOnly || !!certificateFilter.name}
          clearFilters={clearAllFilters}
          emptyData={devices.length === 0}
          isAllSelected={isAllSelected}
          onSelectAll={setAllSelected}
          data-testid="enrolled-devices-table"
        >
          <Tbody>
            {devices.map((device, index) => (
              <EnrolledDeviceTableRow
                key={device.metadata.name || ''}
                device={device}
                onRowSelect={onRowSelect}
                isRowSelected={isRowSelected}
                rowIndex={index}
                canEdit={canEdit}
                canDecommission={canDecommission}
                decommissionAction={decommissionDeviceAction}
                canResume={canResume}
                resumeAction={resumeDeviceAction}
                deviceColumns={deviceColumns}
              />
            ))}
          </Tbody>
        </Table>
      )}
      <TablePagination isUpdating={isFilterUpdating} pagination={pagination} />
      {!hasFiltersEnabled && !certificateFilter.name && !showEnrollmentReviewOnly && devices.length === 0 && (
        <EnrolledDevicesEmptyState onAddDevice={() => setAddDeviceModal(true)} />
      )}
      {decommissionDeviceModal || resumeDeviceModal}
      {addDeviceModal && <AddDeviceModal onClose={() => setAddDeviceModal(false)} />}
      {isMassDecommissionModalOpen && (
        <MassDecommissionDeviceModal
          onClose={() => setIsMassDecommissionModalOpen(false)}
          devices={devices.filter(isRowSelected)}
          onSuccess={() => {
            setIsMassDecommissionModalOpen(false);
            setOnlyDecommissioned(true);
          }}
        />
      )}
    </>
  );
};

export default EnrolledDevicesTable;
