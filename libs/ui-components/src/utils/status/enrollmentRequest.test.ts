import { describe, expect, it } from 'vitest';
import { type Condition, ConditionStatus, ConditionType, type EnrollmentRequest } from '@flightctl/types';

import {
  EnrollmentRequestStatus,
  EnrollmentRequestTpmVerificationStatus,
  getEnrollmentApprovalFieldSelector,
  getEnrollmentDecisionText,
  getEnrollmentRequestsStatusItems,
  getTpmVerificationStatus,
} from './enrollmentRequest';

const buildTpmCondition = (status: ConditionStatus, reason: string, message = 'TPM condition message'): Condition => ({
  type: ConditionType.EnrollmentRequestTPMVerified,
  status,
  reason,
  message,
  lastTransitionTime: '2026-10-21T00:00:00Z',
});

const t = ((key: string) => key) as Parameters<typeof getEnrollmentRequestsStatusItems>[0];

describe('getEnrollmentRequestTpmVerificationStatus', () => {
  it.each([
    {
      name: 'When there is no TPMVerified condition it should return NotAvailable',
      condition: undefined,
      expected: EnrollmentRequestTpmVerificationStatus.NotAvailable,
    },
    {
      name: 'When TPMVerified is True it should return Verified',
      condition: buildTpmCondition(ConditionStatus.ConditionStatusTrue, 'TPMChallengeSucceeded'),
      expected: EnrollmentRequestTpmVerificationStatus.Verified,
    },
    {
      name: 'When TPMChallengeRequired it should return Pending',
      condition: buildTpmCondition(ConditionStatus.ConditionStatusFalse, 'TPMChallengeRequired'),
      expected: EnrollmentRequestTpmVerificationStatus.Pending,
    },
    {
      name: 'When TPMVerificationFailed it should return Failed',
      condition: buildTpmCondition(ConditionStatus.ConditionStatusFalse, 'TPMVerificationFailed'),
      expected: EnrollmentRequestTpmVerificationStatus.Failed,
    },
    {
      name: 'When TPMChallengeFailed it should return Failed',
      condition: buildTpmCondition(ConditionStatus.ConditionStatusFalse, 'TPMChallengeFailed'),
      expected: EnrollmentRequestTpmVerificationStatus.Failed,
    },
  ])('$name', ({ condition, expected }) => {
    expect(getTpmVerificationStatus(condition)).toBe(expected);
  });
});

describe('getEnrollmentRequestsStatusItems', () => {
  it('uses Needs review and Rejected labels', () => {
    const items = getEnrollmentRequestsStatusItems(t);
    expect(items.find((item) => item.id === EnrollmentRequestStatus.Pending)?.label).toBe('Needs review');
    expect(items.find((item) => item.id === EnrollmentRequestStatus.Denied)?.label).toBe('Rejected');
  });
});

describe('getEnrollmentApprovalFieldSelector', () => {
  it.each([
    {
      name: 'pending only',
      statuses: [EnrollmentRequestStatus.Pending],
      expected: '!status.approval.approved',
    },
    {
      name: 'approved only',
      statuses: [EnrollmentRequestStatus.Approved],
      expected: 'status.approval.approved=true',
    },
    {
      name: 'rejected only',
      statuses: [EnrollmentRequestStatus.Denied],
      expected: 'status.approval.approved=false',
    },
    {
      name: 'all three',
      statuses: [EnrollmentRequestStatus.Pending, EnrollmentRequestStatus.Approved, EnrollmentRequestStatus.Denied],
      expected: undefined,
    },
    {
      name: 'none',
      statuses: [],
      expected: undefined,
    },
    {
      name: 'approved and rejected',
      statuses: [EnrollmentRequestStatus.Approved, EnrollmentRequestStatus.Denied],
      expected: 'status.approval.approved in (true,false)',
    },
  ])('$name', ({ statuses, expected }) => {
    expect(getEnrollmentApprovalFieldSelector(statuses)).toBe(expected);
  });
});

describe('getEnrollmentDecisionText', () => {
  it('returns message when present', () => {
    const er = {
      status: {
        conditions: [
          {
            type: ConditionType.EnrollmentRequestApproved,
            status: ConditionStatus.ConditionStatusFalse,
            reason: 'NoMatchingPolicy',
            message: 'No matching policy',
            lastTransitionTime: '2026-10-21T00:00:00Z',
          },
        ],
      },
    } as EnrollmentRequest;
    expect(getEnrollmentDecisionText(er)).toBe('No matching policy');
  });

  it('returns empty string when Approved condition is absent', () => {
    const er = { status: { conditions: [] } } as unknown as EnrollmentRequest;
    expect(getEnrollmentDecisionText(er)).toBe('');
  });
});
