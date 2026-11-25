import * as React from 'react';
import { type TFunction } from 'react-i18next';
import { Tbody } from '@patternfly/react-table';
import { SelectList, SelectOption, ToolbarItem } from '@patternfly/react-core';
import { MicrochipIcon } from '@patternfly/react-icons/dist/js/icons';

import { ResourceKind } from '@flightctl/types';
import Table, { type ApiTableColumn } from '../Table/Table';
import TableActions from '../Table/TableActions';
import ListPageBody from '../ListPage/ListPageBody';
import { useDeleteListAction } from '../ListPage/ListPageActions';
import { useFetch } from '../../hooks/useFetch';
import { useTranslation } from '../../hooks/useTranslation';
import { useTableSelect } from '../../hooks/useTableSelect';
import ApproveDeviceModal from '../modals/ApproveDeviceModal/ApproveDeviceModal';
import MassDeleteDeviceModal from '../modals/massModals/MassDeleteDeviceModal/MassDeleteDeviceModal';
import MassApproveDeviceModal from '../modals/massModals/MassApproveDeviceModal/MassApproveDeviceModal';
import EnrollmentRequestTableRow from '../EnrollmentRequest/EnrollmentRequestTableRow';
import EnrollmentRequestTableToolbar from './EnrollmentRequestTableToolbar';
import { RESOURCE, VERB } from '../../types/rbac';
import { usePermissionsContext } from '../common/PermissionsContext';
import ResourceListEmptyState from '../common/ResourceListEmptyState';
import { useEnrollmentRequests } from './useEnrollmentRequests';
import TablePagination from '../Table/TablePagination';
import { EnrollmentRequestStatus } from '../../utils/status/enrollmentRequest';

const EnrollmentRequestEmptyState = () => {
  const { t } = useTranslation();
  return <ResourceListEmptyState icon={MicrochipIcon} titleText={t('No enrollment requests here!')} />;
};

export const getEnrollmentRequestTableColumns = (t: TFunction): ApiTableColumn[] => [
  {
    name: t('Alias'),
  },
  {
    name: t('Name'),
  },
  {
    name: t('Request status'),
  },
  {
    name: t('Decision'),
  },
  {
    name: t('Submitted'),
  },
];

type EnrollmentRequestListProps = {
  refetchDevices?: VoidFunction;
};

const enrollmentRequestListPermissions = [
  { kind: RESOURCE.ENROLLMENT_REQUEST_APPROVAL, verb: VERB.POST },
  { kind: RESOURCE.ENROLLMENT_REQUEST, verb: VERB.DELETE },
];

const EnrollmentRequestList = ({ refetchDevices }: EnrollmentRequestListProps) => {
  const { t } = useTranslation();
  const { checkPermissions } = usePermissionsContext();
  const [canApprove, canDelete] = checkPermissions(enrollmentRequestListPermissions);
  const { remove } = useFetch();
  const [search, setSearch] = React.useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = React.useState<EnrollmentRequestStatus[]>([
    EnrollmentRequestStatus.Pending,
  ]);

  const enrollmentColumns = React.useMemo(() => getEnrollmentRequestTableColumns(t), [t]);
  const [enrollmentRequests, isLoading, error, refetch, pagination] = useEnrollmentRequests(search, selectedStatuses);
  const itemCount = enrollmentRequests.length;

  const refetchWithDevices = () => {
    refetch();
    refetchDevices?.();
  };

  const [approvingErId, setApprovingErId] = React.useState<string>();
  const [isMassDeleteModalOpen, setIsMassDeleteModalOpen] = React.useState(false);
  const [isMassApproveModalOpen, setIsMassApproveModalOpen] = React.useState(false);

  const { onRowSelect, hasSelectedRows, isAllSelected, isRowSelected, setAllSelected } = useTableSelect();

  const { action: deleteAction, modal: deleteModal } = useDeleteListAction({
    resourceType: ResourceKind.ENROLLMENT_REQUEST,
    onConfirm: async (enrollmentId: string) => {
      await remove(`enrollmentrequests/${enrollmentId}`);
      refetch();
    },
  });

  const onToggleStatus = (status: EnrollmentRequestStatus) => {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
  };

  const hasNonDefaultStatusFilter =
    selectedStatuses.length !== 1 || selectedStatuses[0] !== EnrollmentRequestStatus.Pending;
  const hasFilters = !!search || hasNonDefaultStatusFilter;
  const isInitialUnfilteredLoad = !hasFilters && itemCount === 0 && isLoading;

  const currentEnrollmentRequest = enrollmentRequests.find((er) => er.metadata.name === approvingErId);

  const listBody = (
    <ListPageBody error={error} loading={isInitialUnfilteredLoad} loadingTestId="pending-enrollment-requests-loading">
      <EnrollmentRequestTableToolbar
        search={search}
        setSearch={setSearch}
        enrollments={enrollmentRequests}
        selectedStatuses={selectedStatuses}
        onToggleStatus={onToggleStatus}
      >
        {(canApprove || canDelete) && (
          <ToolbarItem>
            <TableActions isDisabled={!hasSelectedRows}>
              <SelectList>
                {canApprove && (
                  <SelectOption onClick={() => setIsMassApproveModalOpen(true)}>{t('Approve')}</SelectOption>
                )}
                {canDelete && <SelectOption onClick={() => setIsMassDeleteModalOpen(true)}>{t('Delete')}</SelectOption>}
              </SelectList>
            </TableActions>
          </ToolbarItem>
        )}
      </EnrollmentRequestTableToolbar>
      <Table
        aria-label={t('Table for devices pending approval')}
        loading={isInitialUnfilteredLoad}
        columns={enrollmentColumns}
        emptyData={itemCount === 0}
        clearFilters={() => {
          setSearch('');
          setSelectedStatuses([EnrollmentRequestStatus.Pending]);
        }}
        hasFilters={hasFilters}
        isAllSelected={isAllSelected}
        onSelectAll={setAllSelected}
      >
        <Tbody>
          {enrollmentRequests.map((er, index) => (
            <EnrollmentRequestTableRow
              key={er.metadata.name || ''}
              er={er}
              deleteAction={deleteAction}
              onRowSelect={onRowSelect}
              isRowSelected={isRowSelected}
              rowIndex={index}
              onApprove={() => {
                setApprovingErId(er.metadata.name as string);
              }}
              canApprove={canApprove}
              canDelete={canDelete}
            />
          ))}
        </Tbody>
      </Table>
      <TablePagination pagination={pagination} isUpdating={isLoading} />
      {itemCount === 0 && !isLoading && !hasFilters && <EnrollmentRequestEmptyState />}
      {deleteModal}
      {currentEnrollmentRequest && (
        <ApproveDeviceModal
          enrollmentRequest={currentEnrollmentRequest}
          onClose={(updateList) => {
            setApprovingErId(undefined);
            if (updateList) {
              refetchWithDevices();
            }
          }}
        />
      )}
      {isMassDeleteModalOpen && (
        <MassDeleteDeviceModal
          onClose={() => setIsMassDeleteModalOpen(false)}
          resources={enrollmentRequests.filter(isRowSelected)}
          onDeleteSuccess={() => {
            setIsMassDeleteModalOpen(false);
            setAllSelected(false);
            refetch();
          }}
        />
      )}
      {isMassApproveModalOpen && (
        <MassApproveDeviceModal
          onClose={() => setIsMassApproveModalOpen(false)}
          pendingEnrollments={enrollmentRequests.filter(isRowSelected)}
          onApproveSuccess={() => {
            setAllSelected(false);
            setIsMassApproveModalOpen(false);
            refetchWithDevices();
          }}
        />
      )}
    </ListPageBody>
  );

  return <div data-testid="pending-enrollment-requests-section">{listBody}</div>;
};

export default EnrollmentRequestList;
