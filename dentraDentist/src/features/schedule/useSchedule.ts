import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { addDays, dateKey } from '../../common/utils/date';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import {
  useGetScheduleWeekQuery,
  useGetTimeOffQuery,
} from '../../store/dentraApi';
import { useBookingUpdates } from '../notifications/NotificationsProvider';

export function useSchedule() {
  const [today, setToday] = useState(dateKey);
  const [selectedDate, setSelectedDate] = useState(today);
  const [offset, setOffset] = useState(0);
  const focused = useIsFocused();
  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(today, offset + index)),
    [today, offset],
  );
  const result = useGetScheduleWeekQuery(dates[0], { skip: !focused });
  const needsTimeOff = focused && dates[6] >= today;
  const timeOff = useGetTimeOffQuery(undefined, { skip: !needsTimeOff });
  useForegroundRefresh(result.refetch, focused);
  useForegroundRefresh(timeOff.refetch, needsTimeOff, 60000);
  useBookingUpdates(result.refetch, focused);

  useEffect(() => {
    const update = () => setToday(dateKey());
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  function changeWeek(direction: number) {
    const nextOffset = offset + direction * 7;
    setOffset(nextOffset);
    setSelectedDate(addDays(today, nextOffset));
  }
  function resetToday() {
    setOffset(0);
    setSelectedDate(today);
  }
  function refresh() {
    result.refetch();
    if (needsTimeOff) timeOff.refetch();
  }
  return {
    today,
    selectedDate,
    selectDate: setSelectedDate,
    dates,
    offset,
    changeWeek,
    resetToday,
    result,
    timeOff,
    refresh,
  };
}
