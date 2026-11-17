import * as React from 'react';
import { Checkbox, Flex, FlexItem, FormGroup, Stack, StackItem, type Weekday } from '@patternfly/react-core';
import { FieldArray, useField, useFormikContext } from 'formik';

import { useTranslation } from '../../../../hooks/useTranslation';
import useTimeZones from '../../../../hooks/useTimeZones';
import * as timeUtils from '../../../../utils/time';
import { type FleetFormValues, type UpdatePolicyForm } from '../../../../types/deviceSpec';
import { FormGroupWithHelperText } from '../../../common/WithHelperText';
import CheckboxField, { CheckboxFieldGroupValidation } from '../../../form/CheckboxField';
import FormSelectTypeahead from '../../../form/FormSelectTypeahead';
import RadioField from '../../../form/RadioField';
import ErrorHelperText from '../../../form/FieldHelperText';
import TextField from '../../../form/TextField';

import './UpdateStepUpdatePolicy.css';

export enum ScheduleBlockType {
  Download = 'download',
  Install = 'install',
}

type ScheduleBlockProps = {
  updatePolicy: UpdatePolicyForm;
  blockType: ScheduleBlockType;
  weekDayError?: string[] | string | Weekday;
  onScheduleModeSwitch: (blockType: ScheduleBlockType) => void;
  isReadOnly?: boolean;
};

const ScheduleTimeZone = ({ blockType, isReadOnly }: { blockType: ScheduleBlockType; isReadOnly?: boolean }) => {
  const { t } = useTranslation();

  const id = `updatePolicy.${blockType}TimeZone`;

  const [{ value: timeZone, ...rest }, , { setValue }] = useField<string>({
    name: id,
  });

  const zones = useTimeZones();

  const onChangeTimezoneCheckbox = (_, isChecked: boolean) => {
    setValue(isChecked ? timeUtils.localDeviceTimezone : '');
  };

  return (
    <FormGroup id={`form-control__${id}`} fieldId={id} isStack className="fctl-policy-timezone">
      <Checkbox
        {...rest}
        isChecked={timeZone === timeUtils.localDeviceTimezone}
        id={id}
        onChange={onChangeTimezoneCheckbox}
        label={t("Use device's local timezone")}
        isDisabled={isReadOnly}
      />

      {timeZone !== timeUtils.localDeviceTimezone && (
        <FormSelectTypeahead name={id} defaultId="" items={zones} isDisabled={isReadOnly} />
      )}
    </FormGroup>
  );
};

const ScheduleBlock = ({
  blockType,
  updatePolicy,
  onScheduleModeSwitch,
  weekDayError,
  isReadOnly,
}: ScheduleBlockProps) => {
  const { t } = useTranslation();
  const { setFieldValue } = useFormikContext<FleetFormValues>();

  let ariaLabel: string;
  let helperContent: string;

  switch (blockType) {
    case ScheduleBlockType.Download:
      {
        if (updatePolicy.downloadAndInstallDiffer) {
          ariaLabel = t('Downloading schedule');
          helperContent = t('Time frame during which devices can start downloading their new configurations.');
        } else {
          ariaLabel = t('Downloading and installing schedule');
          helperContent = t(
            'Time frame during which devices can start downloading and installing their new configurations.',
          );
        }
      }

      break;
    case ScheduleBlockType.Install:
      ariaLabel = t('Installing schedule');
      helperContent = t('Time frame during which devices can start installing their new configurations.');
      break;
  }

  const selectableTimes = React.useMemo(() => timeUtils.getSelectableTimes(), []);

  const isValidTypedItem = React.useCallback((value: string) => timeUtils.valid24HourClockRegExp.test(value), []);

  const transformTypedItem = React.useCallback((time: string) => {
    if (timeUtils.formatted24HourClockRegExp.test(time)) {
      return time;
    }

    // We "fix" the value when it misses the optional leading 0, or the semicolon
    // The value is known to be valid at this point, so there should always be a match.
    const match = time.match(/^(\d{1,2})?:?(\d{2})?$/);
    return match ? `${timeUtils.formatTimePart(match[1])}:${match[2]}` : timeUtils.defaultStartTime;
  }, []);

  const isDownload = blockType === ScheduleBlockType.Download;
  const scheduleMode = isDownload ? updatePolicy.downloadScheduleMode : updatePolicy.installScheduleMode;
  const isWeekly = scheduleMode === timeUtils.UpdateScheduleMode.Weekly;

  const isAdvanced = isDownload ? updatePolicy.downloadIsAdvanced : updatePolicy.installIsAdvanced;
  const cron = isDownload ? updatePolicy.downloadCron : updatePolicy.installCron;
  const startsAt = isDownload ? updatePolicy.downloadStartsAt : updatePolicy.installStartsAt;
  const weekDays = isDownload ? updatePolicy.downloadWeekDays : updatePolicy.installWeekDays;
  const startGraceDuration = isDownload
    ? updatePolicy.downloadStartGraceDuration
    : updatePolicy.installStartGraceDuration;

  // When the current cron can't be represented in the structured editor, we lock the toggle "on".
  const isToggleLocked = isAdvanced && !timeUtils.isUpdateCronRepresentable(cron);

  const onToggleAdvanced = (checked: boolean) => {
    if (checked) {
      // Structured → advanced: always allowed. Seed the cron field from the current structured values.
      setFieldValue(
        `updatePolicy.${blockType}Cron`,
        timeUtils.structuredToCron(startsAt || timeUtils.defaultStartTime, scheduleMode, weekDays),
      );
      setFieldValue(`updatePolicy.${blockType}IsAdvanced`, true);
    } else {
      // Advanced → structured: only allowed when the current cron is representable.
      if (!timeUtils.isUpdateCronRepresentable(cron)) {
        return;
      }
      const structured = timeUtils.cronToStructuredSchedule(cron, startGraceDuration);
      setFieldValue(`updatePolicy.${blockType}StartsAt`, structured.startsAt);
      setFieldValue(`updatePolicy.${blockType}EndsAt`, structured.endsAt);
      setFieldValue(`updatePolicy.${blockType}WeekDays`, structured.weekDays);
      setFieldValue(`updatePolicy.${blockType}ScheduleMode`, structured.scheduleMode);
      setFieldValue(`updatePolicy.${blockType}IsAdvanced`, false);
    }
  };

  return (
    <Stack hasGutter>
      <StackItem>
        <Checkbox
          id={`updatePolicy.${blockType}IsAdvanced`}
          label={t('Edit as cron expression')}
          isChecked={isAdvanced}
          isDisabled={isReadOnly || isToggleLocked}
          onChange={(_, checked) => onToggleAdvanced(checked)}
          description={
            isToggleLocked
              ? t("This schedule uses an advanced cron expression that can't be shown in the simple editor.")
              : undefined
          }
        />
      </StackItem>
      <StackItem>
        <FormGroupWithHelperText isRequired label={ariaLabel} content={helperContent}>
          {isAdvanced ? (
            <TextField
              name={`updatePolicy.${blockType}Cron`}
              aria-label={t('Cron expression')}
              placeholder="0 2 * * 1-5"
              helperText={t('Enter a 5-field cron expression: minute hour day-of-month month day-of-week.')}
              isRequired
              isDisabled={isReadOnly}
            />
          ) : (
            <>
              <Flex>
                <FlexItem>
                  <FormSelectTypeahead
                    name={`updatePolicy.${blockType}StartsAt`}
                    placeholderText={t('Enter time (hh:mm)', { nsSeparator: '|' })}
                    defaultId={timeUtils.defaultStartTime}
                    items={selectableTimes}
                    isValidTypedItem={isValidTypedItem}
                    transformTypedItem={transformTypedItem}
                    isDisabled={isReadOnly}
                  />
                </FlexItem>
                <FlexItem>
                  <FormSelectTypeahead
                    name={`updatePolicy.${blockType}EndsAt`}
                    placeholderText={t('Enter time (hh:mm)', { nsSeparator: '|' })}
                    defaultId={timeUtils.defaultEndTime}
                    items={selectableTimes}
                    isValidTypedItem={isValidTypedItem}
                    transformTypedItem={transformTypedItem}
                    isDisabled={isReadOnly}
                  />
                </FlexItem>
                <FlexItem>
                  <RadioField
                    id={`daily-${blockType}`}
                    name={`updatePolicy.${blockType}ScheduleMode`}
                    label={t('Daily')}
                    checkedValue={timeUtils.UpdateScheduleMode.Daily}
                    isDisabled={isReadOnly}
                  />
                </FlexItem>
                <FlexItem>
                  <RadioField
                    id={`weekly-${blockType}`}
                    name={`updatePolicy.${blockType}ScheduleMode`}
                    label={t('Weekly')}
                    checkedValue={timeUtils.UpdateScheduleMode.Weekly}
                    onChangeCustom={() => onScheduleModeSwitch(blockType)}
                    isDisabled={isReadOnly}
                  />
                </FlexItem>
              </Flex>

              {isWeekly && (
                <FieldArray name={`updatePolicy.${blockType}WeekDays`}>
                  {() => (
                    <>
                      <Flex>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[0]`}
                            label={t('Sun')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[1]`}
                            label={t('Mon')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[2]`}
                            label={t('Tue')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[3]`}
                            label={t('Wed')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[4]`}
                            label={t('Thu')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[5]`}
                            label={t('Fri')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                        <FlexItem>
                          <CheckboxFieldGroupValidation
                            name={`updatePolicy.${blockType}WeekDays[6]`}
                            label={t('Sat')}
                            isDisabled={isReadOnly}
                          />
                        </FlexItem>
                      </Flex>
                      <ErrorHelperText error={weekDayError} />
                    </>
                  )}
                </FieldArray>
              )}
            </>
          )}
        </FormGroupWithHelperText>
      </StackItem>
      <StackItem>
        <ScheduleTimeZone blockType={blockType} isReadOnly={isReadOnly} />
      </StackItem>
      <StackItem>
        <FormGroup isRequired label={t('Start grace duration')}>
          <TextField
            name={`updatePolicy.${blockType}StartGraceDuration`}
            label={t('Start grace duration')}
            helperText={t('Devices can start the update within this time window after the scheduled trigger.')}
            isRequired
            isDisabled={isReadOnly}
            placeholder={t('e.g. 30m')}
          />
        </FormGroup>
      </StackItem>
    </Stack>
  );
};

const UpdateStepUpdatePolicy = ({ isReadOnly }: { isReadOnly?: boolean }) => {
  const { t } = useTranslation();

  const {
    values: { updatePolicy },
    errors,
    setFieldValue,
  } = useFormikContext<FleetFormValues>();

  // When switching to "daily" mode, we keep the selected weekdays, as they will be ignored.
  // By doing this, if users switch to "weekly" again, we can show the weekdays they selected previously instead of all/none
  const onSwitchToWeeklyMode = (blockType: ScheduleBlockType) => {
    const selectedDays =
      blockType === ScheduleBlockType.Download ? updatePolicy.downloadWeekDays : updatePolicy.installWeekDays;

    const isAllWeekSelected = selectedDays.every(Boolean);
    if (isAllWeekSelected) {
      setFieldValue(`updatePolicy.${blockType}WeekDays`, [false, false, false, false, false, false, false]);
    }
  };

  return (
    <Stack hasGutter>
      <StackItem>
        <CheckboxField
          label={t('Use different update schedules for downloading and installing updates')}
          name="updatePolicy.downloadAndInstallDiffer"
          isDisabled={isReadOnly}
        />
      </StackItem>

      <StackItem>
        <ScheduleBlock
          blockType={ScheduleBlockType.Download}
          updatePolicy={updatePolicy}
          weekDayError={errors.updatePolicy?.downloadWeekDays}
          onScheduleModeSwitch={onSwitchToWeeklyMode}
          isReadOnly={isReadOnly}
        />
      </StackItem>

      {updatePolicy.downloadAndInstallDiffer && (
        <StackItem>
          <ScheduleBlock
            blockType={ScheduleBlockType.Install}
            updatePolicy={updatePolicy}
            weekDayError={errors.updatePolicy?.installWeekDays}
            onScheduleModeSwitch={onSwitchToWeeklyMode}
            isReadOnly={isReadOnly}
          />
        </StackItem>
      )}
    </Stack>
  );
};

export default UpdateStepUpdatePolicy;
