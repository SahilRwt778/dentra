import { Text, View } from 'react-native';
import type { TreatmentPlanItem } from '@/api/types';
import { rupees } from '@/lib/patient';
import { ui } from '@/theme';

export function TreatmentProcedures({
  items = [],
}: {
  items?: TreatmentPlanItem[];
}) {
  if (!items.length) return null;
  const priced = items.filter(item => item.estimatedCostPaise != null);
  return (
    <>
      {items.map((item, index) => (
        <View key={index} style={ui.stack}>
          <View style={ui.divider} />
          <Text style={ui.heading}>
            {index + 1}. {item.procedure}
          </Text>
          <Text style={ui.body}>
            {item.teeth.length
              ? `Teeth: ${item.teeth.join(', ')}`
              : 'General treatment'}
          </Text>
          <Text style={ui.muted}>
            {item.estimatedCostPaise == null
              ? 'Cost not estimated'
              : `Estimated cost: ${rupees(item.estimatedCostPaise)}`}
          </Text>
        </View>
      ))}
      {!!priced.length && (
        <>
          <View style={ui.divider} />
          <Text style={ui.heading}>
            Estimated total:{' '}
            {rupees(
              priced.reduce((sum, item) => sum + item.estimatedCostPaise!, 0),
            )}
          </Text>
          {priced.length < items.length && (
            <Text style={ui.muted}>
              Some procedures do not have an estimate.
            </Text>
          )}
        </>
      )}
    </>
  );
}
