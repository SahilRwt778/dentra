const UPPER_R = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_L = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_R = ['48', '47', '46', '45', '44', '43', '42', '41'];
const LOWER_L = ['31', '32', '33', '34', '35', '36', '37', '38'];

export const TOOTH_STATUS = [
  { k: 'caries', label: 'Cavity' },
  { k: 'filled', label: 'Filled' },
  { k: 'crown', label: 'Crown' },
  { k: 'rct', label: 'Root canal treated' },
  { k: 'missing', label: 'Missing' },
  { k: 'extract', label: 'To be extracted' },
] as const;

export type ChartState = Record<string, string>;

function statusLabel(status: string): string {
  return TOOTH_STATUS.find((s) => s.k === status)?.label ?? 'Healthy';
}

function Tooth({
  n,
  status,
  editable,
  onClick,
}: {
  n: string;
  status: string;
  editable: boolean;
  onClick?: () => void;
}) {
  const title = `Tooth ${n}: ${statusLabel(status)}`;
  if (editable) {
    return (
      <button type="button" className="tooth" data-s={status} title={title} onClick={onClick}>
        <div className="t" />
        <span>{n}</span>
      </button>
    );
  }
  return (
    <div className="tooth" data-s={status} title={title}>
      <div className="t" />
      <span>{n}</span>
    </div>
  );
}

export function DentalChart({
  chart,
  editable,
  onToothClick,
}: {
  chart: ChartState;
  editable: boolean;
  onToothClick?: (tooth: string) => void;
}) {
  const quad = (teeth: string[]) => (
    <div className="chart-quad">
      {teeth.map((n) => (
        <Tooth key={n} n={n} status={chart[n] ?? ''} editable={editable} onClick={() => onToothClick?.(n)} />
      ))}
    </div>
  );

  return (
    <div className="chart">
      <div className="chart-mid">
        <span>Patient's right</span>
        <span>Upper</span>
        <span>Patient's left</span>
      </div>
      <div className="chart-jaw upper">
        {quad(UPPER_R)}
        {quad(UPPER_L)}
      </div>
      <div className="chart-jaw lower">
        {quad(LOWER_R)}
        {quad(LOWER_L)}
      </div>
      <div className="chart-mid">
        <span></span>
        <span>Lower</span>
        <span></span>
      </div>
    </div>
  );
}

export function ChartLegend({ active, onPick }: { active?: string; onPick?: (status: string) => void }) {
  const items: { k: string; label: string }[] = [{ k: '', label: 'Healthy' }, ...TOOTH_STATUS];
  const isInteractive = active !== undefined;

  return (
    <div className="legend">
      {items.map((s) =>
        isInteractive ? (
          <button
            key={s.k}
            type="button"
            className={`lg${active === s.k ? ' on' : ''}`}
            onClick={() => onPick?.(s.k)}
          >
            <span className={`sw ${s.k}`} />
            {s.label}
          </button>
        ) : (
          <span key={s.k} className="lg">
            <span className={`sw ${s.k}`} />
            {s.label}
          </span>
        ),
      )}
    </div>
  );
}
