import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  action,
  busy,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="settings-card"
      aria-labelledby={`${id}-heading`}
      aria-busy={busy}
    >
      <header className="settings-card-header">
        <div className="settings-card-title">
          <span className="settings-section-icon">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id={`${id}-heading`}>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {action}
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

export function SettingsDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || 'Not added'}</dd>
    </div>
  );
}
