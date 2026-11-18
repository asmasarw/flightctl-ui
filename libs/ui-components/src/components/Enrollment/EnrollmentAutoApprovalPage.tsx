import * as React from 'react';
import {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Dropdown,
  DropdownItem,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  Flex,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  Label,
  LabelGroup,
  MenuToggle,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Pagination,
  PaginationVariant,
  EmptyState as PatternFlyEmptyState,
  SearchInput,
  Stack,
  StackItem,
  Tab,
  TabTitleText,
  Tabs,
  TextArea,
  TextInput,
  Title,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/js/icons/ellipsis-v-icon';
import LockIcon from '@patternfly/react-icons/dist/js/icons/lock-icon';
import PlusCircleIcon from '@patternfly/react-icons/dist/js/icons/plus-circle-icon';
import SearchIcon from '@patternfly/react-icons/dist/js/icons/search-icon';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';

import FlightCtlModal from '../common/FlightCtlModal';
import ActionsDropdownList from '../common/ActionsDropdownList';
import DetailsPageActions from '../DetailsPage/DetailsPageActions';
import EditableLabelControl from '../common/EditableLabelControl';
import FlightCtlForm from '../form/FlightCtlForm';
import { ROUTE, useNavigate } from '../../hooks/useNavigate';
import { useTranslation } from '../../hooks/useTranslation';
import {
  type EnrollmentCertificate,
  INITIAL_ENROLLMENT_CERTIFICATES,
  useEnrollmentPrototypeState,
} from './EnrollmentPrototypeState';
import EnrollmentReviewIndicator from './EnrollmentReviewIndicator';

import './EnrollmentAutoApprovalPage.css';

type EnrollmentTab = 'requests' | 'policies' | 'certificates';
type RequestStatus = 'Needs review' | 'Approved' | 'Rejected';
type PolicyStatus = 'Enabled' | 'Disabled';
type PolicyConditionField = 'organization' | 'product' | 'serialPrefix' | 'tpm' | 'matchExpression';
type PageView =
  | { type: 'list' }
  | { type: 'request'; id: string }
  | { type: 'policy'; id: string; editing: boolean }
  | { type: 'policy-create' }
  | { type: 'certificate'; id: string }
  | { type: 'certificate-create' }
  | { type: 'certificate-created'; id: string };

type MatchingCondition = { field: PolicyConditionField; label: string; value: string };
type PolicyLabel = { key: string; value: string };
type EnrollmentPolicy = {
  id: string;
  name: string;
  status: PolicyStatus;
  certificate: string;
  conditions: MatchingCondition[];
  matchExpression: string;
  requireTPMVerification: boolean;
  deviceLabels: string;
  allowedIncomingLabels: string;
  approvalLimit?: number;
  usedApprovals: number;
  autoApprovalWindowDays?: number;
};
type EnrollmentRequest = {
  id: string;
  device: string;
  enrolledDeviceId?: string;
  alias: string;
  status: RequestStatus;
  outcome: string;
  reason: string;
  policy: string;
  certificate: string;
  submitted: string;
  decisionHistory: string[];
  labels: Record<string, string>;
  tpmStatus: 'Verified' | 'Not verified' | 'Unknown';
  systemInfo: string;
};
type EnrollmentPermissions = { requests: boolean; policies: boolean; certificates: boolean };

const requestStatuses: RequestStatus[] = ['Approved', 'Needs review', 'Rejected'];
const pageSize = 4;
/** Show a warning badge once used approvals reach this fraction of the lifetime limit (RHEM prototype). */
const approvalLimitWarningFraction = 0.9;

const initialPolicies: EnrollmentPolicy[] = [
  {
    id: 'north-onboarding',
    name: 'North onboarding',
    status: 'Enabled',
    certificate: 'north-factory',
    conditions: [
      { field: 'organization', label: 'Organization', value: 'north' },
      { field: 'serialPrefix', label: 'Serial prefix', value: 'N-' },
      { field: 'tpm', label: 'TPM', value: 'Verified' },
    ],
    matchExpression: 'serial.startsWith("N-")',
    requireTPMVerification: true,
    deviceLabels: 'organization=north\nenvironment=production',
    allowedIncomingLabels: 'site,line',
    usedApprovals: 38,
    autoApprovalWindowDays: 30,
  },
  {
    id: 'warehouse-edge',
    name: 'Warehouse edge',
    status: 'Enabled',
    certificate: 'warehouse-factory',
    conditions: [
      { field: 'organization', label: 'Organization', value: 'warehouse' },
      { field: 'product', label: 'Product', value: 'FC-200' },
    ],
    matchExpression: 'productSerial.startsWith("WH-")',
    requireTPMVerification: false,
    deviceLabels: 'organization=warehouse',
    allowedIncomingLabels: 'line',
    approvalLimit: 100,
    usedApprovals: 100,
    autoApprovalWindowDays: 30,
  },
  {
    id: 'field-service',
    name: 'Field service',
    status: 'Disabled',
    certificate: 'field-service',
    conditions: [
      { field: 'organization', label: 'Organization', value: 'field' },
      { field: 'tpm', label: 'TPM', value: 'Verified' },
    ],
    matchExpression: 'productUuid in ["field-001", "field-002"]',
    requireTPMVerification: true,
    deviceLabels: 'organization=field',
    allowedIncomingLabels: '',
    approvalLimit: 50,
    usedApprovals: 12,
    autoApprovalWindowDays: 90,
  },
];

const initialRequests: EnrollmentRequest[] = [
  {
    id: 'device-north-001',
    device: 'device-north-001',
    enrolledDeviceId: 'device-north-001',
    alias: 'North device 1',
    status: 'Approved',
    outcome: 'Automatically approved',
    reason: 'North onboarding is the only enabled policy that matches this request.',
    policy: 'North onboarding',
    certificate: 'north-factory',
    submitted: '12 minutes ago',
    decisionHistory: ['Request created · 12 minutes ago', 'Approved automatically · 12 minutes ago'],
    labels: { organization: 'north', environment: 'production' },
    tpmStatus: 'Verified',
    systemInfo: 'FC-200 · RHEL 9.5 · x86_64',
  },
  {
    id: 'warehouse-edge-007',
    device: 'warehouse-edge-007',
    alias: 'Warehouse line 7',
    status: 'Needs review',
    outcome: 'Quota reached',
    reason: 'The matching policy has no remaining lifetime approvals.',
    policy: 'Warehouse edge',
    certificate: 'warehouse-factory',
    submitted: '28 minutes ago',
    decisionHistory: ['Request created · 28 minutes ago'],
    labels: { organization: 'warehouse', line: '7' },
    tpmStatus: 'Verified',
    systemInfo: 'FC-200 · RHEL 9.5 · x86_64',
  },
  {
    id: 'north-edge-015',
    device: 'north-edge-015',
    alias: 'North spare gateway',
    status: 'Needs review',
    outcome: 'TPM verification required',
    reason: 'The matching policy requires server-verified TPM evidence.',
    policy: 'North onboarding',
    certificate: 'north-factory',
    submitted: '36 minutes ago',
    decisionHistory: ['Request created · 36 minutes ago'],
    labels: { organization: 'north' },
    tpmStatus: 'Not verified',
    systemInfo: 'FC-200 · RHEL 9.5 · x86_64',
  },
  {
    id: 'field-edge-022',
    device: 'field-edge-022',
    alias: 'Field service spare',
    status: 'Needs review',
    outcome: 'Multiple policies passed',
    reason: 'Field service and North onboarding both match. An administrator must resolve the ambiguity.',
    policy: 'Field service · North onboarding',
    certificate: 'field-service',
    submitted: '1 hour ago',
    decisionHistory: ['Request created · 1 hour ago'],
    labels: { organization: 'field', environment: 'staging' },
    tpmStatus: 'Verified',
    systemInfo: 'FC-100 · RHEL 9.4 · x86_64',
  },
  {
    id: 'south-edge-003',
    device: 'south-edge-003',
    alias: 'South test device',
    status: 'Rejected',
    outcome: 'Manually rejected',
    reason: 'Device is not part of the approved onboarding batch.',
    policy: 'No policy passed',
    certificate: 'south-factory',
    submitted: 'Yesterday',
    decisionHistory: ['Request created · Yesterday', 'Rejected by Alex Morgan · Yesterday at 3:42 PM'],
    labels: { organization: 'south', environment: 'test' },
    tpmStatus: 'Not verified',
    systemInfo: 'FC-100 · RHEL 9.4 · x86_64',
  },
  {
    id: 'device-central-001',
    device: 'device-central-001',
    enrolledDeviceId: 'device-central-001',
    alias: 'Central device 1',
    status: 'Approved',
    outcome: 'Automatically approved',
    reason: 'Exactly one policy passed all checks.',
    policy: 'North onboarding',
    certificate: 'north-factory',
    submitted: '2 days ago',
    decisionHistory: ['Request created · 2 days ago', 'Approved automatically · 2 days ago'],
    labels: { organization: 'north', environment: 'production' },
    tpmStatus: 'Verified',
    systemInfo: 'FC-200 · RHEL 9.5 · x86_64',
  },
];

const statusColor = (status: RequestStatus | EnrollmentCertificate['status'] | PolicyStatus) => {
  if (status === 'Approved' || status === 'Active' || status === 'Enabled') return 'green' as const;
  if (status === 'Rejected' || status === 'Revoked' || status === 'Disabled') return 'red' as const;
  return 'orange' as const;
};

const StatusLabel = ({ status }: { status: RequestStatus | EnrollmentCertificate['status'] | PolicyStatus }) => (
  <Label isCompact variant="filled" color={statusColor(status)}>
    {status}
  </Label>
);

const ApprovalLimit = ({
  policy,
  showExplanation = false,
}: {
  policy: EnrollmentPolicy;
  showExplanation?: boolean;
}) => {
  const { t } = useTranslation();
  if (policy.approvalLimit === undefined) return <>{t('Unlimited')}</>;
  const remaining = Math.max(0, policy.approvalLimit - policy.usedApprovals);
  return (
    <>
      <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
        <span>{t('{{used}} of {{limit}} used', { used: policy.usedApprovals, limit: policy.approvalLimit })}</span>
        {policy.usedApprovals >= policy.approvalLimit * approvalLimitWarningFraction && (
          <Label isCompact status="warning">
            {remaining === 0 ? t('Limit reached') : t('{{remaining}} remaining', { remaining })}
          </Label>
        )}
      </Flex>
      {showExplanation && remaining === 0 && (
        <Content component="small">{t('New requests that match this policy need manual review.')}</Content>
      )}
    </>
  );
};

const conditionLabels: Record<PolicyConditionField, string> = {
  organization: 'Organization',
  product: 'Product',
  serialPrefix: 'Serial prefix',
  tpm: 'TPM',
  matchExpression: 'Matching expression',
};
const conditionSummary = (conditions: MatchingCondition[]) =>
  conditions.map((condition) => `${condition.label}: ${condition.value}`).join(' · ');
const policyMatchSummary = (policy: EnrollmentPolicy) => policy.matchExpression || conditionSummary(policy.conditions);
const parsePolicyLabels = (value: string): PolicyLabel[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...valueParts] = line.split('=');
      return { key: key.trim(), value: valueParts.join('=').trim() };
    })
    .filter((label) => label.key);
const formatPolicyLabels = (labels: PolicyLabel[]) =>
  labels.map((label) => (label.value ? `${label.key}=${label.value}` : label.key)).join('\n');
const expressionParts = (expression: string) => {
  const exact = expression.match(/^(serial|productSerial|productUuid)\s*==\s*"([^"]+)"$/);
  if (exact) return { field: exact[1], values: [exact[2]], kind: 'values' as const };
  const set = expression.match(/^(serial|productSerial|productUuid)\s+in\s+\[([^\]]+)\]$/);
  if (set)
    return {
      field: set[1],
      values: [...set[2].matchAll(/"([^"]+)"/g)].map((match) => match[1]),
      kind: 'values' as const,
    };
  const prefix = expression.match(/^(serial|productSerial)\.startsWith\("([^"]*)"\)$/);
  if (prefix) return { field: prefix[1], values: [prefix[2]], kind: 'prefix' as const };
  return undefined;
};
const expressionsAreProvablyDisjoint = (left: string, right: string) => {
  const first = expressionParts(left);
  const second = expressionParts(right);
  if (!first || !second || first.field !== second.field) return false;
  if (first.kind === 'values' && second.kind === 'values')
    return first.values.every((value) => !second.values.includes(value));
  if (first.kind === 'prefix' && second.kind === 'prefix')
    return !first.values.some((prefix) =>
      second.values.some((other) => prefix.startsWith(other) || other.startsWith(prefix)),
    );
  const values = first.kind === 'values' ? first.values : second.values;
  const prefix = first.kind === 'prefix' ? first.values[0] : second.values[0];
  return values.every((value) => !value.startsWith(prefix));
};
const isSupportedMatchExpression = (expression: string) => {
  const value = expression.trim();
  if (
    !value ||
    !/\b(serial|productSerial|productUuid)\b/.test(value) ||
    /\b(organization|product|tpm|label|fleet)\b/.test(value)
  )
    return false;
  let depth = 0;
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
};
const formatCertificateExpiry = (days: number) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const createPrivateKeyPem = async (certificateName: string) => {
  if (typeof crypto === 'undefined' || !crypto.subtle)
    return `-----BEGIN PRIVATE KEY-----\nPrototype key for ${certificateName}\n-----END PRIVATE KEY-----\n`;
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const key = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const bytes = new Uint8Array(key);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 =
    btoa(binary)
      .match(/.{1,64}/g)
      ?.join('\n') || '';
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----\n`;
};

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const RowActions = ({ children, label }: React.PropsWithChildren<{ label: string }>) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={() => setIsOpen(false)}
      onOpenChange={setIsOpen}
      shouldFocusToggleOnSelect
      popperProps={{ placement: 'bottom-end' }}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          variant="plain"
          aria-label={label}
          isExpanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          icon={<EllipsisVIcon />}
        />
      )}
    >
      {children}
    </Dropdown>
  );
};

const EnrollmentEmptyState = ({
  title,
  body,
  icon,
  action,
  variant = EmptyStateVariant.lg,
}: {
  title: string;
  body: string;
  icon: React.ComponentType;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
}) => (
  <PatternFlyEmptyState headingLevel="h3" icon={icon} titleText={title} variant={variant}>
    <EmptyStateBody>{body}</EmptyStateBody>
    {action && (
      <EmptyStateFooter>
        <EmptyStateActions>{action}</EmptyStateActions>
      </EmptyStateFooter>
    )}
  </PatternFlyEmptyState>
);

type EnrollmentAutoApprovalPageProps = {
  embedded?: boolean;
  permissions?: Partial<EnrollmentPermissions>;
  onViewFlaggedDevices?: () => void;
  onViewCertificateDevices?: (certificate: string, needsReview: boolean) => void;
  /**
   * Real "pending approval" content (e.g. the live EnrollmentRequestList) to render in the
   * "Onboarding requests" sub-tab in place of the non-functional mock requests preview. When
   * provided, the mock requests list and its "needs review" alert are suppressed; the Approval
   * policies and Certificates sub-tabs remain a non-functional preview.
   */
  requestsContent?: React.ReactNode;
};

const EnrollmentAutoApprovalPage = ({
  embedded = false,
  permissions,
  onViewFlaggedDevices,
  onViewCertificateDevices,
  requestsContent,
}: EnrollmentAutoApprovalPageProps) => {
  const { t } = useTranslation();
  const prototypeState = useEnrollmentPrototypeState();
  const {
    revocations,
    certificates,
    setCertificates,
    registerDeviceCertificate,
    certificateToOpen,
    setCertificateToOpen,
    requestToOpen,
    setRequestToOpen,
    policyToOpen,
    setPolicyToOpen,
  } = prototypeState;
  const navigate = useNavigate();
  const access: EnrollmentPermissions = {
    requests: permissions?.requests ?? prototypeState.permissions.requests,
    policies: permissions?.policies ?? prototypeState.permissions.policies,
    certificates: permissions?.certificates ?? prototypeState.permissions.certificates,
  };
  const firstAvailableTab: EnrollmentTab = access.requests ? 'requests' : access.policies ? 'policies' : 'certificates';
  const [activeTab, setActiveTab] = React.useState<EnrollmentTab>(firstAvailableTab);
  const [view, setView] = React.useState<PageView>({ type: 'list' });
  const [policiesState, setPoliciesState] = React.useState(() => (prototypeState.data.policies ? initialPolicies : []));
  const [requests, setRequests] = React.useState(() => (prototypeState.data.requests ? initialRequests : []));
  const [requestSearch, setRequestSearch] = React.useState('');
  const [selectedRequestStatuses, setSelectedRequestStatuses] = React.useState<RequestStatus[]>([]);
  const [requestPage, setRequestPage] = React.useState(1);
  const [policyPage, setPolicyPage] = React.useState(1);
  const [certificatePage, setCertificatePage] = React.useState(1);
  const [revokeCertificateId, setRevokeCertificateId] = React.useState<string>();
  const [revokeConfirmationName, setRevokeConfirmationName] = React.useState('');
  const [isConfirmingRejectedApproval, setIsConfirmingRejectedApproval] = React.useState(false);
  const [policyConflict, setPolicyConflict] = React.useState<string>();
  const [policyDraft, setPolicyDraft] = React.useState({
    name: '',
    certificate: '',
    matchExpression: '',
    requireTPMVerification: false,
    approvalLimit: '',
    autoApprovalWindowDays: '',
    enabled: false,
  });
  const [policyFixedLabels, setPolicyFixedLabels] = React.useState<PolicyLabel[]>([]);
  const [policyAllowedLabelKeys, setPolicyAllowedLabelKeys] = React.useState<string[]>([]);
  const [certificateDraft, setCertificateDraft] = React.useState({ name: '', validityDays: '365' });
  const [privateKeyMaterial, setPrivateKeyMaterial] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setPoliciesState(prototypeState.data.policies ? initialPolicies : []);
    setRequests(prototypeState.data.requests ? initialRequests : []);
    setCertificates(prototypeState.data.certificates ? INITIAL_ENROLLMENT_CERTIFICATES : []);
    setActiveTab(firstAvailableTab);
    setView({ type: 'list' });
    setRequestSearch('');
    setSelectedRequestStatuses([]);
    setRequestPage(1);
    setPolicyPage(1);
    setCertificatePage(1);
  }, [
    firstAvailableTab,
    prototypeState.data.certificates,
    prototypeState.data.policies,
    prototypeState.data.requests,
    setCertificates,
  ]);

  React.useEffect(() => {
    setRequests((current) =>
      current.map((request) => {
        const revoked = revocations[request.certificate];
        if (revoked && request.status === 'Needs review')
          return {
            ...request,
            status: 'Rejected',
            outcome: 'Certificate revoked',
            reason: `The enrollment certificate ${request.certificate} was revoked before this request was approved.`,
            decisionHistory: [
              ...request.decisionHistory,
              'Rejected because enrollment certificate was revoked · Just now',
            ],
          };
        if (!revoked && request.outcome === 'Certificate revoked')
          return initialRequests.find((item) => item.id === request.id) || request;
        return request;
      }),
    );
  }, [revocations]);

  React.useEffect(() => {
    if (certificateToOpen && access.certificates) {
      setActiveTab('certificates');
      setView({ type: 'certificate', id: certificateToOpen });
      setCertificateToOpen(undefined);
    }
  }, [access.certificates, certificateToOpen, setCertificateToOpen]);

  React.useEffect(() => {
    if (requestToOpen && access.requests) {
      setActiveTab('requests');
      setView({ type: 'request', id: requestToOpen });
      setRequestToOpen(undefined);
    }
  }, [access.requests, requestToOpen, setRequestToOpen]);

  React.useEffect(() => {
    if (policyToOpen && access.policies) {
      const policy = policiesState.find((item) => item.name === policyToOpen || item.id === policyToOpen);
      setActiveTab('policies');
      setView(policy ? { type: 'policy', id: policy.id, editing: false } : { type: 'list' });
      setPolicyToOpen(undefined);
    }
  }, [access.policies, policiesState, policyToOpen, setPolicyToOpen]);

  const selectedRequest = view.type === 'request' ? requests.find((request) => request.id === view.id) : undefined;
  const selectedPolicy = view.type === 'policy' ? policiesState.find((policy) => policy.id === view.id) : undefined;
  const displayedCertificates = certificates.map((certificate) =>
    revocations[certificate.id] ? { ...certificate, status: 'Revoked' as const } : certificate,
  );
  const selectedCertificate =
    view.type === 'certificate' || view.type === 'certificate-created'
      ? displayedCertificates.find((certificate) => certificate.id === view.id)
      : undefined;
  const revokingCertificate = displayedCertificates.find((certificate) => certificate.id === revokeCertificateId);

  const goToList = (tab: EnrollmentTab = activeTab) => {
    setActiveTab(tab);
    setView({ type: 'list' });
    setIsConfirmingRejectedApproval(false);
    setPolicyConflict(undefined);
  };
  const toggleRequestStatus = (status: RequestStatus) => {
    setSelectedRequestStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
    setRequestPage(1);
  };
  const visibleRequests = requests.filter((request) => {
    const query = requestSearch.trim().toLowerCase();
    return (
      (selectedRequestStatuses.length === 0 || selectedRequestStatuses.includes(request.status)) &&
      (!query || `${request.device} ${request.alias}`.toLowerCase().includes(query))
    );
  });
  const pagedRequests = visibleRequests.slice((requestPage - 1) * pageSize, requestPage * pageSize);
  const pagedPolicies = policiesState.slice((policyPage - 1) * pageSize, policyPage * pageSize);
  const pagedCertificates = displayedCertificates.slice((certificatePage - 1) * pageSize, certificatePage * pageSize);
  const requestsNeedingReview = requests.filter((request) => request.status === 'Needs review').length;

  const setPolicyDraftValue = (key: keyof typeof policyDraft, value: string) =>
    setPolicyDraft((current) => ({ ...current, [key]: value }));
  const updatePolicyLabel = (index: number, text: string) => {
    const [key, ...valueParts] = text.split('=');
    const nextLabel = { key: key.trim(), value: valueParts.join('=').trim() };
    if (!nextLabel.key) return;
    setPolicyFixedLabels((current) => current.map((label, labelIndex) => (labelIndex === index ? nextLabel : label)));
  };
  const addPolicyLabel = (text: string) => {
    const [key, ...valueParts] = text.split('=');
    const nextLabel = { key: key.trim(), value: valueParts.join('=').trim() };
    if (!nextLabel.key) return;
    setPolicyFixedLabels((current) => [...current, nextLabel]);
  };
  const removePolicyLabel = (index: number) =>
    setPolicyFixedLabels((current) => current.filter((_label, labelIndex) => labelIndex !== index));
  const addPolicyAllowedLabelKey = (text: string) => {
    const key = text.trim();
    if (!key) return;
    setPolicyAllowedLabelKeys((current) => [...current, key]);
  };
  const updatePolicyAllowedLabelKey = (index: number, text: string) => {
    const key = text.trim();
    if (!key) return;
    setPolicyAllowedLabelKeys((current) => current.map((item, keyIndex) => (keyIndex === index ? key : item)));
  };
  const removePolicyAllowedLabelKey = (index: number) =>
    setPolicyAllowedLabelKeys((current) => current.filter((_key, keyIndex) => keyIndex !== index));
  const draftConditions: MatchingCondition[] = policyDraft.matchExpression.trim()
    ? [{ field: 'matchExpression', label: conditionLabels.matchExpression, value: policyDraft.matchExpression.trim() }]
    : [];
  const draftConditionSummary = policyDraft.matchExpression.trim();
  const editingPolicyId = view.type === 'policy' && view.editing ? view.id : undefined;
  const draftApprovalLimit = policyDraft.approvalLimit.trim() === '' ? undefined : Number(policyDraft.approvalLimit);
  const draftWindowDays =
    policyDraft.autoApprovalWindowDays.trim() === '' ? undefined : Number(policyDraft.autoApprovalWindowDays);
  const conflictingDraftPolicy = policiesState.find(
    (policy) =>
      policy.status === 'Enabled' &&
      policy.id !== editingPolicyId &&
      policy.certificate === policyDraft.certificate &&
      !expressionsAreProvablyDisjoint(policyMatchSummary(policy), draftConditionSummary),
  );
  const draftHasOverlap = Boolean(policyDraft.enabled && conflictingDraftPolicy);
  const draftExpressionError = Boolean(
    policyDraft.matchExpression.trim() && !isSupportedMatchExpression(policyDraft.matchExpression),
  );
  const canSavePolicy = Boolean(
    policyDraft.name.trim() &&
      policyDraft.certificate &&
      draftConditionSummary &&
      !draftExpressionError &&
      !draftHasOverlap &&
      (draftApprovalLimit === undefined || (Number.isInteger(draftApprovalLimit) && draftApprovalLimit >= 0)) &&
      (draftWindowDays === undefined ||
        (Number.isInteger(draftWindowDays) && draftWindowDays >= 1 && draftWindowDays <= 106751)),
  );

  const startCreatePolicy = () => {
    setPolicyDraft({
      name: '',
      certificate: displayedCertificates.find((certificate) => certificate.status === 'Active')?.name || '',
      matchExpression: '',
      requireTPMVerification: false,
      approvalLimit: '',
      autoApprovalWindowDays: '',
      enabled: false,
    });
    setPolicyFixedLabels([]);
    setPolicyAllowedLabelKeys([]);
    setPolicyConflict(undefined);
    setActiveTab('policies');
    setView({ type: 'policy-create' });
  };
  const startEditPolicy = (policy: EnrollmentPolicy) => {
    setPolicyDraft({
      name: policy.name,
      certificate: policy.certificate,
      matchExpression: policy.matchExpression || conditionSummary(policy.conditions),
      requireTPMVerification:
        policy.requireTPMVerification ??
        policy.conditions.some((condition) => condition.field === 'tpm' && condition.value === 'Verified'),
      approvalLimit: policy.approvalLimit?.toString() || '',
      autoApprovalWindowDays: policy.autoApprovalWindowDays?.toString() || '',
      enabled: policy.status === 'Enabled',
    });
    setPolicyFixedLabels(parsePolicyLabels(policy.deviceLabels || ''));
    setPolicyAllowedLabelKeys(
      policy.allowedIncomingLabels
        ? policy.allowedIncomingLabels
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean)
        : [],
    );
    setActiveTab('policies');
    setView({ type: 'policy', id: policy.id, editing: true });
  };
  const savePolicy = () => {
    if (!canSavePolicy) return;
    const existing = editingPolicyId ? policiesState.find((item) => item.id === editingPolicyId) : undefined;
    const policy: EnrollmentPolicy = {
      id: editingPolicyId || policyDraft.name.trim().toLowerCase().replace(/\s+/g, '-'),
      name: policyDraft.name.trim(),
      status: policyDraft.enabled ? 'Enabled' : 'Disabled',
      certificate: policyDraft.certificate,
      conditions: draftConditions,
      matchExpression: draftConditionSummary,
      requireTPMVerification: policyDraft.requireTPMVerification,
      deviceLabels: formatPolicyLabels(policyFixedLabels),
      allowedIncomingLabels: policyAllowedLabelKeys.join(','),
      approvalLimit: draftApprovalLimit,
      usedApprovals: existing?.usedApprovals || 0,
      autoApprovalWindowDays: draftWindowDays,
    };
    setPoliciesState((current) =>
      current.some((item) => item.id === policy.id)
        ? current.map((item) => (item.id === policy.id ? policy : item))
        : [...current, policy],
    );
    setView({ type: 'policy', id: policy.id, editing: false });
  };
  const togglePolicyStatus = (policyId: string) => {
    const policy = policiesState.find((item) => item.id === policyId);
    if (!policy || policy.status === 'Enabled') {
      setPoliciesState((current) =>
        current.map((item) => (item.id === policyId ? { ...item, status: 'Disabled' } : item)),
      );
      return;
    }
    const conflictingPolicy = policiesState.find(
      (item) =>
        item.id !== policyId &&
        item.status === 'Enabled' &&
        item.certificate === policy.certificate &&
        !expressionsAreProvablyDisjoint(policyMatchSummary(item), policyMatchSummary(policy)),
    );
    if (conflictingPolicy) {
      setPolicyConflict(
        `Cannot enable ${policy.name}. Its certificate and matching expression are not provably disjoint from ${conflictingPolicy.name}.`,
      );
      setView({ type: 'policy', id: policy.id, editing: false });
      return;
    }
    setPolicyConflict(undefined);
    setPoliciesState((current) =>
      current.map((item) => (item.id === policyId ? { ...item, status: 'Enabled' } : item)),
    );
  };

  const startCreateCertificate = () => {
    setCertificateDraft({ name: '', validityDays: '365' });
    setActiveTab('certificates');
    setView({ type: 'certificate-create' });
  };
  const createCertificate = async () => {
    const name = certificateDraft.name.trim();
    const validityDays = Number(certificateDraft.validityDays);
    if (!name || !Number.isInteger(validityDays) || validityDays < 1) return;
    const baseId = name.toLowerCase().replace(/\s+/g, '-');
    const id = certificates.some((certificate) => certificate.id === baseId)
      ? `${baseId}-${certificates.length + 1}`
      : baseId;
    const certificate: EnrollmentCertificate = {
      id,
      name: id === baseId ? name : `${name} (${certificates.length + 1})`,
      status: 'Active',
      expires: formatCertificateExpiry(validityDays),
      daysRemaining: validityDays,
      policies: 'Not assigned',
      privateKeyDownloaded: false,
      validityDays,
    };
    const privateKey = await createPrivateKeyPem(certificate.name);
    setPrivateKeyMaterial((current) => ({ ...current, [certificate.id]: privateKey }));
    setCertificates((current) => [...current, certificate]);
    setView({ type: 'certificate-created', id: certificate.id });
  };
  const downloadPrivateKey = (certificate: EnrollmentCertificate) => {
    downloadTextFile(
      `${certificate.name}-private-key.pem`,
      privateKeyMaterial[certificate.id] ||
        `-----BEGIN PRIVATE KEY-----\nKey is no longer available in this browser session.\n-----END PRIVATE KEY-----\n`,
    );
    setPrivateKeyMaterial((current) => {
      const next = { ...current };
      delete next[certificate.id];
      return next;
    });
    setCertificates((current) =>
      current.map((item) => (item.id === certificate.id ? { ...item, privateKeyDownloaded: true } : item)),
    );
  };
  const downloadCertificate = (certificate: EnrollmentCertificate) =>
    downloadTextFile(
      `${certificate.name}.crt`,
      `-----BEGIN CERTIFICATE-----\nPrototype certificate for ${certificate.name}\n-----END CERTIFICATE-----\n`,
    );
  const downloadAgentsYaml = (certificate: EnrollmentCertificate) =>
    downloadTextFile(
      `${certificate.name}-agents.yaml`,
      `apiVersion: flightctl.io/v1alpha1\nkind: AgentConfig\nmetadata:\n  name: ${certificate.name}\nspec:\n  enrollment:\n    certificate: ${certificate.name}.crt\n`,
    );

  const approveRequest = (requestId: string) => {
    setRequests((current) =>
      current.map((request) => {
        if (request.id !== requestId) return request;
        if (request.enrolledDeviceId) {
          registerDeviceCertificate(request.enrolledDeviceId, request.certificate);
        }
        return {
          ...request,
          status: 'Approved' as const,
          outcome: 'Manually approved',
          reason: 'An administrator explicitly approved this device onboarding request.',
          decisionHistory: [...request.decisionHistory, 'Approved by you · Just now'],
        };
      }),
    );
    setIsConfirmingRejectedApproval(false);
  };
  const rejectRequest = (requestId: string) =>
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: 'Rejected',
              outcome: 'Manually rejected',
              reason: 'An administrator rejected this device onboarding request.',
              decisionHistory: [...request.decisionHistory, 'Rejected by you · Just now'],
            }
          : request,
      ),
    );
  const revokeCertificate = () => {
    if (!revokingCertificate || revokeConfirmationName !== revokingCertificate.name) return;
    const affected = requests.filter(
      (request) =>
        request.certificate === revokingCertificate.name &&
        request.status === 'Approved' &&
        request.outcome === 'Automatically approved' &&
        request.enrolledDeviceId,
    );
    prototypeState.revokeCertificate(
      revokingCertificate.id,
      affected.map((request) => ({
        deviceId: request.enrolledDeviceId as string,
        requestId: request.id,
        policyName: request.policy,
      })),
    );
    setRevokeCertificateId(undefined);
    setRevokeConfirmationName('');
  };
  const viewFlaggedDevices = (certificateName?: string) => {
    if (onViewCertificateDevices && certificateName) {
      onViewCertificateDevices(certificateName, true);
      return;
    }
    prototypeState.setShowFlaggedDevicesOnly(true);
    if (onViewFlaggedDevices) onViewFlaggedDevices();
    else navigate(ROUTE.DEVICES);
  };
  const renderPagination = (itemCount: number, page: number, onPageChange: (nextPage: number) => void) =>
    itemCount > 0 ? (
      <Pagination
        itemCount={itemCount}
        perPage={pageSize}
        page={page}
        variant={PaginationVariant.bottom}
        onSetPage={(_event, nextPage) => onPageChange(nextPage)}
      />
    ) : null;
  const renderPermissionState = (label: string) => (
    <EnrollmentEmptyState
      title="Access permissions needed"
      body={`To view ${label.toLowerCase()}, ask an administrator to grant access.`}
      icon={LockIcon}
    />
  );

  const renderRequestDetails = () => {
    if (!selectedRequest) return renderPermissionState('this request');
    return (
      <Stack hasGutter>
        <StackItem>
          <Breadcrumb>
            <BreadcrumbItem>
              <Button variant="link" isInline onClick={() => goToList('requests')}>
                Onboarding requests
              </Button>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{selectedRequest.device}</BreadcrumbItem>
          </Breadcrumb>
        </StackItem>
        <StackItem>
          <div className="enrollment-auto-approval__detail-header">
            <div>
              <Title headingLevel="h1" size="2xl">
                {selectedRequest.device}
              </Title>
              <Content>{selectedRequest.alias}</Content>
            </div>
            <div>
              {selectedRequest.status === 'Needs review' && (
                <>
                  <Button variant="primary" onClick={() => approveRequest(selectedRequest.id)}>
                    Approve
                  </Button>{' '}
                  <Button variant="danger" onClick={() => rejectRequest(selectedRequest.id)}>
                    Reject
                  </Button>
                </>
              )}
              {selectedRequest.status === 'Rejected' && !isConfirmingRejectedApproval && (
                <Button variant="primary" onClick={() => setIsConfirmingRejectedApproval(true)}>
                  Approve rejected request
                </Button>
              )}
              {selectedRequest.status === 'Rejected' && isConfirmingRejectedApproval && (
                <>
                  <Button variant="primary" onClick={() => approveRequest(selectedRequest.id)}>
                    Confirm approval
                  </Button>{' '}
                  <Button variant="link" onClick={() => setIsConfirmingRejectedApproval(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </StackItem>
        <StackItem>
          <Alert
            isInline
            variant={
              selectedRequest.status === 'Approved'
                ? 'success'
                : selectedRequest.status === 'Rejected'
                  ? 'danger'
                  : 'warning'
            }
            title={selectedRequest.outcome}
          >
            {selectedRequest.reason}
          </Alert>
        </StackItem>
        <StackItem>
          <Grid hasGutter>
            <GridItem md={6}>
              <Card>
                <CardHeader>
                  <CardTitle>Request details</CardTitle>
                </CardHeader>
                <CardBody>
                  <DescriptionList columnModifier={{ default: '1Col', md: '2Col' }}>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Status</DescriptionListTerm>
                      <DescriptionListDescription>
                        <StatusLabel status={selectedRequest.status} />
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Enrollment certificate</DescriptionListTerm>
                      <DescriptionListDescription>{selectedRequest.certificate}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Policy result</DescriptionListTerm>
                      <DescriptionListDescription>{selectedRequest.policy}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Submitted</DescriptionListTerm>
                      <DescriptionListDescription>{selectedRequest.submitted}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>TPM status</DescriptionListTerm>
                      <DescriptionListDescription>{selectedRequest.tpmStatus}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>System information</DescriptionListTerm>
                      <DescriptionListDescription>{selectedRequest.systemInfo}</DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                </CardBody>
              </Card>
            </GridItem>
            <GridItem md={6}>
              <Card>
                <CardHeader>
                  <CardTitle>Device labels</CardTitle>
                </CardHeader>
                <CardBody>
                  <DescriptionList isHorizontal isCompact>
                    {Object.entries(selectedRequest.labels).map(([key, value]) => (
                      <DescriptionListGroup key={key}>
                        <DescriptionListTerm>{key}</DescriptionListTerm>
                        <DescriptionListDescription>{value}</DescriptionListDescription>
                      </DescriptionListGroup>
                    ))}
                  </DescriptionList>
                  <Content component="small">
                    Labels and device identity are shown here for review. Edit them from the device details page.
                  </Content>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </StackItem>
        <StackItem>
          <Card>
            <CardHeader>
              <CardTitle>Decision history</CardTitle>
            </CardHeader>
            <CardBody>
              <ul>
                {selectedRequest.decisionHistory.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </StackItem>
      </Stack>
    );
  };

  const renderPolicyForm = (isEditing: boolean) => {
    const selectedCertificate = displayedCertificates.find(
      (certificate) => certificate.name === policyDraft.certificate,
    );
    return (
      <FlightCtlForm className="enrollment-auto-approval__form pf-m-limit-width">
        <Stack hasGutter>
          <StackItem>
            <Breadcrumb>
              <BreadcrumbItem>
                <Button variant="link" isInline onClick={() => goToList('policies')}>
                  Approval policies
                </Button>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{isEditing ? 'Edit policy' : 'Create policy'}</BreadcrumbItem>
            </Breadcrumb>
          </StackItem>
          <StackItem>
            <Title headingLevel="h1" size="2xl">
              {isEditing ? 'Edit approval policy' : 'Create approval policy'}
            </Title>
            <Content>
              Choose the certificate and supported device identifiers that can qualify for automatic approval.
            </Content>
          </StackItem>
          <StackItem>
            <Stack hasGutter>
              <StackItem>
                <FormGroup label="Policy name" isRequired fieldId="enrollment-policy-name">
                  <TextInput
                    id="enrollment-policy-name"
                    value={policyDraft.name}
                    onChange={(_event, value) => setPolicyDraftValue('name', value)}
                  />
                </FormGroup>
              </StackItem>
              <StackItem>
                <FormGroup label="Enrollment certificate" isRequired fieldId="enrollment-policy-certificate">
                  <FormSelect
                    id="enrollment-policy-certificate"
                    value={policyDraft.certificate}
                    onChange={(_event, value) => setPolicyDraftValue('certificate', value)}
                  >
                    <FormSelectOption value="" label="Select a certificate" isDisabled />
                    {displayedCertificates
                      .filter((certificate) => certificate.status === 'Active')
                      .map((certificate) => (
                        <FormSelectOption key={certificate.id} value={certificate.name} label={certificate.name} />
                      ))}
                  </FormSelect>
                  {selectedCertificate && (
                    <Content component="small">
                      Expires {selectedCertificate.expires} (
                      {selectedCertificate.daysRemaining < 0
                        ? 'expired'
                        : `${selectedCertificate.daysRemaining} days remaining`}
                      ).
                    </Content>
                  )}
                </FormGroup>
              </StackItem>
              <StackItem>
                <FormGroup label="Matching expression" isRequired fieldId="enrollment-policy-expression">
                  <TextArea
                    id="enrollment-policy-expression"
                    value={policyDraft.matchExpression}
                    onChange={(_event, value) => setPolicyDraftValue('matchExpression', value)}
                    placeholder={'serial.startsWith("N-")'}
                  />
                  <Content component="small">
                    Use serial, productSerial, and productUuid. Supports exact values, finite sets, prefixes for serial
                    and productSerial, and AND/OR with parentheses. Missing identifiers do not satisfy a comparison.
                  </Content>
                </FormGroup>
              </StackItem>
              <StackItem>
                <Checkbox
                  id="enrollment-policy-tpm"
                  isChecked={policyDraft.requireTPMVerification}
                  onChange={(_event, checked) =>
                    setPolicyDraft((current) => ({ ...current, requireTPMVerification: checked }))
                  }
                  label="Require TPM verification"
                />
                <Content component="small">
                  Only server-verified TPM evidence satisfies this requirement. It is separate from the reported device
                  identifiers above.
                </Content>
              </StackItem>
              <StackItem>
                <FormGroup label="Fixed device labels" fieldId="enrollment-policy-device-labels">
                  <LabelGroup
                    id="enrollment-policy-device-labels"
                    isEditable
                    addLabelControl={<EditableLabelControl onAddLabel={addPolicyLabel} />}
                  >
                    {policyFixedLabels.map((label, index) => {
                      const text = label.value ? `${label.key}=${label.value}` : label.key;
                      return (
                        <Label
                          key={`${label.key}-${index}`}
                          isEditable
                          onClose={() => removePolicyLabel(index)}
                          onEditCancel={(_event, previousText) => updatePolicyLabel(index, previousText)}
                          onEditComplete={(_event, nextText) => updatePolicyLabel(index, nextText)}
                        >
                          {text}
                        </Label>
                      );
                    })}
                  </LabelGroup>
                  <Content component="small">
                    Add fixed key-value labels. Fixed values override conflicting reported values.
                  </Content>
                </FormGroup>
              </StackItem>
              <StackItem>
                <FormGroup label="Allowed incoming label keys" fieldId="enrollment-policy-allowed-labels">
                  <LabelGroup
                    id="enrollment-policy-allowed-labels"
                    isEditable
                    addLabelControl={
                      <EditableLabelControl addButtonText="Add key" onAddLabel={addPolicyAllowedLabelKey} />
                    }
                  >
                    {policyAllowedLabelKeys.map((key, index) => (
                      <Label
                        key={`${key}-${index}`}
                        isEditable
                        onClose={() => removePolicyAllowedLabelKey(index)}
                        onEditCancel={(_event, previousText) => updatePolicyAllowedLabelKey(index, previousText)}
                        onEditComplete={(_event, nextText) => updatePolicyAllowedLabelKey(index, nextText)}
                      >
                        {key}
                      </Label>
                    ))}
                  </LabelGroup>
                  <Content component="small">
                    Optional. Add keys from device-reported labels. Other reported keys are dropped.
                  </Content>
                </FormGroup>
              </StackItem>
              <StackItem>
                <FormGroup label="Lifetime automatic approvals" fieldId="enrollment-policy-limit">
                  <TextInput
                    id="enrollment-policy-limit"
                    type="number"
                    min={0}
                    value={policyDraft.approvalLimit}
                    onChange={(_event, value) => setPolicyDraftValue('approvalLimit', value)}
                  />
                  <Content component="small">
                    Leave blank for unlimited. Enter 0 to block automatic approval. This limit belongs to the policy,
                    not the certificate.
                  </Content>
                </FormGroup>
              </StackItem>
              <StackItem>
                <FormGroup label="Auto-approval window (days)" fieldId="enrollment-policy-window">
                  <TextInput
                    id="enrollment-policy-window"
                    type="number"
                    min={1}
                    max={106751}
                    value={policyDraft.autoApprovalWindowDays}
                    onChange={(_event, value) => setPolicyDraftValue('autoApprovalWindowDays', value)}
                  />
                  <Content component="small">
                    Measured from certificate issuance. Leave blank to use the certificate validity period.
                  </Content>
                </FormGroup>
              </StackItem>
              <StackItem>
                <Checkbox
                  id="enrollment-policy-enabled"
                  isChecked={policyDraft.enabled}
                  onChange={(_event, checked) => setPolicyDraft((current) => ({ ...current, enabled: checked }))}
                  label="Enable automatic approval"
                />
                <Content component="small">
                  Disabled by default. Enable after reviewing the expression, labels, and certificate.
                </Content>
              </StackItem>
              <StackItem>
                <Alert
                  isInline
                  variant={draftExpressionError || draftHasOverlap ? 'danger' : 'info'}
                  title={
                    draftExpressionError
                      ? 'Use a supported matching expression'
                      : draftHasOverlap
                        ? 'An enabled policy conflicts with this match'
                        : 'How matching works'
                  }
                >
                  {draftExpressionError
                    ? 'Use only serial, productSerial, and productUuid with exact values, finite sets, prefixes, AND, OR, and parentheses.'
                    : draftHasOverlap
                      ? `This expression is not provably disjoint from ${conflictingDraftPolicy?.name}. Use a different expression or disable the conflicting policy.`
                      : 'A device is approved only when exactly one enabled policy for its certificate passes. No match or multiple matches leaves the request pending for review.'}
                </Alert>
              </StackItem>
            </Stack>
          </StackItem>
          <StackItem>
            <Button variant="primary" isDisabled={!canSavePolicy} onClick={savePolicy}>
              {isEditing ? 'Save policy' : 'Create policy'}
            </Button>{' '}
            <Button variant="link" onClick={() => goToList('policies')}>
              Cancel
            </Button>
          </StackItem>
        </Stack>
      </FlightCtlForm>
    );
  };

  const renderPolicyDetails = () => {
    if (!selectedPolicy) return renderPermissionState('this policy');
    if (view.type === 'policy' && view.editing) return renderPolicyForm(true);
    return (
      <Stack hasGutter>
        <StackItem>
          <Breadcrumb>
            <BreadcrumbItem>
              <Button variant="link" isInline onClick={() => goToList('policies')}>
                Approval policies
              </Button>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{selectedPolicy.name}</BreadcrumbItem>
          </Breadcrumb>
        </StackItem>
        <StackItem>
          <div className="enrollment-auto-approval__detail-header">
            <div>
              <Title headingLevel="h1" size="2xl">
                {selectedPolicy.name}
              </Title>
              <Content>{policyMatchSummary(selectedPolicy)}</Content>
            </div>
            <DetailsPageActions>
              <ActionsDropdownList>
                <ActionsDropdownList.Item>
                  <DropdownItem onClick={() => startEditPolicy(selectedPolicy)}>Edit policy</DropdownItem>
                </ActionsDropdownList.Item>
                <ActionsDropdownList.Item>
                  <DropdownItem onClick={() => togglePolicyStatus(selectedPolicy.id)}>
                    {selectedPolicy.status === 'Enabled' ? 'Disable policy' : 'Enable policy'}
                  </DropdownItem>
                </ActionsDropdownList.Item>
              </ActionsDropdownList>
            </DetailsPageActions>
          </div>
        </StackItem>
        {selectedPolicy.status === 'Disabled' && (
          <StackItem>
            <Alert isInline variant="warning" title="Policy is disabled">
              Disabled policies are ignored when matching new onboarding requests.
            </Alert>
          </StackItem>
        )}
        {policyConflict && (
          <StackItem>
            <Alert isInline variant="danger" title="Policy could not be enabled">
              {policyConflict}
            </Alert>
          </StackItem>
        )}
        <StackItem>
          <Card>
            <CardBody>
              <DescriptionList columnModifier={{ default: '1Col', md: '2Col' }}>
                <DescriptionListGroup>
                  <DescriptionListTerm>Status</DescriptionListTerm>
                  <DescriptionListDescription>
                    <StatusLabel status={selectedPolicy.status} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Enrollment certificate</DescriptionListTerm>
                  <DescriptionListDescription>{selectedPolicy.certificate}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Matching expression</DescriptionListTerm>
                  <DescriptionListDescription>{policyMatchSummary(selectedPolicy)}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>TPM verification</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedPolicy.requireTPMVerification ? 'Required' : 'Not required'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Fixed device labels</DescriptionListTerm>
                  <DescriptionListDescription>{selectedPolicy.deviceLabels || 'None'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Allowed incoming label keys</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedPolicy.allowedIncomingLabels || 'None'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Approval limit')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <ApprovalLimit policy={selectedPolicy} showExplanation />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Auto-approval window</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedPolicy.autoApprovalWindowDays === undefined
                      ? 'Certificate validity'
                      : `${selectedPolicy.autoApprovalWindowDays} days from certificate issuance`}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Decision behavior</DescriptionListTerm>
                  <DescriptionListDescription>
                    Automatically approves only when exactly one enabled policy for this certificate passes.
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>
        </StackItem>
      </Stack>
    );
  };

  const renderCertificateForm = () => (
    <FlightCtlForm className="enrollment-auto-approval__form pf-m-limit-width">
      <Stack hasGutter>
        <StackItem>
          <Breadcrumb>
            <BreadcrumbItem>
              <Button variant="link" isInline onClick={() => goToList('certificates')}>
                Certificates
              </Button>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>Create certificate</BreadcrumbItem>
          </Breadcrumb>
        </StackItem>
        <StackItem>
          <Title headingLevel="h1" size="2xl">
            Create enrollment certificate
          </Title>
          <Content>Create the enrollment credential used by an approval policy to onboard devices.</Content>
        </StackItem>
        <StackItem>
          <Alert isInline variant="warning" title="Download the private key once">
            A P-256 key pair is generated in your browser for this prototype. The certificate request and issued
            certificate are represented in this flow; production implementation should submit only a PKCS#10 CSR. Flight
            Control must not store the private key. Download it immediately after creation because it cannot be
            retrieved again.
          </Alert>
        </StackItem>
        <StackItem>
          <Stack hasGutter>
            <StackItem>
              <FormGroup label="Certificate name" isRequired fieldId="enrollment-certificate-name">
                <TextInput
                  id="enrollment-certificate-name"
                  value={certificateDraft.name}
                  onChange={(_event, value) => setCertificateDraft((current) => ({ ...current, name: value }))}
                  placeholder="For example, retail-factory"
                />
              </FormGroup>
            </StackItem>
            <StackItem>
              <FormGroup label="Validity period (days)" isRequired fieldId="enrollment-certificate-validity">
                <TextInput
                  id="enrollment-certificate-validity"
                  type="number"
                  min={1}
                  value={certificateDraft.validityDays}
                  onChange={(_event, value) => setCertificateDraft((current) => ({ ...current, validityDays: value }))}
                />
                <Content component="small">
                  The server calculates the expiration date when the certificate is issued. Approval limits are
                  configured on policies, not certificates.
                </Content>
              </FormGroup>
            </StackItem>
          </Stack>
        </StackItem>
        <StackItem>
          <Button
            variant="primary"
            isDisabled={
              !certificateDraft.name.trim() ||
              !Number.isInteger(Number(certificateDraft.validityDays)) ||
              Number(certificateDraft.validityDays) < 1
            }
            onClick={createCertificate}
          >
            Create certificate
          </Button>{' '}
          <Button variant="link" onClick={() => goToList('certificates')}>
            Cancel
          </Button>
        </StackItem>
      </Stack>
    </FlightCtlForm>
  );

  const renderCertificateDetails = (created: boolean) => {
    if (!selectedCertificate) return renderPermissionState('this certificate');
    const flagged = prototypeState.flaggedDevices.filter((device) => device.certificateId === selectedCertificate.id);
    const reviewed = prototypeState.reviewedDevices.filter((device) => device.certificateId === selectedCertificate.id);
    const previouslyApproved = requests.filter(
      (request) =>
        request.certificate === selectedCertificate.name &&
        request.outcome === 'Automatically approved' &&
        request.enrolledDeviceId,
    );
    return (
      <Stack hasGutter>
        <StackItem>
          <Breadcrumb>
            <BreadcrumbItem>
              <Button variant="link" isInline onClick={() => goToList('certificates')}>
                Certificates
              </Button>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{selectedCertificate.name}</BreadcrumbItem>
          </Breadcrumb>
        </StackItem>
        <StackItem>
          <div className="enrollment-auto-approval__detail-header">
            <div>
              <Title headingLevel="h1" size="2xl">
                {selectedCertificate.name}
              </Title>
              <Content>Enrollment certificate details</Content>
            </div>
            {!created && (
              <DetailsPageActions>
                <ActionsDropdownList>
                  <ActionsDropdownList.Item>
                    <DropdownItem onClick={() => downloadAgentsYaml(selectedCertificate)}>
                      Download agents.yaml
                    </DropdownItem>
                  </ActionsDropdownList.Item>
                  <ActionsDropdownList.Item>
                    <DropdownItem onClick={() => downloadCertificate(selectedCertificate)}>
                      Download certificate
                    </DropdownItem>
                  </ActionsDropdownList.Item>
                  {selectedCertificate.status === 'Active' && (
                    <ActionsDropdownList.Item isDanger>
                      <DropdownItem
                        onClick={() => {
                          setRevokeConfirmationName('');
                          setRevokeCertificateId(selectedCertificate.id);
                        }}
                      >
                        Revoke certificate
                      </DropdownItem>
                    </ActionsDropdownList.Item>
                  )}
                </ActionsDropdownList>
              </DetailsPageActions>
            )}
          </div>
        </StackItem>
        {created && (
          <StackItem>
            <Alert isInline variant="warning" title="Download the private key now">
              The key was generated in your browser and is not stored by Flight Control. Download it now; it will not be
              available again. The agents.yaml and certificate downloads do not contain the private key.
            </Alert>
          </StackItem>
        )}
        {selectedCertificate.status === 'Revoked' && (
          <StackItem>
            <Alert isInline variant="warning" title="Certificate revoked">
              New enrollments using this certificate are blocked. Pending requests using it were rejected. Existing
              devices remain enrolled.{' '}
              {flagged.length
                ? `${flagged.length} ${flagged.length === 1 ? 'device needs' : 'devices need'} enrollment review.`
                : 'No devices need enrollment review.'}{' '}
              {flagged.length > 0 && (
                <Button variant="link" isInline onClick={() => viewFlaggedDevices(selectedCertificate.name)}>
                  View devices needing review
                </Button>
              )}
            </Alert>
          </StackItem>
        )}
        {selectedCertificate.daysRemaining >= 0 && selectedCertificate.daysRemaining <= 30 && (
          <StackItem>
            <Alert isInline variant="warning" title="Certificate expires soon">
              {selectedCertificate.daysRemaining} days remaining until {selectedCertificate.expires}.
            </Alert>
          </StackItem>
        )}
        <StackItem>
          <Card>
            <CardBody>
              <DescriptionList columnModifier={{ default: '1Col', md: '2Col' }}>
                <DescriptionListGroup>
                  <DescriptionListTerm>Status</DescriptionListTerm>
                  <DescriptionListDescription>
                    <StatusLabel status={selectedCertificate.status} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Validity period</DescriptionListTerm>
                  <DescriptionListDescription>{selectedCertificate.validityDays} days</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Expires</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedCertificate.expires} (
                    {selectedCertificate.daysRemaining < 0
                      ? 'expired'
                      : `${selectedCertificate.daysRemaining} days remaining`}
                    )
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Used by policy</DescriptionListTerm>
                  <DescriptionListDescription>{selectedCertificate.policies}</DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>
        </StackItem>
        <StackItem>
          <Card>
            <CardHeader>
              <CardTitle>{created ? 'Required downloads' : 'Downloads'}</CardTitle>
            </CardHeader>
            <CardBody>
              <Button variant="primary" onClick={() => downloadAgentsYaml(selectedCertificate)}>
                Download agents.yaml
              </Button>{' '}
              <Button variant="secondary" onClick={() => downloadCertificate(selectedCertificate)}>
                Download certificate
              </Button>
              {created && (
                <>
                  {' '}
                  <Button
                    variant="secondary"
                    isDisabled={selectedCertificate.privateKeyDownloaded}
                    onClick={() => downloadPrivateKey(selectedCertificate)}
                  >
                    {selectedCertificate.privateKeyDownloaded ? 'Private key downloaded' : 'Download private key'}
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </StackItem>
        <StackItem>
          <Card>
            <CardHeader>
              <CardTitle>Devices automatically approved with this certificate</CardTitle>
            </CardHeader>
            <CardBody>
              {previouslyApproved.length ? (
                <>
                  <Content>
                    {selectedCertificate.status === 'Revoked'
                      ? 'Open a device to investigate its enrollment review.'
                      : 'These devices would need review if the certificate were revoked.'}
                  </Content>
                  <ul>
                    {previouslyApproved.map((request) => (
                      <li key={request.id}>
                        <Button
                          variant="link"
                          isInline
                          onClick={() => navigate({ route: ROUTE.DEVICE_DETAILS, postfix: request.enrolledDeviceId })}
                        >
                          {request.enrolledDeviceId}
                        </Button>
                        {flagged.some((device) => device.requestId === request.id) && (
                          <>
                            {' '}
                            <EnrollmentReviewIndicator />
                          </>
                        )}
                        {reviewed.some((device) => device.requestId === request.id) && (
                          <>
                            {' '}
                            <Label
                              color={
                                reviewed.some((device) => device.requestId === request.id && device.decommissionedAt)
                                  ? 'grey'
                                  : 'green'
                              }
                              isCompact
                            >
                              {reviewed.some((device) => device.requestId === request.id && device.decommissionedAt)
                                ? 'Decommissioned'
                                : 'Reviewed'}
                            </Label>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Content>No devices were automatically approved with this certificate.</Content>
              )}
            </CardBody>
          </Card>
        </StackItem>
      </Stack>
    );
  };

  const renderRequestsTab = () => {
    if (!access.requests) return renderPermissionState('requests');
    const hasRequestFilters = Boolean(requestSearch.trim() || selectedRequestStatuses.length);
    return (
      <>
        <div className="enrollment-auto-approval__tab-description">
          <Content>See why each request was approved, rejected, or needs review.</Content>
        </div>
        <Toolbar
          id="device-onboarding-requests-toolbar"
          className="enrollment-auto-approval__request-toolbar"
          inset={{ default: 'insetNone' }}
        >
          <ToolbarContent>
            <ToolbarGroup>
              <ToolbarItem>
                <SearchInput
                  aria-label="Search requests by name"
                  placeholder="Search by name"
                  value={requestSearch}
                  onChange={(_event, value) => {
                    setRequestSearch(value);
                    setRequestPage(1);
                  }}
                  onClear={() => {
                    setRequestSearch('');
                    setRequestPage(1);
                  }}
                />
              </ToolbarItem>
            </ToolbarGroup>
            <ToolbarGroup variant="filter-group">
              <ToolbarItem>
                <ToggleGroup aria-label="Filter requests by status">
                  {requestStatuses.map((status) => (
                    <ToggleGroupItem
                      key={status}
                      text={status}
                      buttonId={`request-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                      isSelected={selectedRequestStatuses.includes(status)}
                      onChange={() => toggleRequestStatus(status)}
                    />
                  ))}
                </ToggleGroup>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
        {visibleRequests.length ? (
          <>
            <Table
              variant="compact"
              className="enrollment-auto-approval__data-table"
              aria-label="Device onboarding requests"
            >
              <Thead>
                <Tr>
                  <Th>Device</Th>
                  <Th>Request status</Th>
                  <Th>Decision</Th>
                  <Th>Policy</Th>
                  <Th>Submitted</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pagedRequests.map((request) => (
                  <Tr key={request.id}>
                    <Td dataLabel="Device">
                      <Button variant="link" isInline onClick={() => setView({ type: 'request', id: request.id })}>
                        {request.device}
                      </Button>
                    </Td>
                    <Td dataLabel="Request status">
                      <StatusLabel status={request.status} />
                    </Td>
                    <Td dataLabel="Decision">{request.outcome}</Td>
                    <Td dataLabel="Policy">{request.policy}</Td>
                    <Td dataLabel="Submitted">{request.submitted}</Td>
                    <Td dataLabel="Actions">
                      {request.status === 'Needs review' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setView({ type: 'request', id: request.id })}
                        >
                          Review request
                        </Button>
                      ) : (
                        <Button variant="link" isInline onClick={() => setView({ type: 'request', id: request.id })}>
                          View details
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {renderPagination(visibleRequests.length, requestPage, setRequestPage)}
          </>
        ) : (
          <EnrollmentEmptyState
            title={hasRequestFilters ? 'No matching requests' : 'No device onboarding requests yet'}
            body={
              hasRequestFilters
                ? 'Try a different name or clear the status filters.'
                : 'Requests will appear here after a device submits an onboarding request.'
            }
            icon={SearchIcon}
            variant={EmptyStateVariant.sm}
            action={
              hasRequestFilters ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRequestSearch('');
                    setSelectedRequestStatuses([]);
                    setRequestPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
      </>
    );
  };

  const renderPoliciesTab = () => {
    if (!access.policies) return renderPermissionState('approval policies');
    return (
      <>
        <div className="enrollment-auto-approval__tab-description">
          <Content>
            Define which requests can be approved automatically and what happens when the decision is not safe.
          </Content>
          <Button variant="primary" onClick={startCreatePolicy}>
            Create policy
          </Button>
        </div>
        {!policiesState.length ? (
          <EnrollmentEmptyState
            title="No approval policies yet"
            body="Create an approval policy to automatically approve matching onboarding requests."
            icon={PlusCircleIcon}
            action={
              <Button variant="primary" onClick={startCreatePolicy}>
                Create policy
              </Button>
            }
          />
        ) : (
          <>
            <Table variant="compact" className="enrollment-auto-approval__data-table" aria-label="Approval policies">
              <Thead>
                <Tr>
                  <Th>Policy name</Th>
                  <Th>Status</Th>
                  <Th>Enrollment certificate</Th>
                  <Th>Approval limit</Th>
                  <Th screenReaderText="Row actions" />
                </Tr>
              </Thead>
              <Tbody>
                {pagedPolicies.map((policy) => (
                  <Tr key={policy.id}>
                    <Td dataLabel="Policy name">
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setView({ type: 'policy', id: policy.id, editing: false })}
                      >
                        {policy.name}
                      </Button>
                    </Td>
                    <Td dataLabel="Status">
                      <StatusLabel status={policy.status} />
                    </Td>
                    <Td dataLabel="Enrollment certificate">{policy.certificate}</Td>
                    <Td dataLabel={t('Approval limit')}>
                      <ApprovalLimit policy={policy} />
                    </Td>
                    <Td isActionCell>
                      <RowActions label={`Actions for ${policy.name}`}>
                        <ActionsDropdownList>
                          <ActionsDropdownList.Item>
                            <DropdownItem onClick={() => setView({ type: 'policy', id: policy.id, editing: false })}>
                              View details
                            </DropdownItem>
                          </ActionsDropdownList.Item>
                          <ActionsDropdownList.Item>
                            <DropdownItem onClick={() => startEditPolicy(policy)}>Edit policy</DropdownItem>
                          </ActionsDropdownList.Item>
                          <ActionsDropdownList.Item>
                            <DropdownItem onClick={() => togglePolicyStatus(policy.id)}>
                              {policy.status === 'Enabled' ? 'Disable policy' : 'Enable policy'}
                            </DropdownItem>
                          </ActionsDropdownList.Item>
                        </ActionsDropdownList>
                      </RowActions>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {renderPagination(policiesState.length, policyPage, setPolicyPage)}
          </>
        )}
      </>
    );
  };

  const renderCertificatesTab = () => {
    if (!access.certificates) return renderPermissionState('certificates');
    return (
      <>
        <div className="enrollment-auto-approval__tab-description">
          <Content>Certificates establish which policies can approve requests and how long they remain usable.</Content>
          <Button variant="primary" onClick={startCreateCertificate}>
            Create certificate
          </Button>
        </div>
        {!certificates.length ? (
          <EnrollmentEmptyState
            title="No enrollment certificates yet"
            body="Create an enrollment certificate before adding an approval policy."
            icon={PlusCircleIcon}
            action={
              <Button variant="primary" onClick={startCreateCertificate}>
                Create certificate
              </Button>
            }
          />
        ) : (
          <>
            <Table
              variant="compact"
              className="enrollment-auto-approval__data-table"
              aria-label="Enrollment certificates"
            >
              <Thead>
                <Tr>
                  <Th>Certificate</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  <Th>Used by policy</Th>
                  <Th screenReaderText="Row actions" />
                </Tr>
              </Thead>
              <Tbody>
                {pagedCertificates.map((certificate) => (
                  <Tr key={certificate.id}>
                    <Td dataLabel="Certificate">
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setView({ type: 'certificate', id: certificate.id })}
                      >
                        {certificate.name}
                      </Button>
                    </Td>
                    <Td dataLabel="Status">
                      <StatusLabel status={certificate.status} />
                    </Td>
                    <Td dataLabel="Expires">
                      {certificate.expires} (
                      {certificate.daysRemaining < 0 ? 'expired' : `${certificate.daysRemaining} days remaining`})
                      {certificate.daysRemaining >= 0 && certificate.daysRemaining <= 30 && (
                        <Label isCompact color="orange" className="enrollment-auto-approval__secondary-label">
                          Expires soon
                        </Label>
                      )}
                    </Td>
                    <Td dataLabel="Used by policy">{certificate.policies}</Td>
                    <Td isActionCell>
                      <RowActions label={`Actions for ${certificate.name}`}>
                        <ActionsDropdownList>
                          <ActionsDropdownList.Item>
                            <DropdownItem onClick={() => setView({ type: 'certificate', id: certificate.id })}>
                              View details
                            </DropdownItem>
                          </ActionsDropdownList.Item>
                          <ActionsDropdownList.Item>
                            <DropdownItem onClick={() => downloadAgentsYaml(certificate)}>
                              Download agents.yaml
                            </DropdownItem>
                          </ActionsDropdownList.Item>
                          <ActionsDropdownList.Item>
                            <DropdownItem onClick={() => downloadCertificate(certificate)}>
                              Download certificate
                            </DropdownItem>
                          </ActionsDropdownList.Item>
                          {certificate.status === 'Active' && (
                            <ActionsDropdownList.Item isDanger>
                              <DropdownItem
                                onClick={() => {
                                  setRevokeConfirmationName('');
                                  setRevokeCertificateId(certificate.id);
                                }}
                              >
                                Revoke certificate
                              </DropdownItem>
                            </ActionsDropdownList.Item>
                          )}
                        </ActionsDropdownList>
                      </RowActions>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {renderPagination(certificates.length, certificatePage, setCertificatePage)}
          </>
        )}
      </>
    );
  };

  const renderList = () => (
    <Stack hasGutter>
      {!access.requests && !access.policies && !access.certificates ? (
        <StackItem>{renderPermissionState('onboarding')}</StackItem>
      ) : (
        <>
          {access.requests && !requestsContent && requestsNeedingReview > 0 && (
            <StackItem>
              <Alert isInline variant="warning" title="Requests need review">
                {requestsNeedingReview} device onboarding{' '}
                {requestsNeedingReview === 1 ? 'request needs' : 'requests need'} review.{' '}
                <Button
                  variant="link"
                  isInline
                  onClick={() => {
                    setSelectedRequestStatuses(['Needs review']);
                    setRequestPage(1);
                    goToList('requests');
                  }}
                >
                  Show requests needing review
                </Button>
              </Alert>
            </StackItem>
          )}
          <StackItem>
            <Content component="p" className="enrollment-auto-approval__intro">
              A device is approved automatically when its certificate is valid, exactly one approval policy matches, and
              all checks pass. Otherwise, its onboarding request needs review.
            </Content>
          </StackItem>
          <StackItem>
            <Tabs
              activeKey={activeTab}
              onSelect={(_event, key) => {
                setActiveTab(key as EnrollmentTab);
                setView({ type: 'list' });
              }}
              aria-label="Onboarding sections"
            >
              {access.requests && (
                <Tab eventKey="requests" title={<TabTitleText>Onboarding requests</TabTitleText>}>
                  <div className="enrollment-auto-approval__tab-content">{requestsContent ?? renderRequestsTab()}</div>
                </Tab>
              )}
              {access.policies && (
                <Tab eventKey="policies" title={<TabTitleText>Approval policies</TabTitleText>}>
                  <div className="enrollment-auto-approval__tab-content">{renderPoliciesTab()}</div>
                </Tab>
              )}
              {access.certificates && (
                <Tab eventKey="certificates" title={<TabTitleText>Certificates</TabTitleText>}>
                  <div className="enrollment-auto-approval__tab-content">{renderCertificatesTab()}</div>
                </Tab>
              )}
            </Tabs>
          </StackItem>
        </>
      )}
    </Stack>
  );

  let content: React.ReactNode;
  if (view.type === 'request') content = renderRequestDetails();
  else if (view.type === 'policy-create') content = renderPolicyForm(false);
  else if (view.type === 'policy') content = renderPolicyDetails();
  else if (view.type === 'certificate-create') content = renderCertificateForm();
  else if (view.type === 'certificate-created') content = renderCertificateDetails(true);
  else if (view.type === 'certificate') content = renderCertificateDetails(false);
  else content = renderList();

  return (
    <>
      {embedded ? (
        <div className="enrollment-auto-approval">{content}</div>
      ) : (
        <PageSection hasBodyWrapper={false} className="enrollment-auto-approval">
          {content}
        </PageSection>
      )}
      {revokingCertificate && (
        <FlightCtlModal
          variant="small"
          isOpen
          onClose={() => {
            setRevokeCertificateId(undefined);
            setRevokeConfirmationName('');
          }}
          aria-label="Revoke enrollment certificate"
        >
          <ModalHeader title={`Revoke ${revokingCertificate.name}?`} titleIconVariant="warning" />
          <ModalBody>
            <Stack hasGutter>
              <StackItem>
                <Content>
                  New approvals using this certificate will stop. Pending requests using it will be rejected. Previously
                  automatically approved devices will be flagged for review and remain enrolled.
                </Content>
              </StackItem>
              <StackItem>
                <FormGroup
                  label={`Type ${revokingCertificate.name} to confirm`}
                  fieldId="revoke-certificate-confirmation"
                  isRequired
                >
                  <TextInput
                    id="revoke-certificate-confirmation"
                    value={revokeConfirmationName}
                    onChange={(_event, value) => setRevokeConfirmationName(value)}
                  />
                </FormGroup>
              </StackItem>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              isDisabled={revokeConfirmationName !== revokingCertificate.name}
              onClick={revokeCertificate}
            >
              Revoke certificate
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setRevokeCertificateId(undefined);
                setRevokeConfirmationName('');
              }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </FlightCtlModal>
      )}
    </>
  );
};

export default EnrollmentAutoApprovalPage;
