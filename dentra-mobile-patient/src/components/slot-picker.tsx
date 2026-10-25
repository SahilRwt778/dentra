import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useDentistSlotsQuery } from '@/api/dentists';
import { Button, Choice, ErrorState, Loading } from '@/components/ui';
import { addDays, dayLabel, formatTime } from '@/lib/patient';
import { ui } from '@/theme';

export function SlotPicker({
  dentistId,
  type,
  clinicId,
  date,
  time,
  onDate,
  onTime,
}: {
  dentistId: string;
  type: 'video' | 'clinic';
  clinicId?: string;
  date: string;
  time: string;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
}) {
  const { currentData, isFetching, error, refetch } = useDentistSlotsQuery(
    { dentistId, date, type, clinicId },
    { pollingInterval: 30000, refetchOnMountOrArgChange: true },
  );
  useEffect(() => {
    if (currentData && time && !currentData.slots?.includes(time)) onTime('');
  }, [currentData, time, onTime]);
  return (
    <View style={ui.stack}>
      <Text style={ui.label}>Choose a day</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ui.row}
      >
        {Array.from({ length: 14 }, (_, n) => addDays(n)).map(day => (
          <Choice
            compact
            key={day}
            title={dayLabel(day)}
            selected={date === day}
            onPress={() => {
              onTime('');
              onDate(day);
            }}
          />
        ))}
      </ScrollView>
      <Text style={ui.label}>Available times</Text>
      {error ? (
        <ErrorState retry={refetch} />
      ) : isFetching ? (
        <Loading />
      ) : currentData?.slots?.length ? (
        <View style={ui.wrap}>
          {currentData.slots.map(slot => (
            <Choice
              compact
              key={slot}
              title={formatTime(slot)}
              selected={time === slot}
              onPress={() => onTime(slot)}
            />
          ))}
        </View>
      ) : (
        <>
          <Text style={ui.muted}>
            No times available on this day. Please choose another date.
          </Text>
          <Button
            variant="secondary"
            small
            title="Refresh availability"
            onPress={refetch}
          />
        </>
      )}
    </View>
  );
}
