import { useContext, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAppActive } from '@dentra/video/src/useAppActive';
import type { ConsultationCaseQuery } from '@dentra/call-core';
import {
  refreshExpiredConversations,
  useConsultationCasesQuery,
} from '@/api/consultation-cases';
import { PushContext } from '@/notifications/push-context';
import { useAppDispatch } from '@/store/hooks';

export function useConversationInbox({
  page = 1,
  filter = 'all',
}: ConsultationCaseQuery = {}) {
  const focused = useIsFocused();
  const active = useAppActive();
  const { state: pushState } = useContext(PushContext);
  const dispatch = useAppDispatch();
  const visible = focused && active;
  const query = useConsultationCasesQuery(
    { page, filter },
    {
      skip: !visible,
      pollingInterval: visible && pushState !== 'enabled' ? 10000 : 0,
      refetchOnMountOrArgChange: true,
    },
  );
  const { currentData, fulfilledTimeStamp } = query;

  useEffect(() => {
    if (!visible || !currentData || !fulfilledTimeStamp) return;
    // Expiry has no new message to trigger a push. Refresh once at the next
    // visible pass deadline, using server time rather than the phone's clock.
    const deadlines = currentData.items
      .filter(item => item.canMessage && item.expiresAt)
      .map(item => Date.parse(item.expiresAt!) - Date.parse(item.serverNow))
      .filter(Number.isFinite);
    if (!deadlines.length) return;
    const elapsed = Date.now() - fulfilledTimeStamp;
    const delay = Math.max(0, Math.min(...deadlines) - elapsed) + 250;
    const timer = setTimeout(() => {
      dispatch(
        refreshExpiredConversations({ page, filter }, fulfilledTimeStamp),
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [visible, currentData, fulfilledTimeStamp, page, filter, dispatch]);

  return query;
}
