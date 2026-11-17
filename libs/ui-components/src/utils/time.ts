import { type TFunction } from 'i18next';
import { type Duration, type UpdateSchedule } from '@flightctl/types';

export const formatTimePart = (val: number | string) => val.toString().padStart(2, '0');

export const getSelectableTimes = () => {
  const times = {};
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeString = `${formatTimePart(hour)}:${formatTimePart(minute)}`;
      times[timeString] = timeString;
    }
  }
  return times;
};

export const valid24HourClockRegExp = /^([01]?[0-9]|2[0-3]):?([0-5][0-9])$/;
export const formatted24HourClockRegExp = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
export const defaultStartTime = '00:00';
export const defaultEndTime = '23:59';
export const localDeviceTimezone = 'Local'; // matches the API's default value
const defaultUpdateDuration = '30m';

export enum UpdateScheduleMode {
  Weekly = 'weekly',
  Daily = 'daily',
}

export enum Weekday {
  Sunday = 0,
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
}

enum CronParts {
  Minutes = 0,
  Hours = 1,
  Days = 2,
  Months = 3,
  WeekDays = 4,
}

export const durationToMinutes = (duration: Duration) => {
  const timeoutVal = Number(duration.replace(/[shm]/, ''));
  if (!timeoutVal) {
    return 0;
  }

  if (duration.includes('s')) {
    return Math.round(timeoutVal / 60);
  }
  if (duration.includes('h')) {
    return Math.round(timeoutVal * 60);
  }
  return timeoutVal;
};

export const getEndTime = (startTime: string, duration?: Duration) => {
  if (startTime === defaultStartTime && !duration) {
    return defaultEndTime;
  }

  const [hours, minutes] = startTime.split(':').map(Number);
  const durationMinutes = durationToMinutes(duration || defaultUpdateDuration);

  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;

  return `${formatTimePart(newHours)}:${formatTimePart(newMinutes)}`;
};

// Returns true iff the cron expression can be represented by the structured schedule form.
// Accepts empty/undefined, or exactly 5 tokens where minutes is 0–59, hours is 0–23,
// day-of-month is *, month is *, and weekday is * or a comma-list of ints 0–6.
export const isUpdateCronRepresentable = (at?: string): boolean => {
  // Empty or undefined is representable
  if (!at) {
    return true;
  }

  const tokens = at.split(/\s+/).filter(Boolean);

  // Must have exactly 5 tokens
  if (tokens.length !== 5) {
    return false;
  }

  const minutes = tokens[CronParts.Minutes];
  const hours = tokens[CronParts.Hours];
  const days = tokens[CronParts.Days];
  const months = tokens[CronParts.Months];
  const weekDays = tokens[CronParts.WeekDays];

  // Day-of-month must be *
  if (days !== '*') {
    return false;
  }

  // Month must be *
  if (months !== '*') {
    return false;
  }

  // Minutes must be a single int 0–59
  const minuteNum = Number(minutes);
  if (!Number.isInteger(minuteNum) || minuteNum < 0 || minuteNum > 59) {
    return false;
  }

  // Hours must be a single int 0–23
  const hourNum = Number(hours);
  if (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23) {
    return false;
  }

  // Weekday must be * or a comma-list of ints 0–6
  if (weekDays === '*') {
    return true;
  }

  const dayParts = weekDays.split(',');
  for (const part of dayParts) {
    const trimmed = part.trim();
    // Each part must be a digit-only string
    if (!/^\d+$/.test(trimmed)) {
      return false;
    }
    const dayNum = Number(trimmed);
    if (dayNum < 0 || dayNum > 6) {
      return false;
    }
  }

  return true;
};

// Cron expression example: "0 4 * * 2,5"
export const getTime = (cronExp?: string) => {
  const tokens = (cronExp || '').split(' ').filter(Boolean);

  if (tokens.length !== 5) {
    return defaultStartTime;
  }
  const hours = tokens[CronParts.Hours];
  const minutes = tokens[CronParts.Minutes];

  // Ensure hours and minutes are valid numbers (eg. fails when specifying ranges or steps)
  if (Number.isNaN(Number(hours)) || Number.isNaN(Number(minutes))) {
    return defaultStartTime;
  }

  return `${formatTimePart(hours)}:${formatTimePart(minutes)}`;
};

export const getWeekDays = (cronExp?: string): { allSelected: boolean; selectedDays: boolean[] } => {
  const defaultDays = [true, true, true, true, true, true, true];

  let selectedDays = defaultDays;
  if (cronExp) {
    const weekDayExp = cronExp.split(' ')[CronParts.WeekDays];
    if (weekDayExp !== '*') {
      const days = weekDayExp.split(',').map(Number);
      selectedDays = defaultDays.map((_, index) => {
        return days.includes(index);
      });
    }
  }

  return {
    allSelected: selectedDays.every(Boolean),
    selectedDays,
  };
};

export const getUpdateCronExpression = (startTime: string, scheduleMode: UpdateScheduleMode, weekDays: boolean[]) => {
  const [hours, minutes] = startTime.split(':').map(Number);

  const weekDayVals = weekDays
    .map((isActive, index) => {
      return isActive || scheduleMode === UpdateScheduleMode.Daily ? index : null;
    })
    .filter((num) => num !== null);
  return `${minutes} ${hours} * * ${weekDayVals.join(',')}`;
};

export const schedulesAreEqual = (a: UpdateSchedule | undefined, b: UpdateSchedule | undefined) => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.at !== b.at) {
    return false;
  }
  if ((a.timeZone || localDeviceTimezone) !== (b.timeZone || localDeviceTimezone)) {
    return false;
  }
  return (a.startGraceDuration || '0s') === (b.startGraceDuration || '0s');
};

export type UpdateScheduleDisplayFields = {
  startsAt?: string;
  endsAt?: string;
  scheduleMode: UpdateScheduleMode;
  weekDays: boolean[];
  timeZone?: string;
  startGraceDuration?: string;
};

const getWeekDayShortLabels = (t: TFunction) => [t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')];

export const getScheduleUpdateText = (schedule: UpdateScheduleDisplayFields, t: TFunction): string => {
  const start = schedule.startsAt || defaultStartTime;
  const end = schedule.endsAt || defaultEndTime;
  const timeZone =
    !schedule.timeZone || schedule.timeZone === localDeviceTimezone ? t("device's local timezone") : schedule.timeZone;

  let scheduleText: string;
  if (schedule.scheduleMode === UpdateScheduleMode.Weekly) {
    const dayLabels = getWeekDayShortLabels(t);
    const days = schedule.weekDays
      .map((isSelected, index) => (isSelected ? dayLabels[index] : null))
      .filter(Boolean)
      .join(', ');
    scheduleText = t('Weekly on {{ days }} from {{ start }} to {{ end }} ({{ timeZone }})', {
      days: days || '-',
      start,
      end,
      timeZone,
    });
  } else {
    scheduleText = t('Daily from {{ start }} to {{ end }} ({{ timeZone }})', {
      start,
      end,
      timeZone,
    });
  }

  if (schedule.startGraceDuration && schedule.startGraceDuration !== '0s') {
    return t('{{ schedule }}, grace {{ duration }}', {
      schedule: scheduleText,
      duration: schedule.startGraceDuration,
    });
  }

  return scheduleText;
};

// Adds an artificial delay to make sure that the user notices the data is refreshing.
export const showSpinnerBriefly = (time: number = 450) => new Promise((resolve) => setTimeout(resolve, time));
