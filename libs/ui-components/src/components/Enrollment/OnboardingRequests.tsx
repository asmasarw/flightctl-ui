import * as React from 'react';
import {
  Alert,
  AlertVariant,
  Breadcrumb,
  BreadcrumbItem,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  List,
  ListItem,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  PaginationVariant,
  SearchInput,
  Spinner,
  Stack,
  StackItem,
  Title,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { MicrochipIcon } from '@patternfly/react-icons/dist/js/icons/microchip-icon';

import { type Condition, ConditionType, type EnrollmentRequest, type EnrollmentRequestList } from '@flightctl/types';
import { useTranslation } from '../../hooks/useTranslation';
import { useFetch } from '../../hooks/useFetch';
import { useFetchPeriodically } from '../../hooks/useFetchPeriodically';
import { timeSinceText } from '../../utils/dates';
import { EnrollmentRequestStatus as ApprovalStatus, getApprovalStatus } from '../../utils/status/enrollmentRequest';
import { RESOURCE, VERB } from '../../types/rbac';
import { usePermissionsContext } from '../common/PermissionsContext';
import ResourceListEmptyState from '../common/ResourceListEmptyState';
import FlightCtlModal from '../common/FlightCtlModal';
import EnrollmentRequestStatusDisplay from '../Status/EnrollmentRequestStatus';
import EnrollmentRequestTpmStatus from '../Status/EnrollmentRequestTpmStatus';
import ApproveDeviceModal from '../modals/ApproveDeviceModal/ApproveDeviceModal';

const PAGE_SIZE = 10;

type OnboardingRequestsProps = {
  refetchDevices?: VoidFunction;
};

const getApprovedCondition = (er: EnrollmentRequest): Condition | undefined =>
  er.status?.conditions?.find((condition) => condition.type === ConditionType.EnrollmentRequestApproved);

const getDecisionText = (er: EnrollmentRequest): string => {
  const condition = getApprovedCondition(er);
  return condition?.message || condition?.reason || '';
};

const getSystemInfoSummary = (er: EnrollmentRequest): string => {
  const systemInfo = er.spec?.deviceStatus?.systemInfo;
  if (!systemInfo) {
    return '';
  }
  const parts = [systemInfo.operatingSystem, systemInfo.architecture].filter(Boolean);
  return parts.join(' · ');
};

const statusToAlertVariant = (status: ApprovalStatus): AlertVariant => {
  switch (status) {
    case ApprovalStatus.Approved:
      return AlertVariant.success;
    case ApprovalStatus.Denied:
      return AlertVariant.danger;
    case ApprovalStatus.Pending:
      return AlertVariant.warning;
    default:
      return AlertVariant.info;
  }
};

const RequestDetails = ({
  er,
  canApprove,
  onBack,
  onApprove,
  onReject,
}: {
  er: EnrollmentRequest;
  canApprove: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const { t } = useTranslation();
  const name = er.metadata.name || '-';
  const alias = er.spec?.labels?.alias;
  const status = getApprovalStatus(er);
  const decisionText = getDecisionText(er);
  const systemInfoSummary = getSystemInfoSummary(er);
  const labels = er.spec?.labels || {};
  const isPending = status === ApprovalStatus.Pending;

  const history: string[] = [
    t('Request created · {{time}}', { time: timeSinceText(t, er.metadata.creationTimestamp) }),
  ];
  if (er.status?.approval?.approvedAt) {
    const decisionLabel = er.status.approval.approved ? t('Approved') : t('Rejected');
    const approver = er.status.approval.approvedBy;
    history.push(
      approver
        ? t('{{decision}} by {{approver}} · {{time}}', {
            decision: decisionLabel,
            approver,
            time: timeSinceText(t, er.status.approval.approvedAt),
          })
        : t('{{decision}} · {{time}}', {
            decision: decisionLabel,
            time: timeSinceText(t, er.status.approval.approvedAt),
          }),
    );
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <Breadcrumb>
          <BreadcrumbItem>
            <Button variant="link" isInline onClick={onBack}>
              {t('Onboarding requests')}
            </Button>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{name}</BreadcrumbItem>
        </Breadcrumb>
      </StackItem>
      <StackItem>
        <Stack hasGutter>
          <StackItem>
            <Title headingLevel="h1" size="2xl">
              {name}
            </Title>
            {alias && <Content component="p">{alias}</Content>}
          </StackItem>
          {canApprove && isPending && (
            <StackItem>
              <Button variant="primary" onClick={onApprove} className="pf-v6-u-mr-sm">
                {t('Approve')}
              </Button>
              <Button variant="danger" onClick={onReject}>
                {t('Reject')}
              </Button>
            </StackItem>
          )}
        </Stack>
      </StackItem>
      {decisionText && (
        <StackItem>
          <Alert isInline variant={statusToAlertVariant(status)} title={decisionText} />
        </StackItem>
      )}
      <StackItem>
        <Stack hasGutter>
          <StackItem>
            <Card>
              <CardHeader>
                <CardTitle>{t('Request details')}</CardTitle>
              </CardHeader>
              <CardBody>
                <DescriptionList columnModifier={{ default: '1Col', md: '2Col' }}>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <EnrollmentRequestStatusDisplay er={er} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Enrollment certificate')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {er.status?.certificate ? t('Signed') : '-'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Policy result')}</DescriptionListTerm>
                    <DescriptionListDescription>-</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Submitted')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {timeSinceText(t, er.metadata.creationTimestamp)}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('TPM status')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <EnrollmentRequestTpmStatus er={er} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('System information')}</DescriptionListTerm>
                    <DescriptionListDescription>{systemInfoSummary || '-'}</DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>
          <StackItem>
            <Card>
              <CardHeader>
                <CardTitle>{t('Device labels')}</CardTitle>
              </CardHeader>
              <CardBody>
                {Object.keys(labels).length > 0 ? (
                  <DescriptionList isHorizontal isCompact>
                    {Object.entries(labels).map(([key, value]) => (
                      <DescriptionListGroup key={key}>
                        <DescriptionListTerm>{key}</DescriptionListTerm>
                        <DescriptionListDescription>{value}</DescriptionListDescription>
                      </DescriptionListGroup>
                    ))}
                  </DescriptionList>
                ) : (
                  <Content component="p">-</Content>
                )}
                <Content component="small">
                  {t('Labels and device identity are shown here for review. Edit them from the device details page.')}
                </Content>
              </CardBody>
            </Card>
          </StackItem>
          <StackItem>
            <Card>
              <CardHeader>
                <CardTitle>{t('Decision history')}</CardTitle>
              </CardHeader>
              <CardBody>
                <List isPlain>
                  {history.map((entry) => (
                    <ListItem key={entry}>{entry}</ListItem>
                  ))}
                </List>
              </CardBody>
            </Card>
          </StackItem>
        </Stack>
      </StackItem>
    </Stack>
  );
};

const OnboardingRequests = ({ refetchDevices }: OnboardingRequestsProps) => {
  const { t } = useTranslation();
  const { put } = useFetch();
  const { checkPermissions } = usePermissionsContext();
  const [canApprove] = checkPermissions([{ kind: RESOURCE.ENROLLMENT_REQUEST_APPROVAL, verb: VERB.POST }]);

  const [erList, isLoading, , refetch] = useFetchPeriodically<EnrollmentRequestList>({
    endpoint: 'enrollmentrequests',
  });

  const [search, setSearch] = React.useState('');
  const [selectedStatuses, setSelectedStatuses] = React.useState<ApprovalStatus[]>([]);
  const [page, setPage] = React.useState(1);
  const [selectedName, setSelectedName] = React.useState<string>();
  const [approvingRequest, setApprovingRequest] = React.useState<EnrollmentRequest>();
  const [rejectingRequest, setRejectingRequest] = React.useState<EnrollmentRequest>();

  const refetchAll = React.useCallback(() => {
    refetch();
    refetchDevices?.();
  }, [refetch, refetchDevices]);

  const allRequests = React.useMemo(() => erList?.items || [], [erList]);

  const statusFilters: { key: ApprovalStatus; label: string }[] = [
    { key: ApprovalStatus.Approved, label: t('Approved') },
    { key: ApprovalStatus.Pending, label: t('Needs review') },
    { key: ApprovalStatus.Denied, label: t('Rejected') },
  ];

  const toggleStatus = (status: ApprovalStatus) => {
    setPage(1);
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
  };

  const filteredRequests = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRequests.filter((er) => {
      const matchesSearch = !term || (er.metadata.name || '').toLowerCase().includes(term);
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(getApprovalStatus(er));
      return matchesSearch && matchesStatus;
    });
  }, [allRequests, search, selectedStatuses]);

  const pagedRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(search.trim() || selectedStatuses.length);

  const selectedRequest = selectedName ? allRequests.find((er) => er.metadata.name === selectedName) : undefined;

  const rejectRequest = async () => {
    if (!rejectingRequest?.metadata.name) {
      return;
    }
    await put(`enrollmentrequests/${rejectingRequest.metadata.name}/approval`, { approved: false });
    setRejectingRequest(undefined);
    setSelectedName(undefined);
    refetchAll();
  };

  if (selectedRequest) {
    return (
      <>
        <RequestDetails
          er={selectedRequest}
          canApprove={canApprove}
          onBack={() => setSelectedName(undefined)}
          onApprove={() => setApprovingRequest(selectedRequest)}
          onReject={() => setRejectingRequest(selectedRequest)}
        />
        {approvingRequest && (
          <ApproveDeviceModal
            enrollmentRequest={approvingRequest}
            onClose={(updated) => {
              setApprovingRequest(undefined);
              if (updated) {
                setSelectedName(undefined);
                refetchAll();
              }
            }}
          />
        )}
        {rejectingRequest && (
          <FlightCtlModal variant="small" isOpen onClose={() => setRejectingRequest(undefined)}>
            <ModalHeader title={t('Reject onboarding request?')} titleIconVariant="warning" />
            <ModalBody>
              {t('Rejecting this request denies the device from enrolling. This action cannot be undone.')}
            </ModalBody>
            <ModalFooter>
              <Button variant="danger" onClick={rejectRequest}>
                {t('Reject')}
              </Button>
              <Button variant="link" onClick={() => setRejectingRequest(undefined)}>
                {t('Cancel')}
              </Button>
            </ModalFooter>
          </FlightCtlModal>
        )}
      </>
    );
  }

  return (
    <>
      <div className="pf-v6-u-mb-md">
        <Content component="p">{t('See why each request was approved, rejected, or needs review.')}</Content>
      </div>
      <Toolbar id="device-onboarding-requests-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarGroup>
            <ToolbarItem>
              <SearchInput
                aria-label={t('Search requests by name')}
                placeholder={t('Search by name')}
                value={search}
                onChange={(_event, value) => {
                  setSearch(value);
                  setPage(1);
                }}
                onClear={() => {
                  setSearch('');
                  setPage(1);
                }}
              />
            </ToolbarItem>
          </ToolbarGroup>
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>
              <ToggleGroup aria-label={t('Filter requests by status')}>
                {statusFilters.map((filter) => (
                  <ToggleGroupItem
                    key={filter.key}
                    text={filter.label}
                    buttonId={`request-status-${filter.key}`}
                    isSelected={selectedStatuses.includes(filter.key)}
                    onChange={() => toggleStatus(filter.key)}
                  />
                ))}
              </ToggleGroup>
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>
      {isLoading && allRequests.length === 0 ? (
        <Bullseye className="pf-v6-u-py-xl">
          <Spinner />
        </Bullseye>
      ) : filteredRequests.length === 0 ? (
        <ResourceListEmptyState
          icon={MicrochipIcon}
          titleText={hasFilters ? t('No matching requests') : t('No device onboarding requests yet')}
        />
      ) : (
        <>
          <Table variant="compact" aria-label={t('Device onboarding requests')}>
            <Thead>
              <Tr>
                <Th>{t('Device')}</Th>
                <Th>{t('Request status')}</Th>
                <Th>{t('Decision')}</Th>
                <Th>{t('Policy')}</Th>
                <Th>{t('Submitted')}</Th>
                <Th>{t('Actions')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pagedRequests.map((er) => {
                const name = er.metadata.name || '-';
                const isPending = getApprovalStatus(er) === ApprovalStatus.Pending;
                const decision = getDecisionText(er);
                return (
                  <Tr key={name}>
                    <Td dataLabel={t('Device')}>
                      <Button variant="link" isInline onClick={() => setSelectedName(er.metadata.name)}>
                        {name}
                      </Button>
                    </Td>
                    <Td dataLabel={t('Request status')}>
                      <EnrollmentRequestStatusDisplay er={er} />
                    </Td>
                    <Td dataLabel={t('Decision')}>{decision || '-'}</Td>
                    <Td dataLabel={t('Policy')}>-</Td>
                    <Td dataLabel={t('Submitted')}>{timeSinceText(t, er.metadata.creationTimestamp)}</Td>
                    <Td dataLabel={t('Actions')}>
                      {canApprove && isPending ? (
                        <Button variant="primary" size="sm" onClick={() => setSelectedName(er.metadata.name)}>
                          {t('Review request')}
                        </Button>
                      ) : (
                        <Button variant="link" isInline onClick={() => setSelectedName(er.metadata.name)}>
                          {t('View details')}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <Pagination
            itemCount={filteredRequests.length}
            perPage={PAGE_SIZE}
            page={page}
            onSetPage={(_event, newPage) => setPage(newPage)}
            onPerPageSelect={(_event, _perPage, newPage) => setPage(newPage)}
            variant={PaginationVariant.bottom}
            isCompact
          />
        </>
      )}
    </>
  );
};

export default OnboardingRequests;
