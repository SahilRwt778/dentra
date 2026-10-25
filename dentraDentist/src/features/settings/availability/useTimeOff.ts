import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useScreenActive } from '../../../common/hooks/useScreenActive';
import { errorMessage } from '../../../common/utils/api-error';
import type {
  TimeOff,
  TimeOffInput,
  TimeOffPreview,
} from '../../../common/types/availability';
import {
  useCreateTimeOffMutation,
  usePreviewTimeOffMutation,
  useRemoveTimeOffMutation,
} from '../../../store/dentraApi';
import { newTimeOff, timeOffInput, timeOffRequestId } from './time-off-form';

export function useTimeOff() {
  const [form, setForm] = useState(newTimeOff);
  const [preview, setPreview] = useState<TimeOffPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [check, checking] = usePreviewTimeOffMutation();
  const [create, creating] = useCreateTimeOffMutation();
  const [remove, removing] = useRemoveTimeOffMutation();
  const active = useScreenActive();
  const lock = useRef(false);
  const requestId = useRef(timeOffRequestId());
  const busy = checking.isLoading || creating.isLoading || removing.isLoading;
  usePreventRemove(busy, () => {});

  function change(changes: Partial<TimeOffInput>) {
    if (lock.current) return;
    setForm(current => ({ ...current, ...changes }));
    setPreview(null);
    setError(null);
    setNotice(null);
    requestId.current = timeOffRequestId();
  }
  async function reviewOrSave() {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    setNotice(null);
    try {
      const input = timeOffInput(form);
      if (!preview || preview.total) {
        const result = await check(input).unwrap();
        if (active.current) setPreview(result);
      } else {
        await create({ ...input, requestId: requestId.current }).unwrap();
        if (active.current) {
          setPreview(null);
          setForm(newTimeOff());
          requestId.current = timeOffRequestId();
          setNotice('Time off saved. These times are closed for new bookings.');
        }
      }
    } catch (failure) {
      if (active.current) {
        setError(errorMessage(failure));
        setPreview(null); // A booking may have arrived after the preview.
      }
    } finally {
      lock.current = false;
    }
  }
  function confirmRemove(period: TimeOff) {
    if (lock.current) return;
    Alert.alert(
      'Remove time off?',
      'Unbooked times in this period will be available again on your working days.',
      [
        { text: 'Keep time off', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (lock.current || !active.current) return;
            lock.current = true;
            setError(null);
            try {
              await remove(period.id).unwrap();
              if (active.current) {
                setNotice('Time off removed.');
                setPreview(null);
              }
            } catch (failure) {
              if (active.current) setError(errorMessage(failure));
            } finally {
              lock.current = false;
            }
          },
        },
      ],
    );
  }
  return {
    form,
    change,
    preview,
    busy,
    error,
    notice,
    reviewOrSave,
    confirmRemove,
  };
}
