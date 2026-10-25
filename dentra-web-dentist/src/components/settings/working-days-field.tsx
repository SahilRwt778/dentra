import { DAYS } from '@/lib/working-days';
export function WorkingDaysField({
  value,
  onChange,
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  return (
    <div className="field settings-field-wide">
      <span>Working days</span>
      <div className="row wrap" role="group" aria-label="Working days">
        {DAYS.map((day) => (
          <button
            type="button"
            className={`btn${value.includes(day.value) ? ' btn-primary' : ''}`}
            key={day.value}
            aria-label={day.name}
            aria-pressed={value.includes(day.value)}
            onClick={() =>
              onChange(
                value.includes(day.value)
                  ? value.filter((item) => item !== day.value)
                  : [...value, day.value].sort(),
              )
            }
          >
            {day.label}
          </button>
        ))}
      </div>
      <p className="hint">
        Choose no days to pause new bookings. Existing appointments keep their
        time.
      </p>
    </div>
  );
}
