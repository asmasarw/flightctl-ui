import * as React from 'react';
import { ActionsColumn, type IAction, type OnSelect, Td, Tr } from '@patternfly/react-table';
import { Button } from '@patternfly/react-core';

import { type EnrollmentRequest } from '@flightctl/types';
import { timeSinceText } from '../../utils/dates';
import { type ListAction } from '../ListPage/types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppContext } from '../../hooks/useAppContext';
import ResourceLink from '../common/ResourceLink';
import { buildAllDropdownActions } from '../common/ActionsDropdownList';
import EnrollmentRequestStatus from '../Status/EnrollmentRequestStatus';
import {
  EnrollmentRequestStatus as EnrollmentRequestStatusType,
  getApprovalStatus,
  getEnrollmentDecisionText,
} from '../../utils/status/enrollmentRequest';
import { buildOnboardingRequestSearchParams } from './DeviceOnboardingPanel';

type EnrollmentRequestTableRow = {
  rowIndex: number;
  onRowSelect: (er: EnrollmentRequest) => OnSelect;
  isRowSelected: (er: EnrollmentRequest) => boolean;
  er: EnrollmentRequest;
  onApprove: (id: string) => void;
  deleteAction: ListAction;
  canApprove: boolean;
  canDelete: boolean;
};

const EnrollmentRequestTableRow: React.FC<EnrollmentRequestTableRow> = ({
  er,
  deleteAction,
  rowIndex,
  onRowSelect,
  isRowSelected,
  onApprove,
  canApprove,
  canDelete,
}) => {
  const { t } = useTranslation();
  const {
    router: { useSearchParams },
  } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const erName = er.metadata.name as string;
  const erAlias = er.spec.labels?.alias;
  const isPending = getApprovalStatus(er) === EnrollmentRequestStatusType.Pending;
  const decisionText = getEnrollmentDecisionText(er);
  const showApprove = canApprove && isPending;

  const openRequestReview = () => {
    setSearchParams(buildOnboardingRequestSearchParams(searchParams, erName), { replace: true });
  };

  const approveEnrollment = () => {
    onApprove(erName);
  };

  const regularActions: IAction[] = [];
  if (showApprove) {
    regularActions.push({
      title: t('Approve'),
      onClick: approveEnrollment,
    });
  }
  const dangerActions: IAction[] = canDelete ? [deleteAction({ resourceId: erName })] : [];
  const actionItems = buildAllDropdownActions(regularActions, dangerActions);

  return (
    <Tr data-testid={`enrollment-request-${rowIndex}`}>
      <Td
        select={{
          rowIndex,
          onSelect: onRowSelect(er),
          isSelected: isRowSelected(er),
        }}
      />
      <Td dataLabel={t('Alias')}>
        <Button variant="link" isInline onClick={openRequestReview}>
          {erAlias || t('Untitled')}
        </Button>
      </Td>
      <Td dataLabel={t('Name')}>
        <ResourceLink id={erName} />
      </Td>
      <Td dataLabel={t('Request status')}>
        <EnrollmentRequestStatus er={er} />
      </Td>
      <Td dataLabel={t('Decision')}>{decisionText}</Td>
      <Td dataLabel={t('Submitted')}>{timeSinceText(t, er.metadata.creationTimestamp)}</Td>
      <Td dataLabel={t('Review request')}>
        {isPending ? (
          <Button
            variant="link"
            isInline
            onClick={openRequestReview}
            data-testid={`enrollment-request-review-button-${rowIndex}`}
          >
            {t('Review request')}
          </Button>
        ) : null}
      </Td>
      {!!actionItems.length && (
        <Td isActionCell data-testid={`enrollment-request-row-actions-${rowIndex}`}>
          <ActionsColumn items={actionItems} />
        </Td>
      )}
    </Tr>
  );
};

export default EnrollmentRequestTableRow;
