import * as React from 'react';

import { useDebounce } from 'use-debounce';

import { type EnrollmentRequest, type EnrollmentRequestList } from '@flightctl/types';

import { useFetchPeriodically } from '../../hooks/useFetchPeriodically';
import { type PaginationDetails, useTablePagination } from '../../hooks/useTablePagination';
import { EnrollmentRequestStatus, getEnrollmentApprovalFieldSelector } from '../../utils/status/enrollmentRequest';

import { PAGE_SIZE } from '../../constants';

type EnrollmentRequestsEndpointArgs = {
  search?: string;
  approvalStatuses?: EnrollmentRequestStatus[];
  nextContinue?: string;
};

const getEnrollmentRequestsEndpoint = ({ search, approvalStatuses, nextContinue }: EnrollmentRequestsEndpointArgs) => {
  const fieldSelector: string[] = [];
  const approvalSelector = getEnrollmentApprovalFieldSelector(approvalStatuses || []);
  if (approvalSelector) {
    fieldSelector.push(approvalSelector);
  }
  if (search) {
    fieldSelector.push(`metadata.name contains ${search}`);
  }

  const params = new URLSearchParams();
  if (fieldSelector.length) {
    params.set('fieldSelector', fieldSelector.join(','));
  }

  if (nextContinue !== undefined) {
    params.set('limit', `${PAGE_SIZE}`);
  }
  if (nextContinue) {
    params.set('continue', nextContinue);
  }
  const query = params.toString();
  return query ? `enrollmentrequests?${query}` : 'enrollmentrequests';
};

export const useEnrollmentRequestsEndpoint = (args: EnrollmentRequestsEndpointArgs): [string, boolean] => {
  const endpoint = getEnrollmentRequestsEndpoint(args);
  const [erEndpointDebounced] = useDebounce(endpoint, 1000);
  return [erEndpointDebounced, endpoint !== erEndpointDebounced];
};

export const useEnrollmentRequests = (
  search?: string,
  approvalStatuses: EnrollmentRequestStatus[] = [EnrollmentRequestStatus.Pending],
): [
  EnrollmentRequest[],
  boolean,
  unknown,
  VoidFunction,
  pagination: Pick<PaginationDetails<EnrollmentRequestList>, 'currentPage' | 'setCurrentPage' | 'itemCount'>,
] => {
  const { currentPage, setCurrentPage, itemCount, nextContinue, onPageFetched } =
    useTablePagination<EnrollmentRequestList>();

  const approvalKey = approvalStatuses.slice().sort().join('|');
  const previousFilters = React.useRef({ search, approvalKey });
  React.useEffect(() => {
    if (previousFilters.current.search !== search || previousFilters.current.approvalKey !== approvalKey) {
      previousFilters.current = { search, approvalKey };
      setCurrentPage(1);
    }
  }, [search, approvalKey, setCurrentPage]);

  const [erEndpoint, isDebouncing] = useEnrollmentRequestsEndpoint({
    search,
    approvalStatuses,
    nextContinue,
  });

  const [erList, isLoading, error, refetch, updating] = useFetchPeriodically<EnrollmentRequestList>(
    {
      endpoint: erEndpoint,
    },
    onPageFetched,
  );

  const pagination = React.useMemo(
    () => ({
      currentPage,
      setCurrentPage,
      itemCount,
    }),
    [currentPage, setCurrentPage, itemCount],
  );

  return [erList?.items || [], isLoading || isDebouncing || updating, error, refetch, pagination];
};
