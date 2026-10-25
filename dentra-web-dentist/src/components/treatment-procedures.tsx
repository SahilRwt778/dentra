import type { TreatmentPlanItem } from '@/api/generated-api';
import { rupees } from '@/lib/date';

export function TreatmentProcedures({ items = [] }: { items?: TreatmentPlanItem[] }) {
  if (!items.length) return null;
  const priced = items.filter(item => item.estimatedCostPaise != null);
  return <div className="stack">
    <h4>Planned procedures</h4>
    {items.map((item, index) => <div key={index} className="card flat">
      <b>{index + 1}. {item.procedure}</b>
      <p className="small muted">{item.teeth.length ? `Teeth: ${item.teeth.join(', ')}` : 'General treatment'}</p>
      <p className="small">{item.estimatedCostPaise == null ? 'Cost not estimated' : `Estimated cost: ${rupees(item.estimatedCostPaise)}`}</p>
    </div>)}
    {!!priced.length && <p><b>Estimated total: {rupees(priced.reduce((sum, item) => sum + item.estimatedCostPaise!, 0))}</b>
      {priced.length < items.length && <span className="small muted"> · Some procedures do not have an estimate.</span>}
    </p>}
  </div>;
}
