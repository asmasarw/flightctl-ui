import * as React from 'react';
import { Content, Stack, StackItem, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import { BlueprintIcon } from '@patternfly/react-icons/dist/js/icons/blueprint-icon';
import { CertificateIcon } from '@patternfly/react-icons/dist/js/icons/certificate-icon';

import { useAppContext } from '../../hooks/useAppContext';
import { useTranslation } from '../../hooks/useTranslation';
import ListPage from '../ListPage/ListPage';
import ResourceListEmptyState from '../common/ResourceListEmptyState';
import EnrollmentRequestList from './EnrollmentRequestList';
import OnboardingRequestReview from './OnboardingRequestReview';

export type DeviceOnboardingTabKey = 'requests' | 'policies' | 'certificates';

export const ONBOARDING_TAB_PARAM = 'onboardingTab';
export const ONBOARDING_REQUEST_PARAM = 'request';

export const parseOnboardingTab = (value: string | null): DeviceOnboardingTabKey => {
  if (value === 'policies' || value === 'certificates') {
    return value;
  }
  return 'requests';
};

/** Build search params that open Device onboarding → Onboarding requests (optionally a specific request). */
export const buildOnboardingRequestSearchParams = (current: URLSearchParams, requestId?: string): URLSearchParams => {
  const nextParams = new URLSearchParams(current);
  nextParams.set('tab', 'onboarding');
  nextParams.delete(ONBOARDING_TAB_PARAM);
  if (requestId) {
    nextParams.set(ONBOARDING_REQUEST_PARAM, requestId);
  } else {
    nextParams.delete(ONBOARDING_REQUEST_PARAM);
  }
  return nextParams;
};

type DeviceOnboardingPanelProps = {
  refetchDevices?: VoidFunction;
  isStandalone?: boolean;
};

const DeviceOnboardingPanel = ({ refetchDevices, isStandalone }: DeviceOnboardingPanelProps) => {
  const { t } = useTranslation();
  const {
    router: { useSearchParams },
  } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestId = searchParams.get(ONBOARDING_REQUEST_PARAM) || undefined;
  const activeTabKey: DeviceOnboardingTabKey = requestId
    ? 'requests'
    : parseOnboardingTab(searchParams.get(ONBOARDING_TAB_PARAM));

  const description = t(
    'A device is approved automatically when its certificate is valid, exactly one approval policy matches, and all checks pass. Otherwise, its onboarding request needs review.',
  );

  const setActiveTabKey = (tabKey: DeviceOnboardingTabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(ONBOARDING_REQUEST_PARAM);
    if (tabKey === 'requests') {
      nextParams.delete(ONBOARDING_TAB_PARAM);
    } else {
      nextParams.set(ONBOARDING_TAB_PARAM, tabKey);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const clearRequest = () => {
    setSearchParams(buildOnboardingRequestSearchParams(searchParams), { replace: true });
  };

  const onRequestResolved = () => {
    clearRequest();
    refetchDevices?.();
  };

  const nestedTabs = (
    <Tabs
      activeKey={activeTabKey}
      onSelect={(_event, tabIndex) => setActiveTabKey(tabIndex as DeviceOnboardingTabKey)}
      aria-label={t('Device onboarding tabs')}
    >
      <Tab eventKey="requests" title={<TabTitleText>{t('Onboarding requests')}</TabTitleText>}>
        {requestId ? (
          <OnboardingRequestReview
            enrollmentRequestId={requestId}
            onBack={clearRequest}
            onResolved={onRequestResolved}
          />
        ) : (
          <Stack hasGutter>
            <StackItem className="pf-v6-u-pt-lg">
              <Content component="p">{t('See why each request was approved, rejected, or needs review.')}</Content>
            </StackItem>
            <StackItem>
              <EnrollmentRequestList refetchDevices={refetchDevices} />
            </StackItem>
          </Stack>
        )}
      </Tab>
      <Tab eventKey="policies" title={<TabTitleText>{t('Approval policies')}</TabTitleText>}>
        <ResourceListEmptyState icon={BlueprintIcon} titleText={t('No approval policies')} />
      </Tab>
      <Tab eventKey="certificates" title={<TabTitleText>{t('Certificates')}</TabTitleText>}>
        <ResourceListEmptyState icon={CertificateIcon} titleText={t('No certificates')} />
      </Tab>
    </Tabs>
  );

  if (isStandalone) {
    return (
      <ListPage title={t('Device onboarding')} description={description} testId="pending-enrollment-requests-section">
        {nestedTabs}
      </ListPage>
    );
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <Content component="p" data-testid="device-onboarding-description">
          {description}
        </Content>
      </StackItem>
      <StackItem>{nestedTabs}</StackItem>
    </Stack>
  );
};

export default DeviceOnboardingPanel;
