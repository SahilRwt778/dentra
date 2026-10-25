import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/forms/Field';
import { DateField } from '../../components/forms/DateField';
import { ErrorMessage } from '../../components/ui/Feedback';
import { layout } from '../../common/theme/theme';
import type { PaymentStatus } from '../../common/types/payments';
import { PAYMENT_STATUSES } from './payment-format';
import type { PaymentFilters } from './payment-filters';

export function PaymentFiltersCard({
  value,
  change,
  apply,
  clear,
  error,
}: {
  value: PaymentFilters;
  change: (changes: Partial<PaymentFilters>) => void;
  apply: () => void;
  clear: () => void;
  error: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <View style={layout.between}>
        <Text style={layout.heading}>Filters</Text>
        <Button
          title={expanded ? 'Hide filters' : 'Show filters'}
          variant="secondary"
          onPress={() => setExpanded(current => !current)}
        />
      </View>
      {expanded && (
        <>
          <Field
            label="Patient or payment reference"
            value={value.search}
            maxLength={100}
            onChangeText={search => change({ search })}
          />
          <Text style={layout.label}>Payment source</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={layout.row}
          >
            {(
              [
                { value: '', label: 'All sources' },
                { value: 'online', label: 'Online' },
                { value: 'clinic', label: 'At clinic' },
              ] as const
            ).map(item => (
              <Button
                key={item.value}
                title={item.label}
                variant={value.source === item.value ? 'primary' : 'secondary'}
                onPress={() => change({ source: item.value })}
              />
            ))}
          </ScrollView>
          <Text style={layout.label}>Payment status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={layout.row}
          >
            <Button
              title="All statuses"
              variant={value.status ? 'secondary' : 'primary'}
              onPress={() => change({ status: '' })}
            />
            {(
              Object.entries(PAYMENT_STATUSES) as [PaymentStatus, string][]
            ).map(([status, label]) => (
              <Button
                key={status}
                title={label}
                variant={value.status === status ? 'primary' : 'secondary'}
                onPress={() => change({ status })}
              />
            ))}
          </ScrollView>
          <DateField
            label="Transaction date from"
            value={value.from}
            minimumDate="2000-01-01"
            clearLabel="Clear from date"
            onChange={from => change({ from })}
          />
          <DateField
            label="Transaction date to"
            value={value.to}
            minimumDate="2000-01-01"
            clearLabel="Clear to date"
            onChange={to => change({ to })}
          />
          <Text style={layout.muted}>
            Dates use the booking transaction’s creation time in IST. Apply
            filters to update totals and history.
          </Text>
          <ErrorMessage message={error} />
          <View style={layout.row}>
            <View style={layout.grow}>
              <Button title="Apply filters" onPress={apply} />
            </View>
            <View style={layout.grow}>
              <Button
                title="Clear filters"
                variant="secondary"
                onPress={clear}
              />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}
