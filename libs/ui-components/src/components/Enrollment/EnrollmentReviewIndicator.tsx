import * as React from 'react';
import { Icon, Tooltip } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/js/icons/exclamation-triangle-icon';

import { useTranslation } from '../../hooks/useTranslation';

const EnrollmentReviewIndicator = () => {
  const { t } = useTranslation();

  return (
    <Tooltip content={t('The enrollment certificate used to approve this device was revoked.')}>
      <span tabIndex={0} className="pf-v6-u-text-nowrap">
        <Icon status="warning" isInline>
          <ExclamationTriangleIcon aria-hidden="true" />
        </Icon>{' '}
        {t('Enrollment review needed')}
      </span>
    </Tooltip>
  );
};

export default EnrollmentReviewIndicator;
