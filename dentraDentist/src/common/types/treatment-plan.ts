import type { ToothNumber } from './dental-chart';

export type TreatmentPlanItem = {
  procedure: string;
  teeth: ToothNumber[];
  estimatedCostPaise?: number | null;
};

export type TreatmentPlan = {
  plan: string;
  planItems: TreatmentPlanItem[];
  followUpDate: string | null;
};
export type ProcedureForm = {
  procedure: string;
  teeth: ToothNumber[];
  estimatedCost: string;
};
