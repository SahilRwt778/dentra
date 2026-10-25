import React from 'react';
import { Switch, Text, View } from 'react-native';
import type { TimeOffInput } from '../../../common/types/availability';
import { colors, layout } from '../../../common/theme/theme';
import { DateField } from '../../../components/forms/DateField';
import { TimeField } from '../../../components/forms/TimeField';
import { Field } from '../../../components/forms/Field';
import { Card } from '../../../components/ui/Card';
import { settingsStyles } from '../settings-ui';

export function TimeOffFields({
  form,
  change,
  disabled,
}: {
  form: TimeOffInput;
  change: (changes: Partial<TimeOffInput>) => void;
  disabled: boolean;
}) {
  return (
    <Card style={settingsStyles.card}>
      <Text style={settingsStyles.heading}>Add time off</Text>
      <DateField
        label="First day"
        value={form.startDate}
        allowClear={false}
        disabled={disabled}
        onChange={date => {
          if (date)
            change({
              startDate: date,
              endDate: form.endDate < date ? date : form.endDate,
            });
        }}
      />
      <DateField
        label="Last day"
        value={form.endDate}
        minimumDate={form.startDate}
        allowClear={false}
        disabled={disabled}
        onChange={date => {
          if (date) change({ endDate: date });
        }}
      />
      <View style={layout.between}>
        <Text style={layout.label}>All day</Text>
        <Switch
          accessibilityLabel="All day"
          disabled={disabled}
          value={form.allDay}
          trackColor={{ false: colors.line, true: colors.primary }}
          onValueChange={allDay => change({ allDay })}
        />
      </View>
      {!form.allDay && (
        <>
          <Text style={settingsStyles.description}>
            These hours are blocked on each selected date (IST).
          </Text>
          <View style={settingsStyles.row}>
            <View style={settingsStyles.grow}>
              <TimeField
                label="From"
                value={form.fromTime ?? '10:00'}
                disabled={disabled}
                onChange={fromTime => change({ fromTime })}
              />
            </View>
            <View style={settingsStyles.grow}>
              <TimeField
                label="To"
                value={form.toTime ?? '18:30'}
                disabled={disabled}
                onChange={toTime => change({ toTime })}
              />
            </View>
          </View>
        </>
      )}
      <Field
        label="Reason (optional, only you can see this)"
        value={form.reason ?? ''}
        maxLength={200}
        editable={!disabled}
        onChangeText={reason => change({ reason })}
      />
    </Card>
  );
}
