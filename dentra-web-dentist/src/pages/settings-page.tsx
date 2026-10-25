import { TimeOffSettings } from '@/components/settings/time-off-settings';
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  FileCheck2,
  Landmark,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Video,
} from 'lucide-react';
import { useGetDentistsMeQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { PayoutCard } from '@/components/payout-card';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { ClinicSettings } from '@/components/settings/clinic-settings';
import { ConsultationSettings } from '@/components/settings/consultation-settings';
import { DocumentSettings } from '@/components/settings/document-settings';
import { initials } from '@/lib/date';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'clinics', label: 'Clinics', icon: MapPin },
  { id: 'consultations', label: 'Fees & availability', icon: Video },
  { id: 'time-off', label: 'Time off', icon: CalendarDays },
  { id: 'payout', label: 'Payout details', icon: Landmark },
  { id: 'documents', label: 'Documents', icon: FileCheck2 },
] as const;

export function SettingsPage() {
  const { data: me } = useGetDentistsMeQuery();
  const [active, setActive] =
    useState<(typeof SECTIONS)[number]['id']>('profile');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % SECTIONS.length;
    else if (event.key === 'ArrowLeft')
      next = (index + SECTIONS.length - 1) % SECTIONS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SECTIONS.length - 1;
    else return;
    event.preventDefault();
    setActive(SECTIONS[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <PageHead
        title="Settings"
        subtitle="Manage your professional profile and practice preferences."
      />
      <div className="dentist-settings">
        <section
          className="settings-profile-summary"
          aria-label="Your practice profile"
        >
          <div className="settings-profile-identity">
            <div className="settings-profile-avatar" aria-hidden="true">
              {initials(me?.fullName) || 'D'}
            </div>
            <div className="grow">
              <div className="settings-profile-name">
                <h2>{me?.fullName || 'Your practice'}</h2>
                {me?.status === 'verified' && (
                  <span className="badge green">
                    <BadgeCheck size={14} aria-hidden="true" />
                    Verified dentist
                  </span>
                )}
              </div>
              <p className="settings-profile-description">
                {[me?.qualification, me?.specialization]
                  .filter(Boolean)
                  .join(' · ') || 'Professional account'}
              </p>
              <div className="settings-profile-contact">
                {me?.email && (
                  <span>
                    <Mail size={14} aria-hidden="true" />
                    {me.email}
                  </span>
                )}
                {me?.mobile && (
                  <span>
                    <Phone size={14} aria-hidden="true" />
                    {me.mobile}
                  </span>
                )}
              </div>
            </div>
          </div>
          {me?.clinics?.[0] && (
            <div className="settings-primary-clinic">
              <span>Primary clinic</span>
              <b>
                <MapPin size={15} aria-hidden="true" />
                {me.clinics[0].name}
              </b>
            </div>
          )}
        </section>
        <div
          className="settings-tabs"
          role="tablist"
          aria-label="Settings sections"
        >
          {SECTIONS.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={active === id}
              aria-controls={`settings-panel-${id}`}
              tabIndex={active === id ? 0 : -1}
              onClick={() => setActive(id)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {/* Keep panels mounted so switching sections preserves unfinished edits. */}
        <div
          id="settings-panel-profile"
          role="tabpanel"
          aria-labelledby="settings-tab-profile"
          hidden={active !== 'profile'}
          tabIndex={0}
        >
          <ProfileSettings />
        </div>
        <div
          id="settings-panel-clinics"
          role="tabpanel"
          aria-labelledby="settings-tab-clinics"
          hidden={active !== 'clinics'}
          tabIndex={0}
        >
          <ClinicSettings />
        </div>
        <div
          id="settings-panel-consultations"
          role="tabpanel"
          aria-labelledby="settings-tab-consultations"
          hidden={active !== 'consultations'}
          tabIndex={0}
        >
          <ConsultationSettings />
        </div>
        <div
          id="settings-panel-time-off"
          role="tabpanel"
          aria-labelledby="settings-tab-time-off"
          hidden={active !== 'time-off'}
          tabIndex={0}
        >
          <TimeOffSettings active={active === 'time-off'} />
        </div>
        <div
          id="settings-panel-payout"
          role="tabpanel"
          aria-labelledby="settings-tab-payout"
          hidden={active !== 'payout'}
          tabIndex={0}
        >
          <PayoutCard />
        </div>
        <div
          id="settings-panel-documents"
          role="tabpanel"
          aria-labelledby="settings-tab-documents"
          hidden={active !== 'documents'}
          tabIndex={0}
        >
          <DocumentSettings />
        </div>
      </div>
    </>
  );
}
