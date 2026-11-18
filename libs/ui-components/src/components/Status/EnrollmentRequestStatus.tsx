import * as React from 'react';
import { Label } from '@patternfly/react-core';

import { type EnrollmentRequest } from '@flightctl/types';
import {
  EnrollmentRequestStatus as EnrollmentRequestStatusType,
  getApprovalStatus,
  getEnrollmentRequestsStatusItems,
} from '../../utils/status/enrollmentRequest';
import { useTranslation } from '../../hooks/useTranslation';

const statusLabelColor = (status: EnrollmentRequestStatusType): 'green' | 'orange' | 'red' | 'grey' => {
  switch (status) {
    case EnrollmentRequestStatusType.Approved:
      return 'green';
    case EnrollmentRequestStatusType.Denied:
      return 'red';
    case EnrollmentRequestStatusType.Pending:
      return 'orange';
    default:
      return 'grey';
  }
};

const EnrollmentRequestStatus = ({ er }: { er?: EnrollmentRequest }) => {
  const { t } = useTranslation();

  const status = er ? getApprovalStatus(er) : EnrollmentRequestStatusType.Unknown;
  const statusItems = getEnrollmentRequestsStatusItems(t);
  const item = statusItems.find((statusItem) => statusItem.id === status);

  return (
    <Label isCompact variant="filled" color={statusLabelColor(status)}>
      {item?.label || t('Unknown')}
    </Label>
  );
};

export default EnrollmentRequestStatus;
