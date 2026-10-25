import type { Consultation } from '../../../common/types/consultation';
import type {
  ProcedureForm,
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../../common/types/treatment-plan';

export function treatmentPlanForm(consultation: Consultation): TreatmentPlan {
  return {
    plan: consultation.plan ?? '',
    planItems: consultation.planItems ?? [],
    followUpDate: consultation.followUpDate?.slice(0, 10) ?? null,
  };
}
export function procedureForm(item?: TreatmentPlanItem): ProcedureForm {
  return {
    procedure: item?.procedure ?? '',
    teeth: item?.teeth ?? [],
    estimatedCost:
      item?.estimatedCostPaise == null
        ? ''
        : (item.estimatedCostPaise / 100).toFixed(2),
  };
}
export function validateProcedure(form: ProcedureForm): TreatmentPlanItem {
  const procedure = form.procedure.trim();
  if (!procedure || procedure.length > 200)
    throw new Error('Enter a procedure name with 1–200 characters.');
  if (form.teeth.some(tooth => !/^[1-4][1-8]$/.test(tooth)))
    throw new Error('Select valid permanent teeth.');
  const cost = form.estimatedCost.trim();
  let estimatedCostPaise: number | null = null;
  if (cost) {
    if (!/^\d+(\.\d{1,2})?$/.test(cost))
      throw new Error(
        'Enter a valid cost with up to two decimal places, or leave it empty.',
      );
    const [rupees, paise = ''] = cost.split('.');
    estimatedCostPaise = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
    if (
      !Number.isSafeInteger(estimatedCostPaise) ||
      estimatedCostPaise > 1000000000
    )
      throw new Error('The estimated cost must be ₹1,00,00,000 or less.');
  }
  return {
    procedure,
    teeth: [...new Set(form.teeth)].sort(),
    estimatedCostPaise,
  };
}
export function treatmentPlanChanges(
  form: TreatmentPlan,
  saved: TreatmentPlan,
): Partial<TreatmentPlan> {
  const changes: Partial<TreatmentPlan> = {};
  if (form.plan !== saved.plan) changes.plan = form.plan;
  if (JSON.stringify(form.planItems) !== JSON.stringify(saved.planItems))
    changes.planItems = form.planItems;
  if (form.followUpDate !== saved.followUpDate)
    changes.followUpDate = form.followUpDate;
  return changes;
}
export function estimatedCost(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
