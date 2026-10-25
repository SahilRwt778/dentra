import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { layout } from '../../common/theme/theme';
import { useDentist } from '../auth/DentistGate';
import { dateKey } from '../../common/utils/date';
import { TodayHeader } from './TodayHeader';
import { TodayQueue } from './TodayQueue';

export function TodayScreen() {
  const dentist = useDentist();
  const [now, setNow] = useState(() => new Date());
  const today = dateKey(now);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={layout.fill}>
      <TodayHeader />
      <TodayQueue
        key={today}
        date={today}
        dentistName={dentist.fullName}
        hour={now.getHours()}
      />
    </SafeAreaView>
  );
}
