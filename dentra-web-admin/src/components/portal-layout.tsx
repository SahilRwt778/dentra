import { useState, type ReactNode } from 'react';
import { PageHeadContext } from './page-head-context';

export function PortalLayout({ children, notifications }: { children: ReactNode; notifications: ReactNode }) {
  const [headingSlot, setHeadingSlot] = useState<HTMLDivElement | null>(null);
  return (
    <PageHeadContext value={headingSlot}>
      <div className="portal-workspace">
        <header className="portal-topbar" aria-label="Page header">
          <div className="portal-heading-slot" ref={setHeadingSlot} />
          {notifications}
        </header>
        <main className="po-main">{children}</main>
      </div>
    </PageHeadContext>
  );
}
