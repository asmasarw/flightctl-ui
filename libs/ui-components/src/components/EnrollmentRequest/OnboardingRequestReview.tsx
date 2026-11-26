import * as React from 'react';
import {
  Alert,
  Button,
  CardBody,
  CardTitle,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  List,
  ListItem,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import { ArrowLeftIcon } from '@patternfly/react-icons/dist/js/icons/arrow-left-icon';
import { Trans } from 'react-i18next';

import { type EnrollmentRequest } from '@flightctl/types';

import { useDeviceSystemInfo } from '../../hooks/useDeviceSystemInfo';
import { useFetch } from '../../hooks/useFetch';
import { useFetchPeriodically } from '../../hooks/useFetchPeriodically';
import { useTranslation } from '../../hooks/useTranslation';
import { timeSinceText } from '../../utils/dates';
import { getErrorMessage } from '../../utils/error';
import {
  EnrollmentRequestStatus as EnrollmentRequestStatusType,
  getApprovalStatus,
  getEnrollmentDecisionText,
} from '../../utils/status/enrollmentRequest';
import { RESOURCE, VERB } from '../../types/rbac';
import { usePermissionsContext } from '../common/PermissionsContext';
import FlightCtlModal from '../common/FlightCtlModal';
import LabelsView from '../common/LabelsView';
import DetailsPageCard from '../DetailsPage/DetailsPageCard';
import SystemInfoDescriptionGroup from '../Device/DeviceDetails/SystemInfoDescriptionGroup';
import ApproveDeviceModal from '../modals/ApproveDeviceModal/ApproveDeviceModal';
import EnrollmentRequestStatus from '../Status/EnrollmentRequestStatus';
import EnrollmentRequestTpmStatus from '../Status/EnrollmentRequestTpmStatus';

type OnboardingRequestReviewProps = {
  enrollmentRequestId: string;
  onBack: VoidFunction;
  onResolved: VoidFunction;
};

const enrollmentRequestReviewPermissions = [{ kind: RESOURCE.ENROLLMENT_REQUEST_APPROVAL, verb: VERB.POST }];

const OnboardingRequestReview = ({ enrollmentRequestId, onBack, onResolved }: OnboardingRequestReviewProps) => {
  const { t } = useTranslation();
  const { put } = useFetch();
  const { checkPermissions } = usePermissionsContext();
  const [canApprove] = checkPermissions(enrollmentRequestReviewPermissions);

  const [er, loading, error] = useFetchPeriodically<EnrollmentRequest>({
    endpoint: `enrollmentrequests/${enrollmentRequestId}`,
  });

  const [isApprovalModalOpen, setIsApprovalModalOpen] = React.useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [rejectError, setRejectError] = React.useState<string>();

  const deviceStatus = er?.spec.deviceStatus;
  const { systemInfo: systemInfoResult, customInfo: customInfoResult } = useDeviceSystemInfo(
    t,
    deviceStatus?.systemInfo,
    deviceStatus?.systemInfoStatus?.statuses,
  );

  const approvalStatus = er ? getApprovalStatus(er) : EnrollmentRequestStatusType.Unknown;
  const isPending = approvalStatus === EnrollmentRequestStatusType.Pending;
  const decisionText = er ? getEnrollmentDecisionText(er) : '';
  const alias = er?.spec.labels?.alias;
  const deviceId = er?.metadata.name || enrollmentRequestId;
  const labels = er?.spec.labels;
  const hasLabels = Object.keys(labels || {}).length > 0;

  const decisionHistory = React.useMemo(() => {
    if (!er) {
      return [];
    }
    const entries: string[] = [];
    if (er.metadata.creationTimestamp) {
      entries.push(t('Request created · {{time}}', { time: timeSinceText(t, er.metadata.creationTimestamp) }));
    }
    const approval = er.status?.approval;
    if (approval) {
      const decisionLabel = approval.approved ? t('Approved') : t('Rejected');
      const time = approval.approvedAt ? timeSinceText(t, approval.approvedAt) : '';
      if (approval.approvedBy && time) {
        entries.push(
          t('{{decision}} by {{approver}} · {{time}}', {
            decision: decisionLabel,
            approver: approval.approvedBy,
            time,
          }),
        );
      } else if (time) {
        entries.push(t('{{decision}} · {{time}}', { decision: decisionLabel, time }));
      } else {
        entries.push(decisionLabel);
      }
    }
    return entries;
  }, [er, t]);

  const rejectRequest = async () => {
    setRejectError(undefined);
    setIsRejecting(true);
    try {
      await put(`enrollmentrequests/${enrollmentRequestId}/approval`, { approved: false });
      setIsRejectModalOpen(false);
      onResolved();
    } catch (err) {
      setRejectError(getErrorMessage(err));
    } finally {
      setIsRejecting(false);
    }
  };

  if (loading && !er) {
    return (
      <Flex justifyContent={{ default: 'justifyContentCenter' }} className="pf-v6-u-p-xl">
        <Spinner />
      </Flex>
    );
  }

  if (error || !er) {
    return (
      <Stack hasGutter className="pf-v6-u-pt-lg">
        <StackItem>
          <Button variant="link" isInline icon={<ArrowLeftIcon />} onClick={onBack}>
            {t('Back to onboarding requests')}
          </Button>
        </StackItem>
        <StackItem>
          <Alert isInline variant="danger" title={t('Failed to load enrollment request')} />
        </StackItem>
      </Stack>
    );
  }

  return (
    <Stack hasGutter className="pf-v6-u-pt-lg">
      <StackItem>
        <Button variant="link" isInline icon={<ArrowLeftIcon />} onClick={onBack}>
          {t('Back to onboarding requests')}
        </Button>
      </StackItem>

      <StackItem>
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
          flexWrap={{ default: 'wrap' }}
          gap={{ default: 'gapMd' }}
        >
          <FlexItem>
            <Stack>
              <StackItem>
                <Title headingLevel="h2" size="xl">
                  {deviceId}
                </Title>
              </StackItem>
              {alias && (
                <StackItem>
                  <Content component="p">{alias}</Content>
                </StackItem>
              )}
            </Stack>
          </FlexItem>
          {canApprove && isPending && (
            <FlexItem>
              <Flex gap={{ default: 'gapSm' }}>
                <Button variant="primary" onClick={() => setIsApprovalModalOpen(true)}>
                  {t('Approve')}
                </Button>
                <Button variant="danger" onClick={() => setIsRejectModalOpen(true)}>
                  {t('Reject')}
                </Button>
              </Flex>
            </FlexItem>
          )}
        </Flex>
      </StackItem>

      {decisionText && (
        <StackItem>
          <Alert isInline variant="warning" title={decisionText} />
        </StackItem>
      )}

      <StackItem>
        <Grid hasGutter>
          <GridItem md={6}>
            <Stack hasGutter>
              <StackItem>
                <DetailsPageCard>
                  <CardTitle>{t('Request details')}</CardTitle>
                  <CardBody>
                    <DescriptionList columnModifier={{ default: '2Col' }}>
                      <DescriptionListGroup>
                        <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                        <DescriptionListDescription>
                          <EnrollmentRequestStatus er={er} />
                        </DescriptionListDescription>
                      </DescriptionListGroup>
                      <DescriptionListGroup>
                        <DescriptionListTerm>{t('Certificate')}</DescriptionListTerm>
                        <DescriptionListDescription>{''}</DescriptionListDescription>
                      </DescriptionListGroup>
                      <DescriptionListGroup>
                        <DescriptionListTerm>{t('Matching policies')}</DescriptionListTerm>
                        <DescriptionListDescription>{''}</DescriptionListDescription>
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
                    </DescriptionList>
                  </CardBody>
                </DetailsPageCard>
              </StackItem>
              <StackItem>
                <DetailsPageCard>
                  <CardTitle>{t('Device information')}</CardTitle>
                  <CardBody>
                    <Stack hasGutter>
                      <StackItem>
                        <Content component="p">{t('Reported when this request was submitted.')}</Content>
                      </StackItem>
                      {systemInfoResult.mainEntries.length > 0 && (
                        <StackItem>
                          <DescriptionList columnModifier={{ default: '2Col' }}>
                            {systemInfoResult.mainEntries.map((entry) => (
                              <SystemInfoDescriptionGroup key={entry.key} entry={entry} />
                            ))}
                          </DescriptionList>
                        </StackItem>
                      )}
                    </Stack>
                  </CardBody>
                </DetailsPageCard>
              </StackItem>
              {customInfoResult.entries.length > 0 && (
                <StackItem>
                  <DetailsPageCard>
                    <CardTitle>{t('Custom data')}</CardTitle>
                    <CardBody>
                      <DescriptionList columnModifier={{ default: '2Col' }}>
                        {customInfoResult.entries.map((entry) => (
                          <SystemInfoDescriptionGroup key={entry.key} entry={entry} />
                        ))}
                      </DescriptionList>
                    </CardBody>
                  </DetailsPageCard>
                </StackItem>
              )}
            </Stack>
          </GridItem>

          <GridItem md={6}>
            <Stack hasGutter>
              <StackItem>
                <DetailsPageCard>
                  <CardTitle>{t('Requested labels')}</CardTitle>
                  <CardBody>
                    <Stack hasGutter>
                      <StackItem>
                        {hasLabels ? (
                          <LabelsView prefix="onboarding-review" labels={labels} />
                        ) : (
                          <Content component="p">{t('No labels')}</Content>
                        )}
                      </StackItem>
                      {isPending && (
                        <StackItem>
                          <Content component="small">
                            {t('You can edit labels in the approval dialog before approving this request.')}
                          </Content>
                        </StackItem>
                      )}
                    </Stack>
                  </CardBody>
                </DetailsPageCard>
              </StackItem>
              <StackItem>
                <DetailsPageCard>
                  <CardTitle>{t('Decision history')}</CardTitle>
                  <CardBody>
                    {decisionHistory.length > 0 ? (
                      <List isPlain>
                        {decisionHistory.map((entry) => (
                          <ListItem key={entry}>{entry}</ListItem>
                        ))}
                      </List>
                    ) : (
                      <Content component="p">{t('No decision history')}</Content>
                    )}
                  </CardBody>
                </DetailsPageCard>
              </StackItem>
            </Stack>
          </GridItem>
        </Grid>
      </StackItem>

      {isApprovalModalOpen && (
        <ApproveDeviceModal
          enrollmentRequest={er}
          onClose={(isApproved) => {
            setIsApprovalModalOpen(false);
            if (isApproved) {
              onResolved();
            }
          }}
        />
      )}

      {isRejectModalOpen && (
        <FlightCtlModal isOpen onClose={() => setIsRejectModalOpen(false)} variant="small">
          <ModalHeader title={t('Reject enrollment request?')} titleIconVariant="warning" />
          <ModalBody>
            <Stack hasGutter>
              <StackItem>
                <Trans t={t} values={{ deviceId }}>
                  Are you sure you want to reject enrollment request <b>{'{{deviceId}}'}</b>?
                </Trans>
              </StackItem>
              {rejectError && (
                <StackItem>
                  <Alert isInline variant="danger" title={t('An error occurred')}>
                    {rejectError}
                  </Alert>
                </StackItem>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              isLoading={isRejecting}
              isDisabled={isRejecting}
              onClick={() => {
                void rejectRequest();
              }}
            >
              {t('Reject')}
            </Button>
            <Button variant="link" onClick={() => setIsRejectModalOpen(false)} isDisabled={isRejecting}>
              {t('Cancel')}
            </Button>
          </ModalFooter>
        </FlightCtlModal>
      )}
    </Stack>
  );
};

export default OnboardingRequestReview;
