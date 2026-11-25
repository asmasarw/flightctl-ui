import * as React from 'react';
import {
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';

import { type EnrollmentRequest } from '@flightctl/types';
import { useTranslation } from '../../hooks/useTranslation';
import { EnrollmentRequestStatus } from '../../utils/status/enrollmentRequest';

import TableTextSearch, { type TableTextSearchProps } from '../Table/TableTextSearch';

type EnrollmentRequestTableToolbarProps = {
  enrollments: EnrollmentRequest[];
  search: TableTextSearchProps['value'];
  setSearch: TableTextSearchProps['setValue'];
  selectedStatuses: EnrollmentRequestStatus[];
  onToggleStatus: (status: EnrollmentRequestStatus) => void;
};

const EnrollmentRequestTableToolbar = ({
  search,
  setSearch,
  selectedStatuses,
  onToggleStatus,
  children,
}: React.PropsWithChildren<EnrollmentRequestTableToolbarProps>) => {
  const { t } = useTranslation();

  const statusFilters: { key: EnrollmentRequestStatus; label: string }[] = [
    { key: EnrollmentRequestStatus.Approved, label: t('Approved') },
    { key: EnrollmentRequestStatus.Pending, label: t('Needs review') },
    { key: EnrollmentRequestStatus.Denied, label: t('Rejected') },
  ];

  return (
    <Toolbar id="enrollment-requests-toolbar" inset={{ default: 'insetNone' }}>
      <ToolbarContent>
        <ToolbarGroup>
          <ToolbarItem>
            <TableTextSearch
              value={search}
              setValue={setSearch}
              placeholder={t('Search by name')}
              inputProps={{ 'data-testid': 'pending-enrollment-request-search-input' }}
            />
          </ToolbarItem>
          {children}
          <ToolbarItem>
            <ToggleGroup aria-label={t('Filter requests by status')}>
              {statusFilters.map(({ key, label }) => (
                <ToggleGroupItem
                  key={key}
                  text={label}
                  isSelected={selectedStatuses.includes(key)}
                  onChange={() => onToggleStatus(key)}
                />
              ))}
            </ToggleGroup>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};

export default EnrollmentRequestTableToolbar;
