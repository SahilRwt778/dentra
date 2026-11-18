import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PageHeadContext } from './page-head-context';

export function PageHead({
  title,
  subtitle,
  actions,
  avatar,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  avatar?: ReactNode;
}) {
  const slot = useContext(PageHeadContext);
  const content = (
    <div className="po-head">
      <div className="page-identity">
        {avatar}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
  return slot === undefined
    ? content
    : slot
      ? createPortal(content, slot)
      : null;
}
