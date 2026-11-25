import * as React from 'react';
import { Label } from '@patternfly/react-core';

import { type EnrollmentRequest } from '@flightctl/types';
import {
  EnrollmentRequestStatus as EnrollmentRequestStatusType,
  getApprovalStatus,
  getEnrollmentRequestsStatusItems,
} from '../../utils/status/enrollmentRequest';
import { useTranslation } from '../../hooks/useTranslation';

const statusLabelColor: Record<EnrollmentRequestStatusType, 'green' | 'orange' | 'purple' | 'grey'> = {
  [EnrollmentRequestStatusType.Approved]: 'green',
  [EnrollmentRequestStatusType.Pending]: 'orange',
  [EnrollmentRequestStatusType.Denied]: 'purple',
  [EnrollmentRequestStatusType.Unknown]: 'grey',
};

const EnrollmentRequestStatus = ({ er }: { er?: EnrollmentRequest }) => {
  const { t } = useTranslation();

  const status = er ? getApprovalStatus(er) : EnrollmentRequestStatusType.Unknown;
  const statusItems = getEnrollmentRequestsStatusItems(t);
  const item = statusItems.find((statusItem) => statusItem.id === status);

  return <Label color={statusLabelColor[status]}>{item?.label || t('Unknown')}</Label>;
};

export default EnrollmentRequestStatus;
